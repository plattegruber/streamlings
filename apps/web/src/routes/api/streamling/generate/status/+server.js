/**
 * GET /api/streamling/generate/status
 *
 * Polls Meshy task status and advances the generation pipeline:
 *   pending → preview (Meshy preview SUCCEEDED) → refining → ready (GLB stored)
 */

import { json, error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { env as privateEnv } from '$env/dynamic/private';
import { streamling } from '$lib/server/db/schema.js';
import { getTask, createRefineTask, downloadGlb } from '$lib/server/meshy.js';

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

	const task = await getTask(apiKey, record.meshyTaskId);

	// Task failed
	if (task.status === 'FAILED' || task.status === 'EXPIRED') {
		await db
			.update(streamling)
			.set({ modelStatus: 'failed', meshyTaskId: null })
			.where(eq(streamling.id, record.id))
			.run();

		return json({
			status: 'failed',
			progress: 0,
			prompt: record.modelPrompt,
			modelUrl: null
		});
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

	// Refine completed → download GLB and store
	if (record.modelStatus === 'refining' && task.status === 'SUCCEEDED') {
		const glbUrl = task.model_urls?.glb;
		if (!glbUrl) {
			await db
				.update(streamling)
				.set({ modelStatus: 'failed', meshyTaskId: null })
				.where(eq(streamling.id, record.id))
				.run();

			return json({
				status: 'failed',
				progress: 0,
				prompt: record.modelPrompt,
				modelUrl: null
			});
		}

		let finalUrl = glbUrl;

		// Upload to R2 if both the bucket binding and public URL are configured (production).
		// In local dev, miniflare provides the bucket binding but the public URL won't exist,
		// so we fall back to the Meshy CDN URL (expires in ~3 days, fine for dev).
		const bucket = platform?.env?.MODELS_BUCKET;
		const r2PublicUrl = platform?.env?.R2_PUBLIC_URL;
		if (bucket && r2PublicUrl) {
			const glbData = await downloadGlb(glbUrl);
			const key = `models/${record.id}/${Date.now()}.glb`;
			await bucket.put(key, glbData, {
				httpMetadata: { contentType: 'model/gltf-binary' }
			});
			finalUrl = `${r2PublicUrl}/${key}`;
		}

		await db
			.update(streamling)
			.set({ modelStatus: 'ready', modelUrl: finalUrl, meshyTaskId: null })
			.where(eq(streamling.id, record.id))
			.run();

		return json({
			status: 'ready',
			progress: 100,
			prompt: record.modelPrompt,
			modelUrl: finalUrl
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
