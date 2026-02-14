import { describe, it, expect } from 'vitest';
import { extractTwitchUserId } from './extract';

describe('extractTwitchUserId', () => {
	it('extracts user_id from chat message events', () => {
		const event = {
			user_id: '11111',
			user_name: 'chatter',
			broadcaster_user_id: '99999',
			message: { text: 'hello' },
		};
		expect(extractTwitchUserId(event)).toBe('11111');
	});

	it('extracts broadcaster_user_id from stream.online events', () => {
		const event = {
			id: '9001',
			broadcaster_user_id: '12345',
			broadcaster_user_login: 'streamer',
			broadcaster_user_name: 'Streamer',
			type: 'live',
			started_at: '2026-01-01T00:00:00Z',
		};
		expect(extractTwitchUserId(event)).toBe('12345');
	});

	it('extracts broadcaster_user_id from stream.offline events', () => {
		const event = {
			broadcaster_user_id: '12345',
			broadcaster_user_login: 'streamer',
			broadcaster_user_name: 'Streamer',
		};
		expect(extractTwitchUserId(event)).toBe('12345');
	});

	it('extracts to_broadcaster_user_id from gift sub events', () => {
		const event = {
			to_broadcaster_user_id: '77777',
			to_broadcaster_user_login: 'recipient',
		};
		expect(extractTwitchUserId(event)).toBe('77777');
	});

	it('prefers user_id over broadcaster_user_id', () => {
		const event = {
			user_id: '11111',
			broadcaster_user_id: '22222',
		};
		expect(extractTwitchUserId(event)).toBe('11111');
	});

	it('returns default_user for undefined event', () => {
		expect(extractTwitchUserId(undefined)).toBe('default_user');
	});

	it('returns default_user for empty event', () => {
		expect(extractTwitchUserId({})).toBe('default_user');
	});
});
