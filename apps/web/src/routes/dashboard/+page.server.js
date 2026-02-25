import { env } from '$env/dynamic/public';

export const load = () => {
	return {
		workerUrl: env.PUBLIC_WORKER_URL ?? 'http://localhost:8787',
		// TODO: Replace with authenticated streamer ID once OAuth/streamer routing is implemented
		streamerId: env.PUBLIC_DEFAULT_STREAMER_ID ?? 'default-streamer'
	};
};
