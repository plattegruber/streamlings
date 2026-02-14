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

	it('renders all four drive labels', async () => {
		render(InternalDrives, defaultProps);
		await expect.element(page.getByText('Sleep pressure')).toBeInTheDocument();
		await expect.element(page.getByText('Restedness')).toBeInTheDocument();
		await expect.element(page.getByText('Exhaustion')).toBeInTheDocument();
		await expect.element(page.getByText('Curiosity')).toBeInTheDocument();
	});

	it('renders percentage values', async () => {
		render(InternalDrives, defaultProps);
		await expect.element(page.getByText('40%')).toBeInTheDocument();
		await expect.element(page.getByText('80%')).toBeInTheDocument();
		await expect.element(page.getByText('10%')).toBeInTheDocument();
		await expect.element(page.getByText('55%')).toBeInTheDocument();
	});

	it('renders the section heading', async () => {
		render(InternalDrives, defaultProps);
		await expect.element(page.getByText('Internal drives')).toBeInTheDocument();
	});
});
