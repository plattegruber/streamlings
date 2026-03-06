import { env } from '$env/dynamic/public';
import { getTwitchConnection } from '$lib/server/twitch-sync.js';
import { streamling } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

/** @type {import('./$types').PageServerLoad} */
export const load = async ({ locals, platform }) => {
	const workerUrl =
		platform?.env?.PUBLIC_WORKER_URL ?? env.PUBLIC_WORKER_URL ?? 'http://localhost:8787';

	const { userId } = locals.auth();
	const db = locals.db;

	/** @type {{ connected: boolean, twitchUsername: string|null }} */
	let twitchConnection = { connected: false, twitchUsername: null };

	/** @type {string} */
	let streamerId = env.PUBLIC_DEFAULT_STREAMER_ID ?? 'default-streamer';

	/** @type {string | null} */
	let modelUrl = null;
	/** @type {string | null} */
	let modelStatus = null;
	/** @type {string | null} */
	let modelPrompt = null;
	/** @type {string} */
	let characterType = 'default-3d';

	if (userId && db) {
		try {
			const connection = await getTwitchConnection(db, userId);
			if (connection) {
				twitchConnection = {
					connected: true,
					twitchUsername: connection.platformUsername
				};
			}

			const userStreamling = await db
				.select()
				.from(streamling)
				.where(eq(streamling.streamerId, userId))
				.get();

			if (userStreamling) {
				streamerId = userStreamling.durableObjectId;
				characterType = userStreamling.characterType;
				if (userStreamling.modelUrl) {
					modelUrl = `/api/streamling/model?streamerId=${encodeURIComponent(userStreamling.durableObjectId)}`;
				}
				modelStatus = userStreamling.modelStatus;
				modelPrompt = userStreamling.modelPrompt;
			}
		} catch (err) {
			console.warn('[dashboard] Failed to load data:', err);
		}
	}

	// In dev mode (placeholder Clerk keys), align with the simulator's default streamer ID
	if (
		userId === 'dev-user' &&
		streamerId === (env.PUBLIC_DEFAULT_STREAMER_ID ?? 'default-streamer')
	) {
		streamerId = 'sim-streamer-1';
	}

	return {
		workerUrl,
		streamerId,
		twitchConnection,
		characterType,
		modelUrl,
		modelStatus,
		modelPrompt
	};
};
