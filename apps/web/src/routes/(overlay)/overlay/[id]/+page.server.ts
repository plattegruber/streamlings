import { env } from '$env/dynamic/public';
import { streamling } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

export const load = async ({ params, platform, locals }) => {
	const workerUrl =
		platform?.env?.PUBLIC_WORKER_URL ?? env.PUBLIC_WORKER_URL ?? 'http://localhost:8787';

	let modelUrl: string | null = null;
	let characterType = 'default-3d';
	let animationUrls: Record<string, string> | null = null;

	try {
		const db = locals.db;
		if (db) {
			const record = await db
				.select()
				.from(streamling)
				.where(eq(streamling.durableObjectId, params.id))
				.get();
			if (record) {
				characterType = record.characterType;
				const base = `/api/streamling/model?streamerId=${encodeURIComponent(params.id)}`;
				if (record.modelUrl) {
					modelUrl = base;
				}
				if (record.animationUrls) {
					const parsed: Record<string, string> = JSON.parse(record.animationUrls);
					animationUrls = {};
					for (const [key, url] of Object.entries(parsed)) {
						if (url) animationUrls[key] = `${base}&type=${key}`;
					}
				}
			}
		}
	} catch {
		// DB unavailable — fall back to default
	}

	return {
		workerUrl,
		streamerId: params.id,
		characterType,
		modelUrl,
		animationUrls
	};
};
