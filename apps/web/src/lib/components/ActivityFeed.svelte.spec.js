import { page } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ActivityFeed from './ActivityFeed.svelte';

/**
 * Helper to create an event record with sensible defaults.
 * @param {Partial<import('@streamlings/shared/types').EventRecord>} [overrides]
 * @returns {import('@streamlings/shared/types').EventRecord}
 */
function mockEvent(overrides = {}) {
	return {
		timestamp: Date.now() - 5000,
		eventType: 'channel.chat.message',
		category: /** @type {import('@streamlings/shared/types').EventCategory} */ ('message'),
		...overrides
	};
}

/**
 * Helper to wrap props for vitest-browser-svelte render.
 *
 * The `events` prop name collides with the Svelte mount option of the same name,
 * so we must explicitly nest props under the `props` key.
 *
 * @param {import('@streamlings/shared/types').EventRecord[]} events
 */
function withProps(events) {
	return { props: { events } };
}

describe('ActivityFeed', () => {
	describe('empty state', () => {
		it('shows "No events yet" when events array is empty', async () => {
			render(ActivityFeed, withProps([]));
			await expect.element(page.getByText('No events yet')).toBeInTheDocument();
		});

		it('does not render any event rows when empty', async () => {
			const { container } = render(ActivityFeed, withProps([]));
			const rows = container.querySelectorAll('[data-testid="event-row"]');
			expect(rows.length).toBe(0);
		});
	});

	describe('event rendering', () => {
		it('renders event rows for each event', async () => {
			const events = [
				mockEvent({ timestamp: Date.now() - 2000 }),
				mockEvent({
					timestamp: Date.now() - 10000,
					eventType: 'channel.subscribe',
					category: 'high_value'
				})
			];
			const { container } = render(ActivityFeed, withProps(events));
			const rows = container.querySelectorAll('[data-testid="event-row"]');
			expect(rows.length).toBe(2);
		});

		it('displays username from metadata when available', async () => {
			const events = [
				mockEvent({
					metadata: { username: 'testuser123', message: 'Hello world' }
				})
			];
			render(ActivityFeed, withProps(events));
			await expect.element(page.getByText('testuser123')).toBeInTheDocument();
		});

		it('displays message text from metadata', async () => {
			const events = [
				mockEvent({
					metadata: { username: 'chatter', message: 'Great stream!' }
				})
			];
			render(ActivityFeed, withProps(events));
			await expect.element(page.getByText('Great stream!')).toBeInTheDocument();
		});

		it('displays bits amount for cheer events', async () => {
			const events = [
				mockEvent({
					eventType: 'channel.cheer',
					category: 'high_value',
					metadata: { username: 'generous', amount: 500 }
				})
			];
			render(ActivityFeed, withProps(events));
			await expect.element(page.getByText('500 bits')).toBeInTheDocument();
		});

		it('displays tier for subscription events', async () => {
			const events = [
				mockEvent({
					eventType: 'channel.subscribe',
					category: 'high_value',
					metadata: { username: 'newsub', tier: '1000' }
				})
			];
			render(ActivityFeed, withProps(events));
			await expect.element(page.getByText('Tier 1000')).toBeInTheDocument();
		});

		it('displays raid info for raid events', async () => {
			const events = [
				mockEvent({
					eventType: 'channel.raid',
					category: 'high_value',
					metadata: { raider: 'bigstreamer', viewers: 150 }
				})
			];
			render(ActivityFeed, withProps(events));
			await expect
				.element(page.getByText('Raid from bigstreamer (150 viewers)'))
				.toBeInTheDocument();
		});

		it('falls back to eventType when no metadata is present', async () => {
			const events = [
				mockEvent({
					eventType: 'channel.follow',
					category: 'interaction',
					metadata: undefined
				})
			];
			render(ActivityFeed, withProps(events));
			await expect.element(page.getByText('channel.follow')).toBeInTheDocument();
		});
	});

	describe('relative timestamps', () => {
		it('displays seconds-ago for recent events', async () => {
			const events = [mockEvent({ timestamp: Date.now() - 5000 })];
			render(ActivityFeed, withProps(events));
			await expect.element(page.getByText('5s ago')).toBeInTheDocument();
		});

		it('displays minutes-ago for older events', async () => {
			const events = [mockEvent({ timestamp: Date.now() - 120_000 })];
			render(ActivityFeed, withProps(events));
			await expect.element(page.getByText('2m ago')).toBeInTheDocument();
		});

		it('displays hours-ago for much older events', async () => {
			const events = [mockEvent({ timestamp: Date.now() - 7_200_000 })];
			render(ActivityFeed, withProps(events));
			await expect.element(page.getByText('2h ago')).toBeInTheDocument();
		});
	});

	describe('category styling', () => {
		it('applies gray styling for message category', async () => {
			const events = [mockEvent({ category: 'message' })];
			const { container } = render(ActivityFeed, withProps(events));
			const row = container.querySelector('[data-category="message"]');
			expect(row).not.toBeNull();
			expect(row?.classList.contains('bg-gray-50')).toBe(true);
			expect(row?.classList.contains('border-gray-200')).toBe(true);
		});

		it('applies amber styling for high_value category', async () => {
			const events = [mockEvent({ eventType: 'channel.subscribe', category: 'high_value' })];
			const { container } = render(ActivityFeed, withProps(events));
			const row = container.querySelector('[data-category="high_value"]');
			expect(row).not.toBeNull();
			expect(row?.classList.contains('bg-amber-50')).toBe(true);
			expect(row?.classList.contains('border-amber-200')).toBe(true);
		});

		it('applies blue styling for interaction category', async () => {
			const events = [mockEvent({ eventType: 'channel.follow', category: 'interaction' })];
			const { container } = render(ActivityFeed, withProps(events));
			const row = container.querySelector('[data-category="interaction"]');
			expect(row).not.toBeNull();
			expect(row?.classList.contains('bg-blue-50')).toBe(true);
			expect(row?.classList.contains('border-blue-200')).toBe(true);
		});

		it('applies emerald styling for lifecycle category', async () => {
			const events = [mockEvent({ eventType: 'stream.online', category: 'lifecycle' })];
			const { container } = render(ActivityFeed, withProps(events));
			const row = container.querySelector('[data-category="lifecycle"]');
			expect(row).not.toBeNull();
			expect(row?.classList.contains('bg-emerald-50')).toBe(true);
			expect(row?.classList.contains('border-emerald-200')).toBe(true);
		});
	});

	describe('event ordering', () => {
		it('displays events in newest-first order', async () => {
			const events = [
				mockEvent({
					timestamp: Date.now() - 60_000,
					metadata: { username: 'older_user', message: 'first message' }
				}),
				mockEvent({
					timestamp: Date.now() - 1000,
					metadata: { username: 'newer_user', message: 'second message' }
				})
			];
			const { container } = render(ActivityFeed, withProps(events));
			const rows = container.querySelectorAll('[data-testid="event-row"]');
			expect(rows.length).toBe(2);

			// First row should contain the newer event
			expect(rows[0].textContent).toContain('newer_user');
			// Second row should contain the older event
			expect(rows[1].textContent).toContain('older_user');
		});
	});
});
