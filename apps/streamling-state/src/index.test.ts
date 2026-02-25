import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { Unstable_DevWorker } from 'wrangler';
import {
	categorizeEvent,
	extractMetadata,
	createEventRecord,
	appendToRingBuffer,
	MAX_RECENT_EVENTS,
} from './events';
import type { EventRecord } from '@streamlings/shared/types';

/** Default streamer ID used across most tests. */
const STREAMER = 'test-streamer-1';

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

	it('should return 404 for root path', async () => {
		const resp = await worker.fetch('http://localhost:8787/');
		expect(resp.status).toBe(404);
	});

	it('should return 404 for paths without a streamer ID', async () => {
		const resp = await worker.fetch('http://localhost:8787/telemetry');
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

	it('should return 400 when POST /webhook event is missing internal_user_id', async () => {
		const resp = await worker.fetch('http://localhost:8787/webhook', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				subscription: { type: 'channel.follow' },
				event: { user_id: '123' },
			}),
		});

		expect(resp.status).toBe(400);
		const body = await resp.json() as { error: string };
		expect(body.error).toContain('internal_user_id');
	});

	it('should count events and return counts', async () => {
		// Get initial counts
		const initialResp = await worker.fetch(`http://localhost:8787/webhook/${STREAMER}`, {
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
				event: { user_id: '123', internal_user_id: STREAMER },
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
				event: { user_id: '456', internal_user_id: STREAMER },
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
				event: { bits: 100, internal_user_id: STREAMER },
			}),
		});

		const cheerCounts = await cheerResp.json() as Record<string, number>;
		expect(cheerCounts['channel.follow']).toBe(initialFollowCount + 2);
		expect(cheerCounts['channel.cheer']).toBe(initialCheerCount + 1);
	});

	it('should return current counts via GET /webhook/:streamerId', async () => {
		const resp = await worker.fetch(`http://localhost:8787/webhook/${STREAMER}`, {
			method: 'GET',
		});

		expect(resp.status).toBe(200);
		const counts = await resp.json() as Record<string, number>;
		expect(counts).toHaveProperty('channel.follow');
		expect(counts).toHaveProperty('channel.cheer');
	});

	it('should return 400 for POST /webhook without subscription', async () => {
		const resp = await worker.fetch('http://localhost:8787/webhook', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ invalid: 'payload' }),
		});

		expect(resp.status).toBe(400);
	});

	describe('Per-streamer isolation', () => {
		const STREAMER_A = 'isolation-streamer-a';
		const STREAMER_B = 'isolation-streamer-b';

		it('should maintain independent state for different streamers', async () => {
			// Capture baseline counts for both streamers
			const baselineRespA = await worker.fetch(`http://localhost:8787/webhook/${STREAMER_A}`, { method: 'GET' });
			const baselineA = await baselineRespA.json() as Record<string, number>;
			const baseFollowA = baselineA['channel.follow'] || 0;

			const baselineRespB = await worker.fetch(`http://localhost:8787/webhook/${STREAMER_B}`, { method: 'GET' });
			const baselineB = await baselineRespB.json() as Record<string, number>;
			const baseCheerB = baselineB['channel.cheer'] || 0;

			// Send events to streamer A
			await worker.fetch('http://localhost:8787/webhook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					subscription: { type: 'channel.follow' },
					event: { user_id: 'u1', internal_user_id: STREAMER_A },
				}),
			});

			await worker.fetch('http://localhost:8787/webhook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					subscription: { type: 'channel.follow' },
					event: { user_id: 'u2', internal_user_id: STREAMER_A },
				}),
			});

			// Send events to streamer B (different event type)
			await worker.fetch('http://localhost:8787/webhook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					subscription: { type: 'channel.cheer' },
					event: { bits: 500, internal_user_id: STREAMER_B },
				}),
			});

			// Verify streamer A got exactly 2 new follows and no new cheers
			const respA = await worker.fetch(`http://localhost:8787/webhook/${STREAMER_A}`, {
				method: 'GET',
			});
			const countsA = await respA.json() as Record<string, number>;
			expect(countsA['channel.follow']).toBe(baseFollowA + 2);
			expect(countsA['channel.cheer']).toBeUndefined();

			// Verify streamer B got exactly 1 new cheer and no follows
			const respB = await worker.fetch(`http://localhost:8787/webhook/${STREAMER_B}`, {
				method: 'GET',
			});
			const countsB = await respB.json() as Record<string, number>;
			expect(countsB['channel.cheer']).toBe(baseCheerB + 1);
			expect(countsB['channel.follow']).toBeUndefined();
		});

		it('should return independent telemetry for different streamers', async () => {
			const respA = await worker.fetch(`http://localhost:8787/telemetry/${STREAMER_A}`, {
				method: 'GET',
			});
			expect(respA.status).toBe(200);
			const telemetryA = await respA.json() as Record<string, unknown>;
			expect(telemetryA).toHaveProperty('energy');
			expect(telemetryA).toHaveProperty('mood');

			const respB = await worker.fetch(`http://localhost:8787/telemetry/${STREAMER_B}`, {
				method: 'GET',
			});
			expect(respB.status).toBe(200);
			const telemetryB = await respB.json() as Record<string, unknown>;
			expect(telemetryB).toHaveProperty('energy');
			expect(telemetryB).toHaveProperty('mood');
		});

		it('should return independent events for different streamers', async () => {
			const respA = await worker.fetch(`http://localhost:8787/events/${STREAMER_A}`, {
				method: 'GET',
			});
			const eventsA = await respA.json() as EventRecord[];
			expect(eventsA.every((e) => e.eventType === 'channel.follow')).toBe(true);

			const respB = await worker.fetch(`http://localhost:8787/events/${STREAMER_B}`, {
				method: 'GET',
			});
			const eventsB = await respB.json() as EventRecord[];
			expect(eventsB.every((e) => e.eventType === 'channel.cheer')).toBe(true);
		});
	});

	describe('CORS headers', () => {
		it('should return 204 with CORS headers for OPTIONS preflight', async () => {
			const resp = await worker.fetch(`http://localhost:8787/webhook/${STREAMER}`, {
				method: 'OPTIONS',
			});

			expect(resp.status).toBe(204);
			expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
			expect(resp.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
			expect(resp.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
		});

		it('should return CORS headers on GET responses', async () => {
			const resp = await worker.fetch(`http://localhost:8787/webhook/${STREAMER}`, {
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

		it('should return CORS headers on /telemetry/:streamerId endpoint', async () => {
			const resp = await worker.fetch(`http://localhost:8787/telemetry/${STREAMER}`, {
				method: 'GET',
			});

			expect(resp.status).toBe(200);
			expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
			expect(resp.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
		});

		it('should handle OPTIONS preflight on any path', async () => {
			const resp = await worker.fetch(`http://localhost:8787/telemetry/${STREAMER}`, {
				method: 'OPTIONS',
			});

			expect(resp.status).toBe(204);
			expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
		});
	});

	describe('WebSocket /ws/:streamerId endpoint', () => {
		it('should return 426 for non-upgrade requests to /ws/:streamerId', async () => {
			const resp = await worker.fetch(`http://localhost:8787/ws/${STREAMER}`, {
				method: 'GET',
			});
			expect(resp.status).toBe(426);
		});

		it('should accept WebSocket upgrade and receive telemetry', async () => {
			const ws = new WebSocket(`ws://${worker.address}:${worker.port}/ws/${STREAMER}`);

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
			const ws1 = new WebSocket(`ws://${worker.address}:${worker.port}/ws/${STREAMER}`);
			const ws2 = new WebSocket(`ws://${worker.address}:${worker.port}/ws/${STREAMER}`);

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

	describe('GET /events/:streamerId - recent events ring buffer', () => {
		it('should return events as JSON array', async () => {
			const resp = await worker.fetch(`http://localhost:8787/events/${STREAMER}`, {
				method: 'GET',
			});
			expect(resp.status).toBe(200);

			const events = await resp.json() as EventRecord[];
			expect(Array.isArray(events)).toBe(true);
		});

		it('should record events sent via POST /webhook', async () => {
			// Send a chat message event
			await worker.fetch('http://localhost:8787/webhook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					subscription: { type: 'channel.chat.message' },
					event: { user_id: 'u1', user_name: 'testuser', message: { text: 'hello' }, internal_user_id: STREAMER },
				}),
			});

			const resp = await worker.fetch(`http://localhost:8787/events/${STREAMER}`, {
				method: 'GET',
			});
			const events = await resp.json() as EventRecord[];

			// Find the event we just sent (it should be near the end)
			const chatEvents = events.filter(
				(e) => e.eventType === 'channel.chat.message' && e.userId === 'u1',
			);
			expect(chatEvents.length).toBeGreaterThanOrEqual(1);

			const lastChat = chatEvents[chatEvents.length - 1];
			expect(lastChat.category).toBe('message');
			expect(lastChat.timestamp).toBeGreaterThan(0);
			expect(lastChat.metadata).toBeDefined();
			expect(lastChat.metadata?.username).toBe('testuser');
		});

		it('should return events in chronological order (oldest first, newest last)', async () => {
			// Send two events sequentially
			await worker.fetch('http://localhost:8787/webhook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					subscription: { type: 'channel.subscribe' },
					event: { user_id: 'order1', user_name: 'first', tier: '1000', internal_user_id: STREAMER },
				}),
			});

			await worker.fetch('http://localhost:8787/webhook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					subscription: { type: 'channel.subscribe' },
					event: { user_id: 'order2', user_name: 'second', tier: '1000', internal_user_id: STREAMER },
				}),
			});

			const resp = await worker.fetch(`http://localhost:8787/events/${STREAMER}`, {
				method: 'GET',
			});
			const events = await resp.json() as EventRecord[];

			// Events should be in chronological order
			for (let i = 1; i < events.length; i++) {
				expect(events[i].timestamp).toBeGreaterThanOrEqual(events[i - 1].timestamp);
			}

			// Verify the ordering of our two specific events
			const idx1 = events.findIndex((e) => e.userId === 'order1');
			const idx2 = events.findIndex((e) => e.userId === 'order2');
			expect(idx1).toBeLessThan(idx2);
		});

		it('should include correct metadata for cheer events', async () => {
			await worker.fetch('http://localhost:8787/webhook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					subscription: { type: 'channel.cheer' },
					event: { user_id: 'cheerer1', user_name: 'BigSpender', bits: 500, internal_user_id: STREAMER },
				}),
			});

			const resp = await worker.fetch(`http://localhost:8787/events/${STREAMER}`, {
				method: 'GET',
			});
			const events = await resp.json() as EventRecord[];

			const cheerEvents = events.filter(
				(e) => e.eventType === 'channel.cheer' && e.userId === 'cheerer1',
			);
			expect(cheerEvents.length).toBeGreaterThanOrEqual(1);

			const lastCheer = cheerEvents[cheerEvents.length - 1];
			expect(lastCheer.category).toBe('high_value');
			expect(lastCheer.metadata?.username).toBe('BigSpender');
			expect(lastCheer.metadata?.amount).toBe(500);
		});

		it('should not grow beyond MAX_RECENT_EVENTS', async () => {
			// Use a dedicated streamer to avoid interference from other tests
			const overflowStreamer = 'overflow-streamer';

			// Send MAX_RECENT_EVENTS + 10 events
			const totalToSend = MAX_RECENT_EVENTS + 10;
			const promises = [];
			for (let i = 0; i < totalToSend; i++) {
				promises.push(
					worker.fetch('http://localhost:8787/webhook', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							subscription: { type: 'channel.chat.message' },
							event: { user_id: `overflow-${i}`, user_name: `user${i}`, internal_user_id: overflowStreamer },
						}),
					}),
				);
			}
			await Promise.all(promises);

			const resp = await worker.fetch(`http://localhost:8787/events/${overflowStreamer}`, {
				method: 'GET',
			});
			const events = await resp.json() as EventRecord[];

			expect(events.length).toBeLessThanOrEqual(MAX_RECENT_EVENTS);
		});
	});
});

// ============================================================================
// Unit tests for helper functions (no worker needed)
// ============================================================================

describe('categorizeEvent', () => {
	it('should categorize chat messages as "message"', () => {
		expect(categorizeEvent('channel.chat.message')).toBe('message');
	});

	it('should categorize subscriptions as "high_value"', () => {
		expect(categorizeEvent('channel.subscribe')).toBe('high_value');
		expect(categorizeEvent('channel.subscription.gift')).toBe('high_value');
		expect(categorizeEvent('channel.subscription.message')).toBe('high_value');
	});

	it('should categorize cheers as "high_value"', () => {
		expect(categorizeEvent('channel.cheer')).toBe('high_value');
	});

	it('should categorize raids as "high_value"', () => {
		expect(categorizeEvent('channel.raid')).toBe('high_value');
	});

	it('should categorize stream events as "lifecycle"', () => {
		expect(categorizeEvent('stream.online')).toBe('lifecycle');
		expect(categorizeEvent('stream.offline')).toBe('lifecycle');
	});

	it('should categorize unknown events as "interaction"', () => {
		expect(categorizeEvent('channel.follow')).toBe('interaction');
		expect(categorizeEvent('some.unknown.event')).toBe('interaction');
	});
});

describe('extractMetadata', () => {
	it('should return undefined when no eventData is provided', () => {
		expect(extractMetadata('channel.chat.message')).toBeUndefined();
	});

	it('should return undefined when eventData has no extractable fields', () => {
		expect(extractMetadata('channel.chat.message', { irrelevant: true })).toBeUndefined();
	});

	it('should extract username when present', () => {
		const meta = extractMetadata('channel.follow', { user_name: 'alice' });
		expect(meta).toEqual({ username: 'alice' });
	});

	it('should extract chat message text from nested message object', () => {
		const meta = extractMetadata('channel.chat.message', {
			user_name: 'bob',
			message: { text: 'Hello world!' },
		});
		expect(meta).toEqual({ username: 'bob', message: 'Hello world!' });
	});

	it('should extract chat message text from message_text field', () => {
		const meta = extractMetadata('channel.chat.message', {
			user_name: 'bob',
			message_text: 'Hello world!',
		});
		expect(meta).toEqual({ username: 'bob', message: 'Hello world!' });
	});

	it('should extract tier from subscription events', () => {
		const meta = extractMetadata('channel.subscribe', {
			user_name: 'alice',
			tier: '2000',
		});
		expect(meta).toEqual({ username: 'alice', tier: '2000' });
	});

	it('should extract tier and amount from gift sub events', () => {
		const meta = extractMetadata('channel.subscription.gift', {
			user_name: 'generous',
			tier: '1000',
			total: 5,
		});
		expect(meta).toEqual({ username: 'generous', tier: '1000', amount: 5 });
	});

	it('should extract bits from cheer events', () => {
		const meta = extractMetadata('channel.cheer', {
			user_name: 'cheerer',
			bits: 1000,
		});
		expect(meta).toEqual({ username: 'cheerer', amount: 1000 });
	});

	it('should extract raider name and viewer count from raid events', () => {
		const meta = extractMetadata('channel.raid', {
			from_broadcaster_user_name: 'raider_streamer',
			viewers: 250,
		});
		expect(meta).toEqual({ raider: 'raider_streamer', viewers: 250 });
	});
});

describe('createEventRecord', () => {
	it('should create a record with correct eventType and category', () => {
		const record = createEventRecord('channel.chat.message', {
			user_id: 'u1',
			user_name: 'alice',
		});

		expect(record.eventType).toBe('channel.chat.message');
		expect(record.category).toBe('message');
		expect(record.userId).toBe('u1');
		expect(record.timestamp).toBeGreaterThan(0);
		expect(record.metadata).toEqual({ username: 'alice' });
	});

	it('should omit userId when not present in event data', () => {
		const record = createEventRecord('stream.online', {});
		expect(record.userId).toBeUndefined();
	});

	it('should omit metadata when no extractable fields exist', () => {
		const record = createEventRecord('channel.follow', {});
		expect(record.metadata).toBeUndefined();
	});

	it('should match the EventRecord interface shape', () => {
		const record = createEventRecord('channel.cheer', {
			user_id: 'u5',
			user_name: 'cheerer',
			bits: 100,
		});

		// Verify required fields
		expect(typeof record.timestamp).toBe('number');
		expect(typeof record.eventType).toBe('string');
		expect(['message', 'high_value', 'interaction', 'lifecycle']).toContain(record.category);

		// Verify optional fields are the right types when present
		if (record.userId !== undefined) {
			expect(typeof record.userId).toBe('string');
		}
		if (record.metadata !== undefined) {
			expect(typeof record.metadata).toBe('object');
			for (const [key, value] of Object.entries(record.metadata)) {
				expect(typeof key).toBe('string');
				expect(['string', 'number']).toContain(typeof value);
			}
		}
	});
});

describe('appendToRingBuffer', () => {
	it('should append a record to the buffer', () => {
		const buffer: EventRecord[] = [];
		const record = createEventRecord('channel.chat.message', { user_id: 'u1' });
		const result = appendToRingBuffer(buffer, record);

		expect(result.length).toBe(1);
		expect(result[0]).toBe(record);
	});

	it('should trim to max size when buffer exceeds limit', () => {
		const maxSize = 5;
		let buffer: EventRecord[] = [];

		// Add maxSize + 1 records
		for (let i = 0; i < maxSize + 1; i++) {
			const record = createEventRecord('channel.chat.message', { user_id: `u${i}` });
			buffer = appendToRingBuffer(buffer, record, maxSize);
		}

		expect(buffer.length).toBe(maxSize);
		// The first record (u0) should have been evicted
		expect(buffer[0].userId).toBe('u1');
		expect(buffer[buffer.length - 1].userId).toBe(`u${maxSize}`);
	});

	it('should keep newest events when trimming', () => {
		const maxSize = 3;
		let buffer: EventRecord[] = [];

		for (let i = 0; i < 10; i++) {
			const record = createEventRecord('channel.chat.message', { user_id: `u${i}` });
			buffer = appendToRingBuffer(buffer, record, maxSize);
		}

		expect(buffer.length).toBe(maxSize);
		expect(buffer.map((e) => e.userId)).toEqual(['u7', 'u8', 'u9']);
	});

	it('should use MAX_RECENT_EVENTS as default max size', () => {
		let buffer: EventRecord[] = [];

		for (let i = 0; i < MAX_RECENT_EVENTS + 5; i++) {
			const record = createEventRecord('channel.chat.message', { user_id: `u${i}` });
			buffer = appendToRingBuffer(buffer, record);
		}

		expect(buffer.length).toBe(MAX_RECENT_EVENTS);
	});
});
