import { buildClerkProps } from 'svelte-clerk/server';
import { env as publicEnv } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';

let loggedMissingKeyWarning = false;

export const load = ({ locals }) => {
	const publishableKey =
		publicEnv.PUBLIC_CLERK_PUBLISHABLE_KEY ?? privateEnv.CLERK_PUBLISHABLE_KEY ?? '';

	if (!publishableKey && !loggedMissingKeyWarning) {
		console.warn(
			'[streamlings] Clerk publishable key is not configured; authentication UI will fail.'
		);
		loggedMissingKeyWarning = true;
	}

	return {
		...buildClerkProps(locals.auth()),
		publishableKey
	};
};
