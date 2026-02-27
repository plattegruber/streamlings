import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from './index';

// Mock global fetch used by the worker to forward events to streamling-state
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeRequest(path: string, init?: RequestInit) {
	return new Request(`http://localhost${path}`, init) as Request<unknown, IncomingRequestCfProperties>;
}

// Env and ExecutionContext are Cloudflare Worker globals (not in tsconfig types)
const env = { STREAMLING_STATE_URL: 'http://mock-state:8787' } as any;
const ctx = {} as any;

describe('Twitch EventSub Adapter', () => {
	beforeEach(() => {
		mockFetch.mockReset();
	});

	it('should forward stream.online events with broadcaster user ID', async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ 'stream.online': 1 }), { status: 200 }),
		);

		const resp = await worker.fetch(
			makeRequest('/webhook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					subscription: { type: 'stream.online' },
					event: {
						id: '9001',
						broadcaster_user_id: '12345',
						broadcaster_user_login: 'streamer',
						broadcaster_user_name: 'Streamer',
						type: 'live',
						started_at: '2026-01-01T00:00:00Z',
					},
				}),
			}),
			env,
			ctx,
		);

		expect(resp.status).toBe(200);
		expect(mockFetch).toHaveBeenCalledOnce();

		// Verify forwarded payload
		const [url, options] = mockFetch.mock.calls[0];
		expect(url).toBe('http://mock-state:8787/webhook');
		const forwarded = JSON.parse(options.body);
		expect(forwarded.subscription.type).toBe('stream.online');
		expect(forwarded.event.twitch_user_id).toBe('12345');
		expect(forwarded.event.internal_user_id).toBe('internal_12345');
		expect(forwarded.event.broadcaster_user_id).toBe('12345');
	});

	it('should forward stream.offline events with broadcaster user ID', async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ 'stream.offline': 1 }), { status: 200 }),
		);

		const resp = await worker.fetch(
			makeRequest('/webhook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					subscription: { type: 'stream.offline' },
					event: {
						broadcaster_user_id: '12345',
						broadcaster_user_login: 'streamer',
						broadcaster_user_name: 'Streamer',
					},
				}),
			}),
			env,
			ctx,
		);

		expect(resp.status).toBe(200);
		expect(mockFetch).toHaveBeenCalledOnce();

		const [, options] = mockFetch.mock.calls[0];
		const forwarded = JSON.parse(options.body);
		expect(forwarded.subscription.type).toBe('stream.offline');
		expect(forwarded.event.twitch_user_id).toBe('12345');
		expect(forwarded.event.internal_user_id).toBe('internal_12345');
	});

	it('should preserve all original event fields when forwarding', async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ 'stream.online': 1 }), { status: 200 }),
		);

		const originalEvent = {
			id: '9002',
			broadcaster_user_id: '67890',
			broadcaster_user_login: 'another_streamer',
			broadcaster_user_name: 'AnotherStreamer',
			type: 'live',
			started_at: '2026-01-01T12:00:00Z',
		};

		await worker.fetch(
			makeRequest('/webhook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					subscription: { type: 'stream.online' },
					event: originalEvent,
				}),
			}),
			env,
			ctx,
		);

		const [, options] = mockFetch.mock.calls[0];
		const forwarded = JSON.parse(options.body);
		expect(forwarded.event.id).toBe('9002');
		expect(forwarded.event.broadcaster_user_login).toBe('another_streamer');
		expect(forwarded.event.started_at).toBe('2026-01-01T12:00:00Z');
	});

	it('should return 500 when forwarding fails', async () => {
		mockFetch.mockResolvedValueOnce(new Response('Error', { status: 500 }));

		const resp = await worker.fetch(
			makeRequest('/webhook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					subscription: { type: 'stream.online' },
					event: { broadcaster_user_id: '12345' },
				}),
			}),
			env,
			ctx,
		);

		expect(resp.status).toBe(500);
	});

	it('should handle challenge verification', async () => {
		const resp = await worker.fetch(
			makeRequest('/webhook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ challenge: 'test-challenge-abc' }),
			}),
			env,
			ctx,
		);

		expect(resp.status).toBe(200);
		expect(await resp.text()).toBe('test-challenge-abc');
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('should return 404 for non-webhook paths', async () => {
		const resp = await worker.fetch(makeRequest('/'), env, ctx);
		expect(resp.status).toBe(404);
	});

	it('should return 405 for non-POST methods', async () => {
		const resp = await worker.fetch(
			makeRequest('/webhook', { method: 'GET' }),
			env,
			ctx,
		);
		expect(resp.status).toBe(405);
	});

	it('should return 400 for POST without subscription', async () => {
		const resp = await worker.fetch(
			makeRequest('/webhook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ invalid: 'payload' }),
			}),
			env,
			ctx,
		);
		expect(resp.status).toBe(400);
	});
});
