import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

/** @type {InstanceType<typeof Database>} */
let sqlite;
/** @type {ReturnType<typeof drizzle>} */
let db;

beforeEach(() => {
	sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	db = drizzle(sqlite, { schema });

	// Create tables matching the Drizzle schema
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

describe('schema deployment', () => {
	it('should create all tables in fresh SQLite database', () => {
		const tables = sqlite
			.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
			.all();
		const tableNames = tables.map((/** @type {{ name: string }} */ t) => t.name);

		expect(tableNames).toContain('user');
		expect(tableNames).toContain('streamer');
		expect(tableNames).toContain('platform_connection');
		expect(tableNames).toContain('streamling');
	});
});

describe('streamer table', () => {
	it('should insert and retrieve a streamer', () => {
		const now = Math.floor(Date.now() / 1000);
		db.insert(schema.streamer)
			.values({ id: 's1', displayName: 'TestStreamer', createdAt: new Date(now * 1000) })
			.run();

		const rows = db.select().from(schema.streamer).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].displayName).toBe('TestStreamer');
		expect(rows[0].avatarUrl).toBeNull();
	});

	it('should require display_name', () => {
		expect(() => {
			sqlite.prepare('INSERT INTO streamer (id, created_at) VALUES (?, ?)').run('s1', 12345);
		}).toThrow();
	});
});

describe('platform_connection table', () => {
	it('should insert a platform connection linked to a streamer', () => {
		const now = Math.floor(Date.now() / 1000);
		db.insert(schema.streamer)
			.values({ id: 's1', displayName: 'TestStreamer', createdAt: new Date(now * 1000) })
			.run();

		db.insert(schema.platformConnection)
			.values({
				id: 'pc1',
				streamerId: 's1',
				platform: 'twitch',
				platformUserId: '12345',
				platformUsername: 'teststreamer',
				connectedAt: new Date(now * 1000)
			})
			.run();

		const rows = db.select().from(schema.platformConnection).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].platform).toBe('twitch');
		expect(rows[0].streamerId).toBe('s1');
	});

	it('should reject platform connection with non-existent streamer_id', () => {
		expect(() => {
			sqlite
				.prepare(
					'INSERT INTO platform_connection (id, streamer_id, platform, platform_user_id, connected_at) VALUES (?, ?, ?, ?, ?)'
				)
				.run('pc1', 'nonexistent', 'twitch', '12345', 12345);
		}).toThrow(/FOREIGN KEY/);
	});

	it('should allow multiple connections for the same streamer', () => {
		const now = Math.floor(Date.now() / 1000);
		db.insert(schema.streamer)
			.values({ id: 's1', displayName: 'TestStreamer', createdAt: new Date(now * 1000) })
			.run();

		db.insert(schema.platformConnection)
			.values({
				id: 'pc1',
				streamerId: 's1',
				platform: 'twitch',
				platformUserId: '12345',
				connectedAt: new Date(now * 1000)
			})
			.run();

		db.insert(schema.platformConnection)
			.values({
				id: 'pc2',
				streamerId: 's1',
				platform: 'youtube',
				platformUserId: 'UC_abc',
				connectedAt: new Date(now * 1000)
			})
			.run();

		const rows = db.select().from(schema.platformConnection).all();
		expect(rows).toHaveLength(2);
	});
});

describe('streamling table', () => {
	it('should insert a streamling linked to a streamer', () => {
		const now = Math.floor(Date.now() / 1000);
		db.insert(schema.streamer)
			.values({ id: 's1', displayName: 'TestStreamer', createdAt: new Date(now * 1000) })
			.run();

		db.insert(schema.streamling)
			.values({
				id: 'sl1',
				streamerId: 's1',
				durableObjectId: 'do-abc-123',
				createdAt: new Date(now * 1000)
			})
			.run();

		const rows = db.select().from(schema.streamling).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].durableObjectId).toBe('do-abc-123');
		expect(rows[0].streamerId).toBe('s1');
	});

	it('should enforce one streamling per streamer (unique constraint)', () => {
		const now = Math.floor(Date.now() / 1000);
		db.insert(schema.streamer)
			.values({ id: 's1', displayName: 'TestStreamer', createdAt: new Date(now * 1000) })
			.run();

		sqlite
			.prepare(
				'INSERT INTO streamling (id, streamer_id, durable_object_id, created_at) VALUES (?, ?, ?, ?)'
			)
			.run('sl1', 's1', 'do-abc', 12345);

		expect(() => {
			sqlite
				.prepare(
					'INSERT INTO streamling (id, streamer_id, durable_object_id, created_at) VALUES (?, ?, ?, ?)'
				)
				.run('sl2', 's1', 'do-def', 12345);
		}).toThrow(/UNIQUE/);
	});

	it('should reject streamling with non-existent streamer_id', () => {
		expect(() => {
			sqlite
				.prepare(
					'INSERT INTO streamling (id, streamer_id, durable_object_id, created_at) VALUES (?, ?, ?, ?)'
				)
				.run('sl1', 'nonexistent', 'do-abc', 12345);
		}).toThrow(/FOREIGN KEY/);
	});
});

describe('foreign key cascading', () => {
	it('should prevent deleting a streamer with linked platform connections', () => {
		const now = Math.floor(Date.now() / 1000);
		db.insert(schema.streamer)
			.values({ id: 's1', displayName: 'TestStreamer', createdAt: new Date(now * 1000) })
			.run();

		db.insert(schema.platformConnection)
			.values({
				id: 'pc1',
				streamerId: 's1',
				platform: 'twitch',
				platformUserId: '12345',
				connectedAt: new Date(now * 1000)
			})
			.run();

		expect(() => {
			sqlite.prepare('DELETE FROM streamer WHERE id = ?').run('s1');
		}).toThrow(/FOREIGN KEY/);
	});

	it('should prevent deleting a streamer with a linked streamling', () => {
		const now = Math.floor(Date.now() / 1000);
		db.insert(schema.streamer)
			.values({ id: 's1', displayName: 'TestStreamer', createdAt: new Date(now * 1000) })
			.run();

		db.insert(schema.streamling)
			.values({
				id: 'sl1',
				streamerId: 's1',
				durableObjectId: 'do-abc',
				createdAt: new Date(now * 1000)
			})
			.run();

		expect(() => {
			sqlite.prepare('DELETE FROM streamer WHERE id = ?').run('s1');
		}).toThrow(/FOREIGN KEY/);
	});
});

describe('user table (preserved)', () => {
	it('should still support the existing user table', () => {
		db.insert(schema.user).values({ id: 'u1', age: 25 }).run();

		const rows = db.select().from(schema.user).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].age).toBe(25);
	});
});
