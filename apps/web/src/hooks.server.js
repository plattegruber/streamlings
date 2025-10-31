import { withClerkHandler } from 'svelte-clerk/server';
import { redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

const clerkHandler = withClerkHandler();

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

export const handle = sequence(clerkHandler, protectedRoutes);
