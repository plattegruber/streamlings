import { page } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import InternalDrives from './InternalDrives.svelte';

describe('InternalDrives', () => {
	const defaultProps = {
		sleepPressure: 0.4,
		restedness: 0.8,
		exhaustion: 0.1,
		curiosity: 0.55
	};

	it('renders the section heading', async () => {
		render(InternalDrives, defaultProps);
		await expect.element(page.getByText('Internal drives')).toBeInTheDocument();
	});

	it('renders all four drive labels', async () => {
		render(InternalDrives, defaultProps);
		await expect.element(page.getByText('Sleep pressure')).toBeInTheDocument();
		await expect.element(page.getByText('Restedness')).toBeInTheDocument();
		await expect.element(page.getByText('Exhaustion')).toBeInTheDocument();
		await expect.element(page.getByText('Curiosity')).toBeInTheDocument();
	});

	it('renders correct percentage values', async () => {
		render(InternalDrives, defaultProps);
		await expect.element(page.getByText('40%')).toBeInTheDocument();
		await expect.element(page.getByText('80%')).toBeInTheDocument();
		await expect.element(page.getByText('10%')).toBeInTheDocument();
		await expect.element(page.getByText('55%')).toBeInTheDocument();
	});

	it('renders four drive bars', async () => {
		const { container } = render(InternalDrives, defaultProps);
		const bars = container.querySelectorAll('[data-testid="internal-drives"] .bg-gray-200');
		expect(bars.length).toBe(4);
	});

	describe('edge values', () => {
		it('handles all drives at zero', async () => {
			render(InternalDrives, {
				sleepPressure: 0,
				restedness: 0,
				exhaustion: 0,
				curiosity: 0
			});
			// All four drives should show 0%
			const elements = page.getByText('0%');
			await expect.element(elements.first()).toBeInTheDocument();
		});

		it('handles all drives at maximum (1.0)', async () => {
			render(InternalDrives, {
				sleepPressure: 1.0,
				restedness: 1.0,
				exhaustion: 1.0,
				curiosity: 1.0
			});
			const elements = page.getByText('100%');
			await expect.element(elements.first()).toBeInTheDocument();
		});

		it('renders 0% bar width for zero-value drives', async () => {
			const { container } = render(InternalDrives, {
				sleepPressure: 0,
				restedness: 0.5,
				exhaustion: 0,
				curiosity: 0
			});
			const driveBars = container.querySelectorAll(
				'[data-testid="internal-drives"] .bg-gray-200 > div'
			);
			// First bar (sleep pressure) should have 0% width
			expect(/** @type {HTMLElement} */ (driveBars[0]).style.width).toBe('0%');
		});

		it('renders 100% bar width for max-value drives', async () => {
			const { container } = render(InternalDrives, {
				sleepPressure: 1.0,
				restedness: 0.5,
				exhaustion: 0,
				curiosity: 0
			});
			const driveBars = container.querySelectorAll(
				'[data-testid="internal-drives"] .bg-gray-200 > div'
			);
			// First bar (sleep pressure) should have 100% width
			expect(/** @type {HTMLElement} */ (driveBars[0]).style.width).toBe('100%');
		});
	});
});
