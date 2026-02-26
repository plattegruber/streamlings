/**
 * Syncs a Clerk user's Twitch OAuth connection to the database.
 *
 * Responsible for ensuring the streamer, platform_connection, and streamling
 * records exist and stay up-to-date whenever the user's Twitch connection
 * data is refreshed from Clerk.
 */

import { eq, and } from 'drizzle-orm';
import { streamer, platformConnection, streamling } from '$lib/server/db/schema.js';

/**
 * @typedef {Object} TwitchConnectionData
 * @property {string} twitchUserId    - Twitch user ID (from ExternalAccount.externalId)
 * @property {string} twitchUsername   - Twitch display name
 * @property {string|null} avatarUrl   - Twitch profile image URL
 * @property {string|null} accessToken - OAuth access token (may be null if Clerk doesn't expose it)
 * @property {string|null} refreshToken - OAuth refresh token
 * @property {Date|null} tokenExpiresAt - Token expiry timestamp
 */

/**
 * @typedef {Object} SyncResult
 * @property {string} streamerId
 * @property {string} connectionId
 * @property {string} streamlingId
 * @property {string} durableObjectId
 * @property {string} twitchUsername
 * @property {string} twitchUserId
 */

/**
 * Look up or create a streamer record for the given Clerk user ID, then
 * upsert the Twitch platform connection and ensure a streamling record
 * exists.
 *
 * Uses the Clerk user ID as the streamer primary key so that repeated
 * calls for the same user are idempotent.
 *
 * @param {any} db - Drizzle database instance (D1, libSQL, or better-sqlite3 in tests)
 * @param {string} clerkUserId - The Clerk user ID (used as streamer.id)
 * @param {TwitchConnectionData} data
 * @returns {Promise<SyncResult>}
 */
export async function syncTwitchConnection(db, clerkUserId, data) {
	// 1. Upsert streamer record (keyed on Clerk user ID)
	const existingStreamer = await db
		.select()
		.from(streamer)
		.where(eq(streamer.id, clerkUserId))
		.get();

	if (!existingStreamer) {
		await db.insert(streamer).values({
			id: clerkUserId,
			displayName: data.twitchUsername,
			avatarUrl: data.avatarUrl
		});
	} else {
		// Update display name and avatar if changed
		await db
			.update(streamer)
			.set({
				displayName: data.twitchUsername,
				avatarUrl: data.avatarUrl ?? existingStreamer.avatarUrl
			})
			.where(eq(streamer.id, clerkUserId));
	}

	// 2. Upsert platform_connection for Twitch
	const existingConnection = await db
		.select()
		.from(platformConnection)
		.where(
			and(eq(platformConnection.streamerId, clerkUserId), eq(platformConnection.platform, 'twitch'))
		)
		.get();

	/** @type {string} */
	let connectionId;

	if (!existingConnection) {
		connectionId = crypto.randomUUID();
		await db.insert(platformConnection).values({
			id: connectionId,
			streamerId: clerkUserId,
			platform: 'twitch',
			platformUserId: data.twitchUserId,
			platformUsername: data.twitchUsername,
			accessToken: data.accessToken,
			refreshToken: data.refreshToken,
			tokenExpiresAt: data.tokenExpiresAt,
			connectedAt: new Date()
		});
	} else {
		connectionId = existingConnection.id;
		await db
			.update(platformConnection)
			.set({
				platformUserId: data.twitchUserId,
				platformUsername: data.twitchUsername,
				accessToken: data.accessToken,
				refreshToken: data.refreshToken,
				tokenExpiresAt: data.tokenExpiresAt
			})
			.where(eq(platformConnection.id, existingConnection.id));
	}

	// 3. Ensure a streamling record exists for this streamer
	const existingStreamling = await db
		.select()
		.from(streamling)
		.where(eq(streamling.streamerId, clerkUserId))
		.get();

	/** @type {string} */
	let streamlingId;
	/** @type {string} */
	let durableObjectId;

	if (!existingStreamling) {
		streamlingId = crypto.randomUUID();
		durableObjectId = crypto.randomUUID();
		await db.insert(streamling).values({
			id: streamlingId,
			streamerId: clerkUserId,
			durableObjectId
		});
	} else {
		streamlingId = existingStreamling.id;
		durableObjectId = existingStreamling.durableObjectId;
	}

	return {
		streamerId: clerkUserId,
		connectionId,
		streamlingId,
		durableObjectId,
		twitchUsername: data.twitchUsername,
		twitchUserId: data.twitchUserId
	};
}

/**
 * Fetch the existing Twitch platform connection for a streamer, if any.
 *
 * @param {any} db - Drizzle database instance (D1, libSQL, or better-sqlite3 in tests)
 * @param {string} clerkUserId
 * @returns {Promise<{ platformUsername: string|null, platformUserId: string, connectedAt: Date } | null>}
 */
export async function getTwitchConnection(db, clerkUserId) {
	const connection = await db
		.select()
		.from(platformConnection)
		.where(
			and(eq(platformConnection.streamerId, clerkUserId), eq(platformConnection.platform, 'twitch'))
		)
		.get();

	if (!connection) return null;

	return {
		platformUsername: connection.platformUsername,
		platformUserId: connection.platformUserId,
		connectedAt: connection.connectedAt
	};
}
