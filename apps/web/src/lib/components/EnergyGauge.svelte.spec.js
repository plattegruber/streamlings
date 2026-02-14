import { page } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import EnergyGauge from './EnergyGauge.svelte';

describe('EnergyGauge', () => {
	it('renders the energy value', async () => {
		render(EnergyGauge, { energy: 1.23, zScore: 0.5 });
		await expect.element(page.getByText('E = 1.23')).toBeInTheDocument();
	});

	it('renders the z-score with label', async () => {
		render(EnergyGauge, { energy: 0, zScore: 1.5 });
		await expect.element(page.getByText('Z = 1.50 (Above normal)')).toBeInTheDocument();
	});

	it('shows Normal label for z-scores near zero', async () => {
		render(EnergyGauge, { energy: 0, zScore: 0.2 });
		await expect.element(page.getByText('Z = 0.20 (Normal)')).toBeInTheDocument();
	});

	it('shows Way above normal for high z-scores', async () => {
		render(EnergyGauge, { energy: 2, zScore: 2.5 });
		await expect.element(page.getByText('Z = 2.50 (Way above normal)')).toBeInTheDocument();
	});

	it('renders a meter element', async () => {
		const { container } = render(EnergyGauge, { energy: 0.5, zScore: 0 });
		const meter = container.querySelector('[role="meter"]');
		expect(meter).not.toBeNull();
	});
});
