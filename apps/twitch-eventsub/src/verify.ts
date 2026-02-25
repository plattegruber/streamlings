/**
 * Twitch EventSub webhook signature verification.
 *
 * Twitch signs every EventSub webhook delivery with HMAC-SHA256.
 * This module verifies that signature using the Web Crypto API
 * (required for Cloudflare Workers — no Node.js crypto).
 *
 * @see https://dev.twitch.tv/docs/eventsub/handling-webhook-events/#verifying-the-event-message
 */

/** Maximum age (in milliseconds) before a webhook timestamp is considered stale. */
const MAX_MESSAGE_AGE_MS = 10 * 60 * 1000; // 10 minutes

/** Required Twitch EventSub headers (lowercased for comparison). */
const HEADER_MESSAGE_ID = 'twitch-eventsub-message-id';
const HEADER_MESSAGE_TIMESTAMP = 'twitch-eventsub-message-timestamp';
const HEADER_MESSAGE_SIGNATURE = 'twitch-eventsub-message-signature';

export interface VerificationResult {
	valid: boolean;
	error?: string;
}

/**
 * Compute the HMAC-SHA256 of `data` using `secret`, returning a hex string.
 *
 * Uses the Web Crypto API so this works in Cloudflare Workers (no Node.js
 * crypto required).
 */
export async function computeHmacSha256(secret: string, data: string): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);
	const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
	return Array.from(new Uint8Array(signature))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/**
 * Timing-safe comparison of two strings.
 *
 * Uses Web Crypto's `timingSafeEqual`-equivalent approach by comparing
 * fixed-length byte arrays to prevent timing side-channel attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
	const encoder = new TextEncoder();
	const bufA = encoder.encode(a);
	const bufB = encoder.encode(b);

	if (bufA.byteLength !== bufB.byteLength) {
		return false;
	}

	// XOR every byte and accumulate — constant-time for equal-length inputs
	let result = 0;
	for (let i = 0; i < bufA.byteLength; i++) {
		result |= bufA[i] ^ bufB[i];
	}
	return result === 0;
}

/**
 * Verify a Twitch EventSub webhook signature.
 *
 * Checks that:
 * 1. All required headers are present
 * 2. The timestamp is not stale (older than 10 minutes)
 * 3. The HMAC-SHA256 signature matches
 *
 * @param headers  - The incoming request headers
 * @param rawBody  - The raw request body as a string (must match exactly what Twitch signed)
 * @param secret   - The webhook secret shared with Twitch
 * @param now      - Current time (injectable for testing)
 */
export async function verifyTwitchSignature(
	headers: Headers,
	rawBody: string,
	secret: string,
	now: Date = new Date(),
): Promise<VerificationResult> {
	const messageId = headers.get(HEADER_MESSAGE_ID);
	const timestamp = headers.get(HEADER_MESSAGE_TIMESTAMP);
	const signature = headers.get(HEADER_MESSAGE_SIGNATURE);

	// All three headers are required
	if (!messageId || !timestamp || !signature) {
		return { valid: false, error: 'Missing required Twitch EventSub headers' };
	}

	// Reject stale timestamps
	const messageTime = new Date(timestamp);
	if (isNaN(messageTime.getTime())) {
		return { valid: false, error: 'Invalid timestamp header' };
	}
	if (now.getTime() - messageTime.getTime() > MAX_MESSAGE_AGE_MS) {
		return { valid: false, error: 'Message timestamp is too old' };
	}

	// Compute expected signature: HMAC-SHA256(secret, message_id + timestamp + body)
	const hmacMessage = messageId + timestamp + rawBody;
	const expectedHex = await computeHmacSha256(secret, hmacMessage);
	const expectedSignature = `sha256=${expectedHex}`;

	// Timing-safe comparison
	if (!timingSafeEqual(expectedSignature, signature)) {
		return { valid: false, error: 'Signature mismatch' };
	}

	return { valid: true };
}
