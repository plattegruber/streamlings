/**
 * Twitch EventSub Adapter Worker
 *
 * Receives Twitch EventSub webhooks and forwards them to StreamlingState worker
 * with mapped internal user IDs.
 */

import { extractTwitchUserId } from './extract';
import { verifyTwitchSignature } from './verify';

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		// Route to /webhook endpoint
		if (url.pathname !== '/webhook') {
			return new Response('Not Found', { status: 404 });
		}

		// POST /webhook - handle EventSub
		if (request.method === 'POST') {
			// Read raw body first — signature verification needs the exact bytes
			const rawBody = await request.text();

			// Verify webhook signature when secret is configured
			const secret = env.TWITCH_WEBHOOK_SECRET;
			if (secret) {
				const result = await verifyTwitchSignature(request.headers, rawBody, secret);
				if (!result.valid) {
					console.warn(`Webhook signature verification failed: ${result.error}`);
					return new Response('Forbidden', { status: 403 });
				}
			} else {
				console.warn(
					'TWITCH_WEBHOOK_SECRET is not set — skipping signature verification. ' +
					'This is acceptable for local development but must be configured in production.',
				);
			}

			const body = JSON.parse(rawBody) as any; // internal parse of already-validated body

			// Handle EventSub verification challenge
			if (body.challenge) {
				console.log('EventSub verification challenge received');
				return new Response(body.challenge, {
					headers: { 'Content-Type': 'text/plain' },
				});
			}

			// Handle EventSub notification
			if (body.subscription && body.subscription.type) {
				const eventType = body.subscription.type;

				// Extract Twitch user ID from event
				const twitchUserId = extractTwitchUserId(body.event);

				// Map Twitch user ID to internal ID
				// For now, simple prefix mapping - will be more sophisticated later
				const internalUserId = `internal_${twitchUserId}`;

				console.log(`Received ${eventType} for Twitch user ${twitchUserId} -> internal ${internalUserId}`);

				// Forward to StreamlingState worker
				const streamlingStateUrl = env.STREAMLING_STATE_URL || 'http://localhost:8787';
				const forwardResponse = await fetch(`${streamlingStateUrl}/webhook`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						subscription: { type: eventType },
						event: {
							...body.event,
							internal_user_id: internalUserId,
							twitch_user_id: twitchUserId,
						},
					}),
				});

				if (!forwardResponse.ok) {
					console.error(`Failed to forward to StreamlingState: ${forwardResponse.status}`);
					return new Response('Error forwarding event', { status: 500 });
				}

				const counts = await forwardResponse.json();
				console.log('Event forwarded successfully');
				console.table(counts);

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
