import { DurableObject } from "cloudflare:workers";

/**
 * StreamlingState tracks event counts from Twitch EventSub webhooks
 */
export class StreamlingState extends DurableObject<Env> {
	private eventCounts: Map<string, number>;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.eventCounts = new Map();

		// Load persisted counts from storage on initialization
		ctx.blockConcurrencyWhile(async () => {
			const stored = await ctx.storage.get<Record<string, number>>('event_counts');
			if (stored) {
				this.eventCounts = new Map(Object.entries(stored));
			}
		});
	}

	/**
	 * Increment the count for a specific event type
	 */
	async incrementEvent(eventType: string): Promise<void> {
		const current = this.eventCounts.get(eventType) || 0;
		this.eventCounts.set(eventType, current + 1);

		// Persist to storage
		await this.ctx.storage.put('event_counts', Object.fromEntries(this.eventCounts));
	}

	/**
	 * Get all event counts
	 */
	async getCounts(): Promise<Record<string, number>> {
		return Object.fromEntries(this.eventCounts);
	}
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		// Route to /webhook endpoint
		if (url.pathname !== '/webhook') {
			return new Response('Not Found', { status: 404 });
		}

		// Get the StreamlingState Durable Object instance
		const stub = env.STREAMLING_STATE.getByName("streamling");

		// GET /webhook - return current counts
		if (request.method === 'GET') {
			const counts = await stub.getCounts();
			return new Response(JSON.stringify(counts, null, 2), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// POST /webhook - handle EventSub
		if (request.method === 'POST') {
			const body = await request.json() as any;

			// Handle EventSub verification challenge
			if (body.challenge) {
				console.log('✓ EventSub verification challenge received');
				return new Response(body.challenge, {
					headers: { 'Content-Type': 'text/plain' },
				});
			}

			// Handle EventSub notification
			if (body.subscription && body.subscription.type) {
				const eventType = body.subscription.type;

				// Increment count in Durable Object
				await stub.incrementEvent(eventType);

				// Get all counts and log table
				const counts = await stub.getCounts();
				console.log('\n📊 Event Counts:');
				console.table(counts);

				// Return counts in response
				return new Response(JSON.stringify(counts, null, 2), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			return new Response('Bad Request', { status: 400 });
		}

		return new Response('Method Not Allowed', { status: 405 });
	},
} satisfies ExportedHandler<Env>;
