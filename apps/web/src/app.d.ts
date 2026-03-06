/// <reference types="svelte-clerk/env" />

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			db?:
				| import('drizzle-orm/d1').DrizzleD1Database<typeof import('$lib/server/db/schema')>
				| import('drizzle-orm/libsql').LibSQLDatabase<typeof import('$lib/server/db/schema')>;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env?: {
				DB: unknown;
				CLERK_PUBLISHABLE_KEY?: string;
				CLERK_SECRET_KEY?: string;
				PUBLIC_WORKER_URL?: string;
				PUBLIC_STREAMER_ID?: string;
				MESHY_API_KEY?: string;
				R2_PUBLIC_URL?: string;
				// R2 bucket binding (available in Cloudflare production)
				MODELS_BUCKET?: {
					put(key: string, value: ArrayBuffer | ReadableStream, options?: Record<string, unknown>): Promise<unknown>;
					get(key: string): Promise<unknown>;
				};
			};
		}
	}
}

export {};
