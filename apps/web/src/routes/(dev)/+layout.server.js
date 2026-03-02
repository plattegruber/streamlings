import { env } from '$env/dynamic/public';

export const load = () => {
	return {
		workerUrl: env.PUBLIC_WORKER_URL ?? 'http://localhost:8787'
	};
};
