/**
 * PUT /api/streamling/character
 *
 * Updates the authenticated user's streamling character type.
 */

import { json, error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { streamling } from '$lib/server/db/schema.js';

const VALID_TYPES = ['plant', 'default-3d', 'custom'];

/** @type {import('./$types').RequestHandler} */
export async function PUT({ locals, request }) {
	const { userId } = locals.auth();
	if (!userId) {
		throw error(401, 'Not authenticated');
	}

	const db = locals.db;
	if (!db) {
		throw error(503, 'Database unavailable');
	}

	const body = await request.json();
	const characterType = body.characterType;

	if (!VALID_TYPES.includes(characterType)) {
		throw error(400, `Invalid character type. Must be one of: ${VALID_TYPES.join(', ')}`);
	}

	const record = await db
		.select()
		.from(streamling)
		.where(eq(streamling.streamerId, userId))
		.get();

	if (!record) {
		throw error(404, 'No streamling found. Connect Twitch first.');
	}

	if (characterType === 'custom' && record.modelStatus !== 'ready') {
		throw error(400, 'Custom model not ready. Generate one first.');
	}

	await db
		.update(streamling)
		.set({ characterType })
		.where(eq(streamling.id, record.id))
		.run();

	return json({ characterType });
}
