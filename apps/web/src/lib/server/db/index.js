import { drizzle as drizzleD1 } from 'drizzle-orm/d1';
import { drizzle as drizzleLibSQL } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

let libsqlClient;
let libsqlDb;

/**
 * Instantiate a Drizzle client backed by a Cloudflare D1 binding.
 * @param {unknown} binding
 */
export const createD1Database = (binding) => drizzleD1(binding, { schema });

/**
 * Lazily create (and cache) a Drizzle client backed by a libSQL connection.
 * Intended for local development and tests where a D1 binding is unavailable.
 */
export const getLibsqlDatabase = () => {
	if (libsqlDb) return libsqlDb;

	if (!env.DATABASE_URL) {
		throw new Error('DATABASE_URL is not set');
	}

	const clientConfig = { url: env.DATABASE_URL };

	if (env.DATABASE_AUTH_TOKEN) {
		clientConfig.authToken = env.DATABASE_AUTH_TOKEN;
	}

	libsqlClient = libsqlClient ?? createClient(clientConfig);
	libsqlDb = drizzleLibSQL(libsqlClient, { schema });

	return libsqlDb;
};

/**
 * Resolve the appropriate database instance for a given SvelteKit request.
 * Prefers the Cloudflare D1 binding when available, otherwise falls back to libSQL.
 */
export const resolveDatabase = (event) => {
	if (event?.platform?.env?.DB) {
		return createD1Database(event.platform.env.DB);
	}

	return getLibsqlDatabase();
};
