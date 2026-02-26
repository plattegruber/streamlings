import { env } from '$env/dynamic/public';
import { getTwitchConnection } from '$lib/server/twitch-sync.js';
import { streamling } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

/** @type {import('./$types').PageServerLoad} */
export const load = async ({ locals }) => {
	const workerUrl = env.PUBLIC_WORKER_URL ?? 'http://localhost:8787';

	const { userId } = locals.auth();
	const db = locals.db;

	/** @type {{ connected: boolean, twitchUsername: string|null }} */
	let twitchConnection = { connected: false, twitchUsername: null };

	/** @type {string} */
	let streamerId = env.PUBLIC_DEFAULT_STREAMER_ID ?? 'default-streamer';

	if (userId && db) {
		try {
			const connection = await getTwitchConnection(db, userId);
			if (connection) {
				twitchConnection = {
					connected: true,
					twitchUsername: connection.platformUsername
				};
			}

			// Use the authenticated user's streamling durable object ID if available
			const userStreamling = await db
				.select()
				.from(streamling)
				.where(eq(streamling.streamerId, userId))
				.get();

			if (userStreamling) {
				streamerId = userStreamling.durableObjectId;
			}
		} catch (err) {
			console.warn('[dashboard] Failed to load Twitch connection:', err);
		}
	}

	return {
		workerUrl,
		streamerId,
		twitchConnection
	};
};
