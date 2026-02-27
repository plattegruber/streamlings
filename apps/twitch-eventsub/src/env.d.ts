/**
 * Secrets set via `wrangler secret put` are not included in the
 * auto-generated Env from `wrangler types`. Extend the interface
 * here so TypeScript knows about them.
 */
interface Env {
	TWITCH_WEBHOOK_SECRET?: string;
}
