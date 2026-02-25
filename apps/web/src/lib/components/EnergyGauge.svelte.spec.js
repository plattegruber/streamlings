import { page } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import EnergyGauge from './EnergyGauge.svelte';

describe('EnergyGauge', () => {
	it('renders the energy value', async () => {
		render(EnergyGauge, { energy: 1.23, zScore: 0.5 });
		await expect.element(page.getByText('E = 1.23')).toBeInTheDocument();
	});

	it('renders a meter element', async () => {
		const { container } = render(EnergyGauge, { energy: 0.5, zScore: 0 });
		const meter = container.querySelector('[role="meter"]');
		expect(meter).not.toBeNull();
	});

	describe('bar color for different energy levels', () => {
		it('shows pink bar for high energy (>= 1.5)', async () => {
			const { container } = render(EnergyGauge, { energy: 2.0, zScore: 0 });
			const bar = container.querySelector('[role="meter"]');
			expect(bar?.classList.contains('bg-pink-500')).toBe(true);
		});

		it('shows amber bar for moderate energy (>= 0.5)', async () => {
			const { container } = render(EnergyGauge, { energy: 0.8, zScore: 0 });
			const bar = container.querySelector('[role="meter"]');
			expect(bar?.classList.contains('bg-amber-500')).toBe(true);
		});

		it('shows emerald bar for normal energy (>= -0.5)', async () => {
			const { container } = render(EnergyGauge, { energy: 0.0, zScore: 0 });
			const bar = container.querySelector('[role="meter"]');
			expect(bar?.classList.contains('bg-emerald-500')).toBe(true);
		});

		it('shows indigo bar for low energy (< -0.5)', async () => {
			const { container } = render(EnergyGauge, { energy: -1.0, zScore: 0 });
			const bar = container.querySelector('[role="meter"]');
			expect(bar?.classList.contains('bg-indigo-500')).toBe(true);
		});
	});

	describe('energy clamping to 0-100% range', () => {
		it('clamps very low energy to 0% width', async () => {
			const { container } = render(EnergyGauge, { energy: -10, zScore: 0 });
			const bar = container.querySelector('[role="meter"]');
			expect(/** @type {HTMLElement} */ (bar).style.width).toBe('0%');
		});

		it('clamps very high energy to 100% width', async () => {
			const { container } = render(EnergyGauge, { energy: 10, zScore: 0 });
			const bar = container.querySelector('[role="meter"]');
			expect(/** @type {HTMLElement} */ (bar).style.width).toBe('100%');
		});
	});

	describe('z-score descriptions', () => {
		it('shows Way above normal for z >= 2', async () => {
			render(EnergyGauge, { energy: 2, zScore: 2.5 });
			await expect.element(page.getByText('Z = 2.50 (Way above normal)')).toBeInTheDocument();
		});

		it('shows Above normal for z >= 1', async () => {
			render(EnergyGauge, { energy: 0, zScore: 1.5 });
			await expect.element(page.getByText('Z = 1.50 (Above normal)')).toBeInTheDocument();
		});

		it('shows Normal for z between -1 and 1', async () => {
			render(EnergyGauge, { energy: 0, zScore: 0.2 });
			await expect.element(page.getByText('Z = 0.20 (Normal)')).toBeInTheDocument();
		});

		it('shows Below normal for z >= -2', async () => {
			render(EnergyGauge, { energy: 0, zScore: -1.5 });
			await expect.element(page.getByText('Z = -1.50 (Below normal)')).toBeInTheDocument();
		});

		it('shows Way below normal for z < -2', async () => {
			render(EnergyGauge, { energy: 0, zScore: -2.5 });
			await expect.element(page.getByText('Z = -2.50 (Way below normal)')).toBeInTheDocument();
		});
	});
});
