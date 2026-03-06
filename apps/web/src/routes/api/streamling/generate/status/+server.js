/**
 * GET /api/streamling/generate/status
 *
 * Polls Meshy task status and advances the generation pipeline:
 *   pending → preview → refining → rigging → animating → ready
 */

import { json, error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { env as privateEnv } from '$env/dynamic/private';
import { streamling } from '$lib/server/db/schema.js';
import {
	getTask,
	createRefineTask,
	createPreviewTask,
	buildPrompt,
	downloadGlb,
	createRiggingTask,
	getRiggingTask,
	createAnimationTask,
	getAnimationTask,
	ANIMATION_SEQUENCE
} from '$lib/server/meshy.js';

/**
 * Upload a GLB to R2 if available, otherwise return the source URL as-is.
 * @param {any} platform
 * @param {string} recordId
 * @param {string} sourceUrl
 * @param {string} suffix
 * @returns {Promise<string>}
 */
async function storeGlb(platform, recordId, sourceUrl, suffix) {
	const bucket = platform?.env?.MODELS_BUCKET;
	const r2PublicUrl = platform?.env?.R2_PUBLIC_URL;
	if (bucket && r2PublicUrl) {
		const data = await downloadGlb(sourceUrl);
		const key = `models/${recordId}/${Date.now()}-${suffix}.glb`;
		await bucket.put(key, data, {
			httpMetadata: { contentType: 'model/gltf-binary' }
		});
		return `${r2PublicUrl}/${key}`;
	}
	return sourceUrl;
}

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals, platform }) {
	const { userId } = locals.auth();
	if (!userId) {
		throw error(401, 'Not authenticated');
	}

	const db = locals.db;
	if (!db) {
		throw error(503, 'Database unavailable');
	}

	const record = await db.select().from(streamling).where(eq(streamling.streamerId, userId)).get();

	if (!record) {
		throw error(404, 'No streamling found');
	}

	// Nothing in progress
	if (!record.meshyTaskId || !record.modelStatus) {
		return json({
			status: record.modelStatus ?? 'none',
			progress: record.modelStatus === 'ready' ? 100 : 0,
			prompt: record.modelPrompt,
			modelUrl: record.modelUrl
		});
	}

	// Already complete or failed — just return current state
	if (record.modelStatus === 'ready' || record.modelStatus === 'failed') {
		return json({
			status: record.modelStatus,
			progress: record.modelStatus === 'ready' ? 100 : 0,
			prompt: record.modelPrompt,
			modelUrl: record.modelUrl
		});
	}

	const apiKey = platform?.env?.MESHY_API_KEY ?? privateEnv.MESHY_API_KEY;
	if (!apiKey) {
		throw error(503, 'Meshy API key not configured');
	}

	// --- Route to the correct Meshy API based on current stage ---

	if (record.modelStatus === 'rigging') {
		return handleRigging(db, apiKey, record, platform);
	}

	if (record.modelStatus === 'animating') {
		return handleAnimating(db, apiKey, record, platform);
	}

	// For pending/preview/refining, poll the text-to-3d task
	const task = await getTask(apiKey, record.meshyTaskId);

	// Task failed — auto-retry up to 2 times before reporting failure
	if (task.status === 'FAILED' || task.status === 'EXPIRED') {
		return handleFailure(db, apiKey, record);
	}

	// Preview completed → kick off refine
	if (
		(record.modelStatus === 'pending' || record.modelStatus === 'preview') &&
		task.status === 'SUCCEEDED'
	) {
		const { taskId: refineTaskId } = await createRefineTask(apiKey, record.meshyTaskId);

		await db
			.update(streamling)
			.set({ modelStatus: 'refining', meshyTaskId: refineTaskId })
			.where(eq(streamling.id, record.id))
			.run();

		return json({
			status: 'refining',
			progress: 0,
			prompt: record.modelPrompt,
			modelUrl: null
		});
	}

	// Refine completed → kick off rigging
	if (record.modelStatus === 'refining' && task.status === 'SUCCEEDED') {
		const { taskId: rigTaskId } = await createRiggingTask(apiKey, record.meshyTaskId);

		await db
			.update(streamling)
			.set({
				modelStatus: 'rigging',
				meshyTaskId: rigTaskId,
				meshyRigTaskId: rigTaskId
			})
			.where(eq(streamling.id, record.id))
			.run();

		return json({
			status: 'rigging',
			progress: 0,
			prompt: record.modelPrompt,
			modelUrl: null
		});
	}

	// Still in progress
	return json({
		status: record.modelStatus === 'refining' ? 'refining' : 'preview',
		progress: task.progress ?? 0,
		prompt: record.modelPrompt,
		modelUrl: null
	});
}

// ---------------------------------------------------------------------------
// Stage handlers
// ---------------------------------------------------------------------------

/**
 * Handle the rigging stage: poll rigging task, on success store assets and start idle animation.
 * @param {any} db
 * @param {string} apiKey
 * @param {any} record
 * @param {any} platform
 */
async function handleRigging(db, apiKey, record, platform) {
	const task = await getRiggingTask(apiKey, record.meshyTaskId);

	if (task.status === 'FAILED' || task.status === 'CANCELED') {
		return handleFailure(db, apiKey, record);
	}

	if (task.status === 'SUCCEEDED' && task.result) {
		const riggedUrl = await storeGlb(
			platform,
			record.id,
			task.result.rigged_character_glb_url,
			'rigged'
		);

		const walkingUrl = await storeGlb(
			platform,
			record.id,
			task.result.basic_animations.walking_glb_url,
			'walking'
		);

		const runningUrl = await storeGlb(
			platform,
			record.id,
			task.result.basic_animations.running_glb_url,
			'running'
		);

		// Start first animation from sequence
		const firstAnim = ANIMATION_SEQUENCE[0];
		const { taskId: animTaskId } = await createAnimationTask(
			apiKey,
			record.meshyRigTaskId ?? record.meshyTaskId,
			firstAnim.actionId
		);

		/** @type {Record<string, string>} */
		const animUrls = { walking: walkingUrl, running: runningUrl };

		await db
			.update(streamling)
			.set({
				modelStatus: 'animating',
				modelUrl: riggedUrl,
				meshyTaskId: animTaskId,
				animationUrls: JSON.stringify(animUrls)
			})
			.where(eq(streamling.id, record.id))
			.run();

		return json({
			status: 'animating',
			progress: 0,
			prompt: record.modelPrompt,
			modelUrl: null
		});
	}

	// Still rigging
	return json({
		status: 'rigging',
		progress: task.progress ?? 0,
		prompt: record.modelPrompt,
		modelUrl: null
	});
}

/**
 * Handle the animating stage: poll animation task, advance through ANIMATION_SEQUENCE → ready.
 * @param {any} db
 * @param {string} apiKey
 * @param {any} record
 * @param {any} platform
 */
async function handleAnimating(db, apiKey, record, platform) {
	const task = await getAnimationTask(apiKey, record.meshyTaskId);

	if (task.status === 'FAILED' || task.status === 'CANCELED' || task.status === 'EXPIRED') {
		return handleFailure(db, apiKey, record);
	}

	if (task.status === 'SUCCEEDED' && task.result) {
		/** @type {Record<string, string>} */
		const animUrls = record.animationUrls ? JSON.parse(record.animationUrls) : {};

		// Find which animation just completed (the first one not yet in animUrls)
		const justCompleted = ANIMATION_SEQUENCE.find((a) => !animUrls[a.key]);
		if (justCompleted) {
			const storedUrl = await storeGlb(
				platform,
				record.id,
				task.result.animation_glb_url,
				justCompleted.key
			);
			animUrls[justCompleted.key] = storedUrl;
		}

		// Find the next animation to request
		const nextAnim = ANIMATION_SEQUENCE.find((a) => !animUrls[a.key]);

		if (nextAnim) {
			// Request next animation
			const { taskId } = await createAnimationTask(
				apiKey,
				record.meshyRigTaskId,
				nextAnim.actionId
			);

			await db
				.update(streamling)
				.set({
					meshyTaskId: taskId,
					animationUrls: JSON.stringify(animUrls)
				})
				.where(eq(streamling.id, record.id))
				.run();

			return json({
				status: 'animating',
				progress: 0,
				prompt: record.modelPrompt,
				modelUrl: null
			});
		}

		// All animations complete
		await db
			.update(streamling)
			.set({
				modelStatus: 'ready',
				meshyTaskId: null,
				animationUrls: JSON.stringify(animUrls)
			})
			.where(eq(streamling.id, record.id))
			.run();

		return json({
			status: 'ready',
			progress: 100,
			prompt: record.modelPrompt,
			modelUrl: record.modelUrl
		});
	}

	// Still animating
	return json({
		status: 'animating',
		progress: task.progress ?? 0,
		prompt: record.modelPrompt,
		modelUrl: null
	});
}

/**
 * Handle task failure with auto-retry (up to 2 retries, restarts from preview).
 * @param {any} db
 * @param {string} apiKey
 * @param {any} record
 */
async function handleFailure(db, apiKey, record) {
	const retries = record.modelRetries ?? 0;

	if (retries < 2 && record.modelPrompt) {
		const styledPrompt = buildPrompt(record.modelPrompt);
		const { taskId } = await createPreviewTask(apiKey, styledPrompt);

		await db
			.update(streamling)
			.set({
				modelStatus: 'pending',
				meshyTaskId: taskId,
				modelRetries: retries + 1,
				meshyRigTaskId: null,
				animationUrls: null
			})
			.where(eq(streamling.id, record.id))
			.run();

		return json({
			status: 'retrying',
			attempt: retries + 1,
			progress: 0,
			prompt: record.modelPrompt,
			modelUrl: null
		});
	}

	await db
		.update(streamling)
		.set({
			modelStatus: 'failed',
			meshyTaskId: null,
			modelRetries: 0,
			meshyRigTaskId: null
		})
		.where(eq(streamling.id, record.id))
		.run();

	return json({
		status: 'failed',
		progress: 0,
		prompt: record.modelPrompt,
		modelUrl: null
	});
}
