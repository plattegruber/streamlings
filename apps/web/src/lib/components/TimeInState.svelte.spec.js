import { page } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TimeInState from './TimeInState.svelte';

describe('TimeInState', () => {
	it('formats seconds correctly', async () => {
		render(TimeInState, { mood: 'idle', timeInState: 45_000 });
		await expect.element(page.getByText('45s')).toBeInTheDocument();
	});

	it('formats minutes and seconds', async () => {
		render(TimeInState, { mood: 'engaged', timeInState: 125_000 });
		await expect.element(page.getByText('2m 5s')).toBeInTheDocument();
	});

	it('formats hours and minutes', async () => {
		render(TimeInState, { mood: 'sleeping', timeInState: 3_723_000 });
		await expect.element(page.getByText('1h 2m')).toBeInTheDocument();
	});

	it('displays the mood label', async () => {
		render(TimeInState, { mood: 'partying', timeInState: 60_000 });
		await expect.element(page.getByText('partying')).toBeInTheDocument();
	});
});
