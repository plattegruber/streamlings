import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { Unstable_DevWorker } from 'wrangler';

describe('Streamlings Worker', () => {
	let worker: Unstable_DevWorker;

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
		// Get initial counts
		const initialResp = await worker.fetch('http://localhost:8787/webhook', {
			method: 'GET',
		});
		const initialCounts = await initialResp.json() as Record<string, number>;
		const initialFollowCount = initialCounts['channel.follow'] || 0;
		const initialCheerCount = initialCounts['channel.cheer'] || 0;

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
		const followCounts = await followResp.json() as Record<string, number>;
		expect(followCounts['channel.follow']).toBe(initialFollowCount + 1);

		// Send another channel.follow event
		const followResp2 = await worker.fetch('http://localhost:8787/webhook', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				subscription: { type: 'channel.follow' },
				event: { user_id: '456' },
			}),
		});

		const followCounts2 = await followResp2.json() as Record<string, number>;
		expect(followCounts2['channel.follow']).toBe(initialFollowCount + 2);

		// Send a different event type
		const cheerResp = await worker.fetch('http://localhost:8787/webhook', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				subscription: { type: 'channel.cheer' },
				event: { bits: 100 },
			}),
		});

		const cheerCounts = await cheerResp.json() as Record<string, number>;
		expect(cheerCounts['channel.follow']).toBe(initialFollowCount + 2);
		expect(cheerCounts['channel.cheer']).toBe(initialCheerCount + 1);
	});

	it('should return current counts via GET /webhook', async () => {
		const resp = await worker.fetch('http://localhost:8787/webhook', {
			method: 'GET',
		});

		expect(resp.status).toBe(200);
		const counts = await resp.json() as Record<string, number>;
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
