/**
 * GET /api/streamling/model
 *
 * Proxies the GLB model file, avoiding CORS issues when loading from Meshy CDN.
 * In production with R2, models are served from our own domain and this isn't needed,
 * but it works as a universal fallback.
 */

import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { streamling } from '$lib/server/db/schema.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals, url }) {
	const streamerId = url.searchParams.get('streamerId');
	if (!streamerId) {
		throw error(400, 'Missing streamerId parameter');
	}

	const db = locals.db;
	if (!db) {
		throw error(503, 'Database unavailable');
	}

	const record = await db
		.select()
		.from(streamling)
		.where(eq(streamling.durableObjectId, streamerId))
		.get();

	if (!record?.modelUrl) {
		throw error(404, 'No model found');
	}

	// Serve an animation GLB when ?type=idle|walking|running|dancing
	const type = url.searchParams.get('type');
	let targetUrl = record.modelUrl;

	if (type) {
		if (!record.animationUrls) {
			throw error(404, 'No animations found');
		}
		/** @type {Record<string, string>} */
		const animUrls = JSON.parse(record.animationUrls);
		if (!animUrls[type]) {
			throw error(404, `No ${type} animation found`);
		}
		targetUrl = animUrls[type];
	}

	const res = await fetch(targetUrl);
	if (!res.ok) {
		throw error(502, 'Failed to fetch model');
	}

	return new Response(res.body, {
		headers: {
			'Content-Type': 'model/gltf-binary',
			'Cache-Control': 'public, max-age=86400'
		}
	});
}
