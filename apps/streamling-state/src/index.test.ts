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

	describe('CORS headers', () => {
		it('should return 204 with CORS headers for OPTIONS preflight', async () => {
			const resp = await worker.fetch('http://localhost:8787/webhook', {
				method: 'OPTIONS',
			});

			expect(resp.status).toBe(204);
			expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
			expect(resp.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
			expect(resp.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
		});

		it('should return CORS headers on GET responses', async () => {
			const resp = await worker.fetch('http://localhost:8787/webhook', {
				method: 'GET',
			});

			expect(resp.status).toBe(200);
			expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
			expect(resp.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
			expect(resp.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
		});

		it('should return CORS headers on POST responses', async () => {
			const resp = await worker.fetch('http://localhost:8787/webhook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ challenge: 'cors-test' }),
			});

			expect(resp.status).toBe(200);
			expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
		});

		it('should return CORS headers on error responses', async () => {
			const resp = await worker.fetch('http://localhost:8787/nonexistent', {
				method: 'GET',
			});

			expect(resp.status).toBe(404);
			expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
		});

		it('should return CORS headers on /telemetry endpoint', async () => {
			const resp = await worker.fetch('http://localhost:8787/telemetry', {
				method: 'GET',
			});

			expect(resp.status).toBe(200);
			expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
			expect(resp.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
		});

		it('should handle OPTIONS preflight on any path', async () => {
			const resp = await worker.fetch('http://localhost:8787/telemetry', {
				method: 'OPTIONS',
			});

			expect(resp.status).toBe(204);
			expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
		});
	});

	describe('WebSocket /ws endpoint', () => {
		it('should return 426 for non-upgrade requests to /ws', async () => {
			const resp = await worker.fetch('http://localhost:8787/ws', {
				method: 'GET',
			});
			expect(resp.status).toBe(426);
		});

		it('should accept WebSocket upgrade and receive telemetry', async () => {
			const ws = new WebSocket(`ws://${worker.address}:${worker.port}/ws`);

			try {
				// Wait for connection to open
				await new Promise<void>((resolve, reject) => {
					const timeout = setTimeout(() => reject(new Error('WebSocket connection timed out')), 10_000);
					ws.addEventListener('open', () => { clearTimeout(timeout); resolve(); });
					ws.addEventListener('error', (e) => { clearTimeout(timeout); reject(e); });
				});

				// Wait for a telemetry broadcast (arrives on next alarm tick)
				const message = await new Promise<string>((resolve, reject) => {
					const timeout = setTimeout(() => reject(new Error('Timed out waiting for telemetry')), 30_000);
					ws.addEventListener('message', (event: MessageEvent) => {
						clearTimeout(timeout);
						resolve(typeof event.data === 'string' ? event.data : '');
					});
				});

				const telemetry = JSON.parse(message);
				expect(telemetry).toHaveProperty('energy');
				expect(telemetry).toHaveProperty('mood');
				expect(telemetry).toHaveProperty('recentActivity');
				expect(telemetry).toHaveProperty('timestamp');
			} finally {
				ws.close();
			}
		}, 45_000);

		it('should support multiple concurrent WebSocket connections', async () => {
			const ws1 = new WebSocket(`ws://${worker.address}:${worker.port}/ws`);
			const ws2 = new WebSocket(`ws://${worker.address}:${worker.port}/ws`);

			try {
				// Wait for both to connect
				await Promise.all([
					new Promise<void>((resolve, reject) => {
						const timeout = setTimeout(() => reject(new Error('ws1 connection timed out')), 10_000);
						ws1.addEventListener('open', () => { clearTimeout(timeout); resolve(); });
						ws1.addEventListener('error', (e) => { clearTimeout(timeout); reject(e); });
					}),
					new Promise<void>((resolve, reject) => {
						const timeout = setTimeout(() => reject(new Error('ws2 connection timed out')), 10_000);
						ws2.addEventListener('open', () => { clearTimeout(timeout); resolve(); });
						ws2.addEventListener('error', (e) => { clearTimeout(timeout); reject(e); });
					}),
				]);

				// Both should receive telemetry on the next alarm tick
				const [msg1, msg2] = await Promise.all([
					new Promise<string>((resolve, reject) => {
						const timeout = setTimeout(() => reject(new Error('ws1 timed out')), 30_000);
						ws1.addEventListener('message', (event: MessageEvent) => {
							clearTimeout(timeout);
							resolve(typeof event.data === 'string' ? event.data : '');
						});
					}),
					new Promise<string>((resolve, reject) => {
						const timeout = setTimeout(() => reject(new Error('ws2 timed out')), 30_000);
						ws2.addEventListener('message', (event: MessageEvent) => {
							clearTimeout(timeout);
							resolve(typeof event.data === 'string' ? event.data : '');
						});
					}),
				]);

				const telemetry1 = JSON.parse(msg1);
				const telemetry2 = JSON.parse(msg2);

				expect(telemetry1).toHaveProperty('energy');
				expect(telemetry2).toHaveProperty('energy');
				expect(telemetry1.mood.currentState).toBe(telemetry2.mood.currentState);
			} finally {
				ws1.close();
				ws2.close();
			}
		}, 45_000);
	});
});
