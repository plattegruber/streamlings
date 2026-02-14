import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const user = sqliteTable('user', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	age: integer('age')
});

export const streamer = sqliteTable('streamer', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	displayName: text('display_name').notNull(),
	avatarUrl: text('avatar_url'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const platformConnection = sqliteTable('platform_connection', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	streamerId: text('streamer_id')
		.notNull()
		.references(() => streamer.id),
	platform: text('platform').notNull(),
	platformUserId: text('platform_user_id').notNull(),
	platformUsername: text('platform_username'),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	tokenExpiresAt: integer('token_expires_at', { mode: 'timestamp' }),
	connectedAt: integer('connected_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const streamling = sqliteTable('streamling', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	streamerId: text('streamer_id')
		.notNull()
		.unique()
		.references(() => streamer.id),
	durableObjectId: text('durable_object_id').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});
