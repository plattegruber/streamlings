import { page } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import StreamlingOverlay from './StreamlingOverlay.svelte';

describe('StreamlingOverlay', () => {
	describe('renders for each mood state', () => {
		it('renders with sleeping mood', async () => {
			render(StreamlingOverlay, { mood: 'sleeping' });
			await expect.element(page.getByRole('img', { name: /sleeping/i })).toBeInTheDocument();
		});

		it('renders with idle mood', async () => {
			render(StreamlingOverlay, { mood: 'idle' });
			await expect.element(page.getByRole('img', { name: /idle/i })).toBeInTheDocument();
		});

		it('renders with engaged mood', async () => {
			render(StreamlingOverlay, { mood: 'engaged' });
			await expect.element(page.getByRole('img', { name: /engaged/i })).toBeInTheDocument();
		});

		it('renders with partying mood', async () => {
			render(StreamlingOverlay, { mood: 'partying' });
			await expect.element(page.getByRole('img', { name: /partying/i })).toBeInTheDocument();
		});
	});

	describe('applies distinct CSS classes for each mood state', () => {
		it('applies mood-sleeping class for sleeping state', async () => {
			const { container } = render(StreamlingOverlay, { mood: 'sleeping' });
			const el = container.querySelector('[data-testid="streamling-overlay"]');
			expect(el).not.toBeNull();
			expect(/** @type {HTMLElement} */ (el).classList.contains('mood-sleeping')).toBe(true);
		});

		it('applies mood-idle class for idle state', async () => {
			const { container } = render(StreamlingOverlay, { mood: 'idle' });
			const el = container.querySelector('[data-testid="streamling-overlay"]');
			expect(el).not.toBeNull();
			expect(/** @type {HTMLElement} */ (el).classList.contains('mood-idle')).toBe(true);
		});

		it('applies mood-engaged class for engaged state', async () => {
			const { container } = render(StreamlingOverlay, { mood: 'engaged' });
			const el = container.querySelector('[data-testid="streamling-overlay"]');
			expect(el).not.toBeNull();
			expect(/** @type {HTMLElement} */ (el).classList.contains('mood-engaged')).toBe(true);
		});

		it('applies mood-partying class for partying state', async () => {
			const { container } = render(StreamlingOverlay, { mood: 'partying' });
			const el = container.querySelector('[data-testid="streamling-overlay"]');
			expect(el).not.toBeNull();
			expect(/** @type {HTMLElement} */ (el).classList.contains('mood-partying')).toBe(true);
		});
	});

	describe('mood-specific visual elements', () => {
		it('shows zzz particles for sleeping mood', async () => {
			const { container } = render(StreamlingOverlay, { mood: 'sleeping' });
			const zzz = container.querySelector('.zzz-container');
			expect(zzz).not.toBeNull();
		});

		it('does not show zzz particles for idle mood', async () => {
			const { container } = render(StreamlingOverlay, { mood: 'idle' });
			const zzz = container.querySelector('.zzz-container');
			expect(zzz).toBeNull();
		});

		it('shows sparkle particles for partying mood', async () => {
			const { container } = render(StreamlingOverlay, { mood: 'partying' });
			const sparkles = container.querySelector('.sparkle-container');
			expect(sparkles).not.toBeNull();
		});

		it('does not show sparkle particles for engaged mood', async () => {
			const { container } = render(StreamlingOverlay, { mood: 'engaged' });
			const sparkles = container.querySelector('.sparkle-container');
			expect(sparkles).toBeNull();
		});
	});

	describe('transitions between states', () => {
		it('changes class when mood changes from idle to engaged', async () => {
			const { container, rerender } = render(StreamlingOverlay, { mood: 'idle' });
			const el = container.querySelector('[data-testid="streamling-overlay"]');
			expect(/** @type {HTMLElement} */ (el).classList.contains('mood-idle')).toBe(true);

			await rerender({ mood: 'engaged' });
			expect(/** @type {HTMLElement} */ (el).classList.contains('mood-engaged')).toBe(true);
			expect(/** @type {HTMLElement} */ (el).classList.contains('mood-idle')).toBe(false);
		});

		it('changes class when mood changes from sleeping to partying', async () => {
			const { container, rerender } = render(StreamlingOverlay, { mood: 'sleeping' });
			const el = container.querySelector('[data-testid="streamling-overlay"]');
			expect(/** @type {HTMLElement} */ (el).classList.contains('mood-sleeping')).toBe(true);

			await rerender({ mood: 'partying' });
			expect(/** @type {HTMLElement} */ (el).classList.contains('mood-partying')).toBe(true);
			expect(/** @type {HTMLElement} */ (el).classList.contains('mood-sleeping')).toBe(false);
		});
	});

	describe('handles null/undefined mood gracefully', () => {
		it('defaults to idle when mood is null', async () => {
			const { container } = render(StreamlingOverlay, { mood: null });
			const el = container.querySelector('[data-testid="streamling-overlay"]');
			expect(el).not.toBeNull();
			expect(/** @type {HTMLElement} */ (el).classList.contains('mood-idle')).toBe(true);
		});

		it('defaults to idle when mood is undefined', async () => {
			const { container } = render(StreamlingOverlay, { mood: undefined });
			const el = container.querySelector('[data-testid="streamling-overlay"]');
			expect(el).not.toBeNull();
			expect(/** @type {HTMLElement} */ (el).classList.contains('mood-idle')).toBe(true);
		});

		it('defaults to idle for an unknown mood string', async () => {
			const { container } = render(StreamlingOverlay, { mood: 'hypnotized' });
			const el = container.querySelector('[data-testid="streamling-overlay"]');
			expect(el).not.toBeNull();
			expect(/** @type {HTMLElement} */ (el).classList.contains('mood-idle')).toBe(true);
		});
	});
});
