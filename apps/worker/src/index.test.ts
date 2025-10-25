import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';

describe('Streamlings Worker', () => {
	let worker: UnstableDevWorker;

	beforeAll(async () => {
		worker = await unstable_dev('src/index.ts', {
			experimental: { disableExperimentalWarning: true },
		});
	});

	afterAll(async () => {
		await worker.stop();
	});

	it('should return 404 for non-webhook paths', async () => {
		const resp = await worker.fetch('http://localhost:8787/');
		expect(resp.status).toBe(404);
	});

	it('should handle EventSub challenge verification', async () => {
		const challengeValue = 'test-challenge-123';
		const resp = await worker.fetch('http://localhost:8787/webhook', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ challenge: challengeValue }),
		});

		expect(resp.status).toBe(200);
		const body = await resp.text();
		expect(body).toBe(challengeValue);
	});

	it('should count events and return counts', async () => {
		// Send a channel.follow event
		const followResp = await worker.fetch('http://localhost:8787/webhook', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				subscription: { type: 'channel.follow' },
				event: { user_id: '123' },
			}),
		});

		expect(followResp.status).toBe(200);
		const followCounts = await followResp.json();
		expect(followCounts).toHaveProperty('channel.follow', 1);

		// Send another channel.follow event
		const followResp2 = await worker.fetch('http://localhost:8787/webhook', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				subscription: { type: 'channel.follow' },
				event: { user_id: '456' },
			}),
		});

		const followCounts2 = await followResp2.json();
		expect(followCounts2['channel.follow']).toBe(2);

		// Send a different event type
		const cheerResp = await worker.fetch('http://localhost:8787/webhook', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				subscription: { type: 'channel.cheer' },
				event: { bits: 100 },
			}),
		});

		const cheerCounts = await cheerResp.json();
		expect(cheerCounts['channel.follow']).toBe(2);
		expect(cheerCounts['channel.cheer']).toBe(1);
	});

	it('should return current counts via GET /webhook', async () => {
		const resp = await worker.fetch('http://localhost:8787/webhook', {
			method: 'GET',
		});

		expect(resp.status).toBe(200);
		const counts = await resp.json();
		expect(counts).toHaveProperty('channel.follow');
		expect(counts).toHaveProperty('channel.cheer');
	});

	it('should return 400 for POST without subscription', async () => {
		const resp = await worker.fetch('http://localhost:8787/webhook', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ invalid: 'payload' }),
		});

		expect(resp.status).toBe(400);
	});

	it('should return 405 for unsupported methods', async () => {
		const resp = await worker.fetch('http://localhost:8787/webhook', {
			method: 'DELETE',
		});

		expect(resp.status).toBe(405);
	});
});
