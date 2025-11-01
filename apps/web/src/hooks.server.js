import { withClerkHandler } from 'svelte-clerk/server';
import { redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { resolveDatabase } from '$lib/server/db';

const clerkHandler = withClerkHandler();

let loggedDatabaseWarning = false;

/**
 * Attach a database instance to the current request, preferring the Cloudflare
 * D1 binding and falling back to any configured libSQL connection when running
 * locally. Failures are logged once to avoid noisy output in environments where
 * a database is intentionally unavailable (e.g. certain tests).
 * @type {import('@sveltejs/kit').Handle}
 */
const attachDatabase = async ({ event, resolve }) => {
	try {
		event.locals.db = resolveDatabase(event);
	} catch (error) {
		event.locals.db = undefined;

		if (!loggedDatabaseWarning) {
			console.warn(
				'[streamlings] Database connection unavailable:',
				error instanceof Error ? error.message : error
			);
			loggedDatabaseWarning = true;
		}
	}

	return resolve(event);
};

/**
 * @type {import('@sveltejs/kit').Handle}
 */
const protectedRoutes = async ({ event, resolve }) => {
	const { userId } = event.locals.auth();

	// Protect /dashboard route
	if (event.url.pathname.startsWith('/dashboard') && !userId) {
		throw redirect(303, '/login');
	}

	return resolve(event);
};

export const handle = sequence(clerkHandler, attachDatabase, protectedRoutes);
