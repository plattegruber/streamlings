import { env } from '$env/dynamic/public';

export const load = ({ platform }) => {
	return {
		workerUrl:
			platform?.env?.PUBLIC_WORKER_URL ?? env.PUBLIC_WORKER_URL ?? 'http://localhost:8787'
	};
};
