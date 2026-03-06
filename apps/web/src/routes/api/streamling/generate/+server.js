/**
 * POST /api/streamling/generate
 *
 * Kicks off a Meshy Text-to-3D preview generation for the authenticated user's streamling.
 */

import { json, error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { env as privateEnv } from '$env/dynamic/private';
import { streamling } from '$lib/server/db/schema.js';
import { buildPrompt, createPreviewTask } from '$lib/server/meshy.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ locals, request, platform }) {
	const { userId } = locals.auth();
	if (!userId) {
		throw error(401, 'Not authenticated');
	}

	const db = locals.db;
	if (!db) {
		throw error(503, 'Database unavailable');
	}

	const apiKey = platform?.env?.MESHY_API_KEY ?? privateEnv.MESHY_API_KEY;
	if (!apiKey) {
		throw error(503, 'Meshy API key not configured');
	}

	const body = await request.json();
	const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
	if (!prompt || prompt.length > 100) {
		throw error(400, 'Prompt must be 1-100 characters');
	}

	const record = await db.select().from(streamling).where(eq(streamling.streamerId, userId)).get();

	if (!record) {
		throw error(404, 'No streamling found. Connect Twitch first.');
	}

	const activeStatuses = ['pending', 'preview', 'refining', 'rigging', 'animating'];
	if (record.modelStatus && activeStatuses.includes(record.modelStatus)) {
		throw error(409, 'Generation already in progress');
	}

	const styledPrompt = buildPrompt(prompt);
	const { taskId } = await createPreviewTask(apiKey, styledPrompt);

	await db
		.update(streamling)
		.set({
			modelStatus: 'pending',
			meshyTaskId: taskId,
			modelPrompt: prompt,
			modelUrl: null,
			modelRetries: 0
		})
		.where(eq(streamling.id, record.id))
		.run();

	return json({ taskId, status: 'pending' });
}
