/**
 * API route for managing the authenticated user's Twitch connection.
 *
 * GET  — returns current connection status
 * POST — syncs the user's Clerk Twitch external account to the database
 */

import { json, error } from '@sveltejs/kit';
import { clerkClient } from 'svelte-clerk/server';
import { syncTwitchConnection, getTwitchConnection } from '$lib/server/twitch-sync.js';

/**
 * Returns the current Twitch connection status for the authenticated user.
 * @type {import('./$types').RequestHandler}
 */
export async function GET({ locals }) {
	const { userId } = locals.auth();
	if (!userId) {
		throw error(401, 'Not authenticated');
	}

	const db = locals.db;
	if (!db) {
		throw error(503, 'Database unavailable');
	}

	const connection = await getTwitchConnection(db, userId);

	return json({
		connected: connection !== null,
		twitchUsername: connection?.platformUsername ?? null,
		twitchUserId: connection?.platformUserId ?? null,
		connectedAt: connection?.connectedAt?.toISOString() ?? null
	});
}

/**
 * Syncs the user's Clerk Twitch external account to the database.
 *
 * Fetches the Twitch external account and OAuth token from Clerk's backend
 * API, then upserts the streamer/platform_connection/streamling records.
 * @type {import('./$types').RequestHandler}
 */
export async function POST({ locals }) {
	const { userId } = locals.auth();
	if (!userId) {
		throw error(401, 'Not authenticated');
	}

	const db = locals.db;
	if (!db) {
		throw error(503, 'Database unavailable');
	}

	// Fetch user from Clerk to get their external accounts
	const clerkUser = await clerkClient.users.getUser(userId);

	const twitchAccount = clerkUser.externalAccounts?.find(
		(account) => account.provider === 'oauth_twitch'
	);

	if (!twitchAccount) {
		throw error(
			400,
			'No Twitch account linked in Clerk. Please connect Twitch through your profile settings first.'
		);
	}

	// Fetch the OAuth access token from Clerk
	/** @type {string|null} */
	let accessToken = null;
	/** @type {Date|null} */
	let tokenExpiresAt = null;

	try {
		const tokenResponse = await clerkClient.users.getUserOauthAccessToken(userId, 'twitch');
		const tokens = tokenResponse.data;
		if (tokens && tokens.length > 0) {
			accessToken = tokens[0].token;
			tokenExpiresAt = tokens[0].expiresAt ? new Date(tokens[0].expiresAt * 1000) : null;
		}
	} catch (err) {
		// Token retrieval may fail if Clerk doesn't store the token or the
		// provider config doesn't request offline_access. We still proceed
		// with the connection (just without tokens).
		console.warn('[twitch-connect] Could not retrieve OAuth token from Clerk:', err);
	}

	const result = await syncTwitchConnection(db, userId, {
		twitchUserId: twitchAccount.externalId,
		twitchUsername: twitchAccount.username ?? twitchAccount.firstName ?? 'Unknown',
		avatarUrl: twitchAccount.imageUrl || null,
		accessToken,
		refreshToken: null, // Clerk does not expose refresh tokens via the backend API
		tokenExpiresAt
	});

	return json({
		connected: true,
		twitchUsername: result.twitchUsername,
		twitchUserId: result.twitchUserId,
		streamerId: result.streamerId,
		durableObjectId: result.durableObjectId
	});
}
