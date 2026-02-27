import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '../src/index';
import { computeHmacSha256 } from '../src/verify';

// Mock global fetch used by the worker to forward events to streamling-state
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const WEBHOOK_SECRET = 'integration-test-secret';

// Env and ExecutionContext are Cloudflare Worker globals (not in tsconfig types)
const envWithSecret = {
	STREAMLING_STATE_URL: 'http://mock-state:8787',
	TWITCH_WEBHOOK_SECRET: WEBHOOK_SECRET,
} as any;

const envWithoutSecret = {
	STREAMLING_STATE_URL: 'http://mock-state:8787',
} as any;

const ctx = {} as any;

/**
 * Helper: build a POST request with valid Twitch EventSub signature headers.
 */
async function makeSignedRequest(
	path: string,
	body: string,
	options?: {
		secret?: string;
		messageId?: string;
		timestamp?: string;
		signature?: string;
	},
): Promise<Request<unknown, IncomingRequestCfProperties>> {
	const messageId = options?.messageId ?? 'test-msg-id';
	const timestamp = options?.timestamp ?? new Date().toISOString();
	const secret = options?.secret ?? WEBHOOK_SECRET;

	let signature = options?.signature;
	if (!signature) {
		const hmacMessage = messageId + timestamp + body;
		const hex = await computeHmacSha256(secret, hmacMessage);
		signature = `sha256=${hex}`;
	}

	return new Request(`http://localhost${path}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Twitch-Eventsub-Message-Id': messageId,
			'Twitch-Eventsub-Message-Timestamp': timestamp,
			'Twitch-Eventsub-Message-Signature': signature,
		},
		body,
	}) as Request<unknown, IncomingRequestCfProperties>;
}

describe('Webhook signature verification integration', () => {
	beforeEach(() => {
		mockFetch.mockReset();
	});

	it('should accept a request with a valid signature', async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ 'channel.chat.message': 1 }), { status: 200 }),
		);

		const body = JSON.stringify({
			subscription: { type: 'channel.chat.message' },
			event: { user_id: '99999' },
		});

		const req = await makeSignedRequest('/webhook', body);
		const resp = await worker.fetch(req, envWithSecret, ctx);

		expect(resp.status).toBe(200);
		expect(mockFetch).toHaveBeenCalledOnce();
	});

	it('should return 403 for an invalid signature', async () => {
		const body = JSON.stringify({
			subscription: { type: 'channel.chat.message' },
			event: { user_id: '99999' },
		});

		const req = await makeSignedRequest('/webhook', body, {
			signature: 'sha256=0000000000000000000000000000000000000000000000000000000000000000',
		});
		const resp = await worker.fetch(req, envWithSecret, ctx);

		expect(resp.status).toBe(403);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('should return 403 for a stale timestamp', async () => {
		const body = JSON.stringify({
			subscription: { type: 'channel.chat.message' },
			event: { user_id: '99999' },
		});

		// Timestamp from 15 minutes ago
		const staleTime = new Date(Date.now() - 15 * 60 * 1000).toISOString();
		const req = await makeSignedRequest('/webhook', body, { timestamp: staleTime });
		const resp = await worker.fetch(req, envWithSecret, ctx);

		expect(resp.status).toBe(403);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('should return 403 when signature headers are missing', async () => {
		const body = JSON.stringify({
			subscription: { type: 'channel.chat.message' },
			event: { user_id: '99999' },
		});

		// Request with no Twitch headers at all
		const req = new Request('http://localhost/webhook', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body,
		}) as Request<unknown, IncomingRequestCfProperties>;

		const resp = await worker.fetch(req, envWithSecret, ctx);

		expect(resp.status).toBe(403);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('should skip verification when secret is not configured (local dev)', async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ 'channel.chat.message': 1 }), { status: 200 }),
		);

		const body = JSON.stringify({
			subscription: { type: 'channel.chat.message' },
			event: { user_id: '99999' },
		});

		// No signature headers, no secret — should pass through
		const req = new Request('http://localhost/webhook', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body,
		}) as Request<unknown, IncomingRequestCfProperties>;

		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const resp = await worker.fetch(req, envWithoutSecret, ctx);
		expect(resp.status).toBe(200);
		expect(mockFetch).toHaveBeenCalledOnce();

		// Should log a warning about missing secret
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('TWITCH_WEBHOOK_SECRET is not set'),
		);
		warnSpy.mockRestore();
	});

	it('should verify challenge requests when secret is configured', async () => {
		const body = JSON.stringify({ challenge: 'challenge-token-xyz' });
		const req = await makeSignedRequest('/webhook', body);

		const resp = await worker.fetch(req, envWithSecret, ctx);

		expect(resp.status).toBe(200);
		expect(await resp.text()).toBe('challenge-token-xyz');
	});

	it('should reject challenge requests with invalid signature', async () => {
		const body = JSON.stringify({ challenge: 'challenge-token-xyz' });
		const req = await makeSignedRequest('/webhook', body, {
			signature: 'sha256=badbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadb',
		});

		const resp = await worker.fetch(req, envWithSecret, ctx);

		expect(resp.status).toBe(403);
	});

	it('should return 403 when signature is computed with the wrong secret', async () => {
		const body = JSON.stringify({
			subscription: { type: 'channel.chat.message' },
			event: { user_id: '99999' },
		});

		const req = await makeSignedRequest('/webhook', body, {
			secret: 'wrong-secret',
		});
		const resp = await worker.fetch(req, envWithSecret, ctx);

		expect(resp.status).toBe(403);
		expect(mockFetch).not.toHaveBeenCalled();
	});
});
