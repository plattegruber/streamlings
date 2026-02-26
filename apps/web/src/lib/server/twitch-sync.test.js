import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './db/schema.js';
import { syncTwitchConnection, getTwitchConnection } from './twitch-sync.js';

/** @type {InstanceType<typeof Database>} */
let sqlite;
/** @type {ReturnType<typeof drizzle>} */
let db;

beforeEach(() => {
	sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	db = drizzle(sqlite, { schema });

	sqlite.exec(`
		CREATE TABLE user (
			id TEXT PRIMARY KEY,
			age INTEGER
		);

		CREATE TABLE streamer (
			id TEXT PRIMARY KEY,
			display_name TEXT NOT NULL,
			avatar_url TEXT,
			created_at INTEGER NOT NULL
		);

		CREATE TABLE platform_connection (
			id TEXT PRIMARY KEY,
			streamer_id TEXT NOT NULL REFERENCES streamer(id),
			platform TEXT NOT NULL,
			platform_user_id TEXT NOT NULL,
			platform_username TEXT,
			access_token TEXT,
			refresh_token TEXT,
			token_expires_at INTEGER,
			connected_at INTEGER NOT NULL
		);

		CREATE TABLE streamling (
			id TEXT PRIMARY KEY,
			streamer_id TEXT NOT NULL UNIQUE REFERENCES streamer(id),
			durable_object_id TEXT NOT NULL,
			created_at INTEGER NOT NULL
		);
	`);
});

afterEach(() => {
	sqlite.close();
});

describe('syncTwitchConnection', () => {
	const defaultData = {
		twitchUserId: 'twitch-123',
		twitchUsername: 'TestStreamer',
		avatarUrl: 'https://example.com/avatar.png',
		accessToken: 'access-token-abc',
		refreshToken: null,
		tokenExpiresAt: new Date('2026-03-01T00:00:00Z')
	};

	it('should create streamer, platform_connection, and streamling records', async () => {
		const result = await syncTwitchConnection(db, 'clerk-user-1', defaultData);

		expect(result.streamerId).toBe('clerk-user-1');
		expect(result.twitchUsername).toBe('TestStreamer');
		expect(result.twitchUserId).toBe('twitch-123');
		expect(result.connectionId).toBeDefined();
		expect(result.streamlingId).toBeDefined();
		expect(result.durableObjectId).toBeDefined();

		// Verify database records
		const streamers = db.select().from(schema.streamer).all();
		expect(streamers).toHaveLength(1);
		expect(streamers[0].id).toBe('clerk-user-1');
		expect(streamers[0].displayName).toBe('TestStreamer');
		expect(streamers[0].avatarUrl).toBe('https://example.com/avatar.png');

		const connections = db.select().from(schema.platformConnection).all();
		expect(connections).toHaveLength(1);
		expect(connections[0].platform).toBe('twitch');
		expect(connections[0].platformUserId).toBe('twitch-123');
		expect(connections[0].platformUsername).toBe('TestStreamer');
		expect(connections[0].accessToken).toBe('access-token-abc');

		const streamlings = db.select().from(schema.streamling).all();
		expect(streamlings).toHaveLength(1);
		expect(streamlings[0].streamerId).toBe('clerk-user-1');
	});

	it('should be idempotent — second call updates existing records', async () => {
		await syncTwitchConnection(db, 'clerk-user-1', defaultData);

		const updatedData = {
			...defaultData,
			twitchUsername: 'NewUsername',
			accessToken: 'new-access-token'
		};
		const result = await syncTwitchConnection(db, 'clerk-user-1', updatedData);

		expect(result.twitchUsername).toBe('NewUsername');

		// Should still have exactly one of each record
		const streamers = db.select().from(schema.streamer).all();
		expect(streamers).toHaveLength(1);
		expect(streamers[0].displayName).toBe('NewUsername');

		const connections = db.select().from(schema.platformConnection).all();
		expect(connections).toHaveLength(1);
		expect(connections[0].platformUsername).toBe('NewUsername');
		expect(connections[0].accessToken).toBe('new-access-token');

		const streamlings = db.select().from(schema.streamling).all();
		expect(streamlings).toHaveLength(1);
	});

	it('should preserve the existing streamling durable object ID on update', async () => {
		const first = await syncTwitchConnection(db, 'clerk-user-1', defaultData);
		const second = await syncTwitchConnection(db, 'clerk-user-1', {
			...defaultData,
			twitchUsername: 'Updated'
		});

		expect(second.durableObjectId).toBe(first.durableObjectId);
		expect(second.streamlingId).toBe(first.streamlingId);
	});

	it('should handle null tokens gracefully', async () => {
		const result = await syncTwitchConnection(db, 'clerk-user-1', {
			twitchUserId: 'twitch-456',
			twitchUsername: 'NoTokenStreamer',
			avatarUrl: null,
			accessToken: null,
			refreshToken: null,
			tokenExpiresAt: null
		});

		expect(result.streamerId).toBe('clerk-user-1');

		const connections = db.select().from(schema.platformConnection).all();
		expect(connections).toHaveLength(1);
		expect(connections[0].accessToken).toBeNull();
		expect(connections[0].refreshToken).toBeNull();
		expect(connections[0].tokenExpiresAt).toBeNull();
	});
});

describe('getTwitchConnection', () => {
	it('should return null when no connection exists', async () => {
		const result = await getTwitchConnection(db, 'nonexistent-user');
		expect(result).toBeNull();
	});

	it('should return the Twitch connection when it exists', async () => {
		await syncTwitchConnection(db, 'clerk-user-1', {
			twitchUserId: 'twitch-123',
			twitchUsername: 'TestStreamer',
			avatarUrl: null,
			accessToken: null,
			refreshToken: null,
			tokenExpiresAt: null
		});

		const result = await getTwitchConnection(db, 'clerk-user-1');
		expect(result).not.toBeNull();
		expect(result?.platformUsername).toBe('TestStreamer');
		expect(result?.platformUserId).toBe('twitch-123');
		expect(result?.connectedAt).toBeInstanceOf(Date);
	});

	it('should not return connections for a different platform', async () => {
		// Manually insert a YouTube connection (not via sync)
		const now = Math.floor(Date.now() / 1000);
		db.insert(schema.streamer)
			.values({ id: 'clerk-user-2', displayName: 'YTStreamer', createdAt: new Date(now * 1000) })
			.run();
		db.insert(schema.platformConnection)
			.values({
				id: 'pc-yt',
				streamerId: 'clerk-user-2',
				platform: 'youtube',
				platformUserId: 'UC_abc',
				platformUsername: 'YTStreamer',
				connectedAt: new Date(now * 1000)
			})
			.run();

		const result = await getTwitchConnection(db, 'clerk-user-2');
		expect(result).toBeNull();
	});
});
