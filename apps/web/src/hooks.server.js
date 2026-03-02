import { withClerkHandler } from 'svelte-clerk/server';
import { redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { resolveDatabase } from '$lib/server/db';
import { env as privateEnv } from '$env/dynamic/private';

/**
 * Detect placeholder Clerk keys that ship in .env.example.
 * @param {string | undefined} key
 */
function isPlaceholderKey(key) {
	return !key || key.startsWith('pk_test_your') || key.startsWith('sk_test_your');
}

/** @type {import('@sveltejs/kit').Handle} */
const clerkHandler = async ({ event, resolve }) => {
	const publishableKey =
		event.platform?.env?.CLERK_PUBLISHABLE_KEY ?? privateEnv.CLERK_PUBLISHABLE_KEY;
	const secretKey = event.platform?.env?.CLERK_SECRET_KEY ?? privateEnv.CLERK_SECRET_KEY;

	// Skip Clerk entirely when keys are missing or placeholders (local dev)
	if (isPlaceholderKey(publishableKey) || isPlaceholderKey(secretKey)) {
		console.warn('[hooks] Clerk keys are placeholders — running in dev mode without auth');
		event.locals.auth = () => /** @type {any} */ ({ userId: 'dev-user' });
		return resolve(event);
	}

	console.log('[hooks] clerkHandler', { path: event.url.pathname });

	const handler = withClerkHandler({
		publishableKey,
		secretKey
	});

	const response = await handler({ event, resolve });
	console.log('[hooks] clerkHandler complete', {
		path: event.url.pathname,
		status: response.status
	});
	return response;
};

/**
 * Attach a database instance to the current request, preferring the Cloudflare
 * D1 binding and falling back to any configured libSQL connection when running
 * locally. Failures are logged to avoid silent failures in production.
 * @type {import('@sveltejs/kit').Handle}
 */
const attachDatabase = async ({ event, resolve }) => {
	try {
		event.locals.db = resolveDatabase(event);
		console.log('[hooks] database attached', { type: event.platform?.env?.DB ? 'D1' : 'libSQL' });
	} catch (error) {
		event.locals.db = undefined;
		console.warn('[hooks] database unavailable', {
			error: error instanceof Error ? error.message : error
		});
	}

	return resolve(event);
};

/**
 * @type {import('@sveltejs/kit').Handle}
 */
const protectedRoutes = async ({ event, resolve }) => {
	const { userId } = event.locals.auth();

	if (event.url.pathname.startsWith('/dashboard')) {
		console.log('[hooks] auth check', {
			path: event.url.pathname,
			hasUserId: !!userId,
			redirecting: !userId
		});
		if (!userId) {
			throw redirect(303, '/login');
		}
	}

	return resolve(event);
};

export const handle = sequence(clerkHandler, attachDatabase, protectedRoutes);
