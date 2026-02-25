import type { EventCategory, EventRecord } from '@streamlings/shared/types';

/** Maximum number of events retained in the ring buffer */
export const MAX_RECENT_EVENTS = 200;

/**
 * Event type categories for activity metrics.
 *
 * Re-exported from the module-level constant in index.ts so that the
 * categorization logic can be unit-tested without importing the
 * DurableObject class (which depends on cloudflare:workers).
 */
const EVENT_CATEGORIES = {
	MESSAGE: ['channel.chat.message'] as string[],
	HIGH_VALUE: [
		'channel.subscribe',
		'channel.subscription.gift',
		'channel.subscription.message',
		'channel.cheer',
		'channel.raid',
	] as string[],
	LIFECYCLE: [
		'stream.online',
		'stream.offline',
	] as string[],
};

/**
 * Determine the EventCategory for a given event type string
 */
export function categorizeEvent(eventType: string): EventCategory {
	if (EVENT_CATEGORIES.MESSAGE.includes(eventType)) return 'message';
	if (EVENT_CATEGORIES.HIGH_VALUE.includes(eventType)) return 'high_value';
	if (EVENT_CATEGORIES.LIFECYCLE.includes(eventType)) return 'lifecycle';
	return 'interaction';
}

/**
 * Extract relevant metadata from event data based on event type
 */
export function extractMetadata(
	eventType: string,
	eventData?: Record<string, unknown>,
): Record<string, string | number> | undefined {
	if (!eventData) return undefined;

	const metadata: Record<string, string | number> = {};

	// Username is commonly available across event types
	if (typeof eventData.user_name === 'string') {
		metadata.username = eventData.user_name;
	}

	// Chat messages
	if (eventType === 'channel.chat.message') {
		if (typeof eventData.message_text === 'string') {
			metadata.message = eventData.message_text;
		} else if (
			eventData.message &&
			typeof eventData.message === 'object' &&
			(eventData.message as Record<string, unknown>).text &&
			typeof (eventData.message as Record<string, unknown>).text === 'string'
		) {
			metadata.message = (eventData.message as Record<string, unknown>).text as string;
		}
	}

	// Subscriptions
	if (
		eventType === 'channel.subscribe' ||
		eventType === 'channel.subscription.message'
	) {
		if (typeof eventData.tier === 'string') {
			metadata.tier = eventData.tier;
		}
	}

	// Gift subs
	if (eventType === 'channel.subscription.gift') {
		if (typeof eventData.tier === 'string') {
			metadata.tier = eventData.tier;
		}
		if (typeof eventData.total === 'number') {
			metadata.amount = eventData.total;
		}
	}

	// Cheers / bits
	if (eventType === 'channel.cheer') {
		if (typeof eventData.bits === 'number') {
			metadata.amount = eventData.bits;
		}
	}

	// Raids
	if (eventType === 'channel.raid') {
		if (typeof eventData.from_broadcaster_user_name === 'string') {
			metadata.raider = eventData.from_broadcaster_user_name;
		}
		if (typeof eventData.viewers === 'number') {
			metadata.viewers = eventData.viewers;
		}
	}

	return Object.keys(metadata).length > 0 ? metadata : undefined;
}

/**
 * Create an EventRecord from an event type and optional event data
 */
export function createEventRecord(
	eventType: string,
	eventData?: Record<string, unknown>,
): EventRecord {
	return {
		timestamp: Date.now(),
		eventType,
		category: categorizeEvent(eventType),
		...(eventData?.user_id ? { userId: String(eventData.user_id) } : {}),
		...(() => {
			const meta = extractMetadata(eventType, eventData);
			return meta ? { metadata: meta } : {};
		})(),
	};
}

/**
 * Append a record to the ring buffer, trimming to max size
 */
export function appendToRingBuffer(
	buffer: EventRecord[],
	record: EventRecord,
	maxSize: number = MAX_RECENT_EVENTS,
): EventRecord[] {
	buffer.push(record);

	if (buffer.length > maxSize) {
		return buffer.slice(buffer.length - maxSize);
	}

	return buffer;
}
