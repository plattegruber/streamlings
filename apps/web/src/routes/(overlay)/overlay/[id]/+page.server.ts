import { env } from '$env/dynamic/public';

export const load = ({ params }) => {
	return {
		workerUrl: env.PUBLIC_WORKER_URL ?? 'http://localhost:8787',
		streamerId: params.id
	};
};
