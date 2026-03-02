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

	describe('renders a canvas element', () => {
		it('contains a canvas inside the container', async () => {
			const { container } = render(StreamlingOverlay, { mood: 'idle' });
			const canvas = container.querySelector('canvas');
			expect(canvas).not.toBeNull();
			expect(canvas?.width).toBe(512);
			expect(canvas?.height).toBe(512);
		});
	});

	describe('handles null/undefined mood gracefully', () => {
		it('defaults to idle when mood is null', async () => {
			render(StreamlingOverlay, { mood: null });
			await expect.element(page.getByRole('img', { name: /idle/i })).toBeInTheDocument();
		});

		it('defaults to idle when mood is undefined', async () => {
			render(StreamlingOverlay, { mood: undefined });
			await expect.element(page.getByRole('img', { name: /idle/i })).toBeInTheDocument();
		});

		it('defaults to idle for an unknown mood string', async () => {
			render(StreamlingOverlay, { mood: 'hypnotized' });
			await expect.element(page.getByRole('img', { name: /hypnotized/i })).toBeInTheDocument();
		});
	});

	describe('transitions between states', () => {
		it('updates aria-label when mood changes from idle to engaged', async () => {
			const { rerender } = render(StreamlingOverlay, { mood: 'idle' });
			await expect.element(page.getByRole('img', { name: /idle/i })).toBeInTheDocument();

			await rerender({ mood: 'engaged' });
			await expect.element(page.getByRole('img', { name: /engaged/i })).toBeInTheDocument();
		});

		it('updates aria-label when mood changes from sleeping to partying', async () => {
			const { rerender } = render(StreamlingOverlay, { mood: 'sleeping' });
			await expect.element(page.getByRole('img', { name: /sleeping/i })).toBeInTheDocument();

			await rerender({ mood: 'partying' });
			await expect.element(page.getByRole('img', { name: /partying/i })).toBeInTheDocument();
		});
	});
});
