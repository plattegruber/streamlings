import { describe, it, expect } from 'vitest';
import { computeHmacSha256, timingSafeEqual, verifyTwitchSignature } from '../src/verify';

describe('computeHmacSha256', () => {
	it('should produce a valid hex-encoded HMAC-SHA256', async () => {
		// Known test vector: HMAC-SHA256("key", "message")
		const result = await computeHmacSha256('key', 'message');
		// Expected value from RFC 4231 / standard HMAC-SHA256 implementations
		expect(result).toBe(
			'6e9ef29b75fffc5b7abae527d58fdadb2fe42e7219011976917343065f58ed4a',
		);
	});

	it('should produce different outputs for different secrets', async () => {
		const a = await computeHmacSha256('secret-a', 'same-data');
		const b = await computeHmacSha256('secret-b', 'same-data');
		expect(a).not.toBe(b);
	});

	it('should produce different outputs for different data', async () => {
		const a = await computeHmacSha256('same-secret', 'data-a');
		const b = await computeHmacSha256('same-secret', 'data-b');
		expect(a).not.toBe(b);
	});

	it('should handle empty data', async () => {
		const result = await computeHmacSha256('secret', '');
		expect(result).toHaveLength(64); // SHA-256 = 32 bytes = 64 hex chars
	});
});

describe('timingSafeEqual', () => {
	it('should return true for identical strings', () => {
		expect(timingSafeEqual('abc', 'abc')).toBe(true);
	});

	it('should return false for different strings of the same length', () => {
		expect(timingSafeEqual('abc', 'abd')).toBe(false);
	});

	it('should return false for strings of different length', () => {
		expect(timingSafeEqual('short', 'longer-string')).toBe(false);
	});

	it('should return true for empty strings', () => {
		expect(timingSafeEqual('', '')).toBe(true);
	});

	it('should return false when one string is empty', () => {
		expect(timingSafeEqual('', 'notempty')).toBe(false);
	});
});

describe('verifyTwitchSignature', () => {
	const secret = 'test-webhook-secret';
	const messageId = 'msg-id-123';
	const body = '{"subscription":{"type":"channel.chat.message"},"event":{}}';

	/**
	 * Helper: build valid headers with a correctly computed signature.
	 */
	async function makeValidHeaders(
		timestamp: string,
		rawBody: string = body,
	): Promise<Headers> {
		const hmacMessage = messageId + timestamp + rawBody;
		const hex = await computeHmacSha256(secret, hmacMessage);

		return new Headers({
			'twitch-eventsub-message-id': messageId,
			'twitch-eventsub-message-timestamp': timestamp,
			'twitch-eventsub-message-signature': `sha256=${hex}`,
		});
	}

	it('should accept a valid signature', async () => {
		const now = new Date('2026-01-15T12:00:00Z');
		const timestamp = '2026-01-15T11:55:00Z'; // 5 minutes ago — within window
		const headers = await makeValidHeaders(timestamp);

		const result = await verifyTwitchSignature(headers, body, secret, now);
		expect(result.valid).toBe(true);
		expect(result.error).toBeUndefined();
	});

	it('should reject when message-id header is missing', async () => {
		const now = new Date('2026-01-15T12:00:00Z');
		const headers = new Headers({
			'twitch-eventsub-message-timestamp': '2026-01-15T11:55:00Z',
			'twitch-eventsub-message-signature': 'sha256=deadbeef',
		});

		const result = await verifyTwitchSignature(headers, body, secret, now);
		expect(result.valid).toBe(false);
		expect(result.error).toContain('Missing required');
	});

	it('should reject when timestamp header is missing', async () => {
		const now = new Date('2026-01-15T12:00:00Z');
		const headers = new Headers({
			'twitch-eventsub-message-id': messageId,
			'twitch-eventsub-message-signature': 'sha256=deadbeef',
		});

		const result = await verifyTwitchSignature(headers, body, secret, now);
		expect(result.valid).toBe(false);
		expect(result.error).toContain('Missing required');
	});

	it('should reject when signature header is missing', async () => {
		const now = new Date('2026-01-15T12:00:00Z');
		const headers = new Headers({
			'twitch-eventsub-message-id': messageId,
			'twitch-eventsub-message-timestamp': '2026-01-15T11:55:00Z',
		});

		const result = await verifyTwitchSignature(headers, body, secret, now);
		expect(result.valid).toBe(false);
		expect(result.error).toContain('Missing required');
	});

	it('should reject a stale timestamp (older than 10 minutes)', async () => {
		const now = new Date('2026-01-15T12:00:00Z');
		const timestamp = '2026-01-15T11:49:59Z'; // 10 min 1 sec ago
		const headers = await makeValidHeaders(timestamp);

		const result = await verifyTwitchSignature(headers, body, secret, now);
		expect(result.valid).toBe(false);
		expect(result.error).toContain('too old');
	});

	it('should accept a timestamp exactly at the 10-minute boundary', async () => {
		const now = new Date('2026-01-15T12:00:00Z');
		const timestamp = '2026-01-15T11:50:00Z'; // exactly 10 minutes ago
		const headers = await makeValidHeaders(timestamp);

		const result = await verifyTwitchSignature(headers, body, secret, now);
		expect(result.valid).toBe(true);
	});

	it('should reject an invalid timestamp string', async () => {
		const now = new Date('2026-01-15T12:00:00Z');
		const headers = new Headers({
			'twitch-eventsub-message-id': messageId,
			'twitch-eventsub-message-timestamp': 'not-a-date',
			'twitch-eventsub-message-signature': 'sha256=deadbeef',
		});

		const result = await verifyTwitchSignature(headers, body, secret, now);
		expect(result.valid).toBe(false);
		expect(result.error).toContain('Invalid timestamp');
	});

	it('should reject a wrong signature', async () => {
		const now = new Date('2026-01-15T12:00:00Z');
		const timestamp = '2026-01-15T11:55:00Z';
		const headers = new Headers({
			'twitch-eventsub-message-id': messageId,
			'twitch-eventsub-message-timestamp': timestamp,
			'twitch-eventsub-message-signature': 'sha256=0000000000000000000000000000000000000000000000000000000000000000',
		});

		const result = await verifyTwitchSignature(headers, body, secret, now);
		expect(result.valid).toBe(false);
		expect(result.error).toContain('Signature mismatch');
	});

	it('should reject a signature computed with the wrong secret', async () => {
		const now = new Date('2026-01-15T12:00:00Z');
		const timestamp = '2026-01-15T11:55:00Z';
		const hmacMessage = messageId + timestamp + body;
		const wrongHex = await computeHmacSha256('wrong-secret', hmacMessage);

		const headers = new Headers({
			'twitch-eventsub-message-id': messageId,
			'twitch-eventsub-message-timestamp': timestamp,
			'twitch-eventsub-message-signature': `sha256=${wrongHex}`,
		});

		const result = await verifyTwitchSignature(headers, body, secret, now);
		expect(result.valid).toBe(false);
		expect(result.error).toContain('Signature mismatch');
	});

	it('should reject when body has been tampered with', async () => {
		const now = new Date('2026-01-15T12:00:00Z');
		const timestamp = '2026-01-15T11:55:00Z';
		const headers = await makeValidHeaders(timestamp, body);

		// Verify with a different body than what was signed
		const tamperedBody = '{"subscription":{"type":"channel.chat.message"},"event":{"hacked":true}}';
		const result = await verifyTwitchSignature(headers, tamperedBody, secret, now);
		expect(result.valid).toBe(false);
		expect(result.error).toContain('Signature mismatch');
	});
});
