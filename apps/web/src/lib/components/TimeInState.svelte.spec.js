import { page } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TimeInState from './TimeInState.svelte';

describe('TimeInState', () => {
	describe('duration formatting', () => {
		it('formats zero milliseconds as 0s', async () => {
			render(TimeInState, { mood: 'idle', timeInState: 0 });
			await expect.element(page.getByText('0s')).toBeInTheDocument();
		});

		it('formats seconds correctly', async () => {
			render(TimeInState, { mood: 'idle', timeInState: 45_000 });
			await expect.element(page.getByText('45s')).toBeInTheDocument();
		});

		it('formats minutes and seconds', async () => {
			render(TimeInState, { mood: 'engaged', timeInState: 125_000 });
			await expect.element(page.getByText('2m 5s')).toBeInTheDocument();
		});

		it('formats exact minutes without trailing seconds', async () => {
			render(TimeInState, { mood: 'engaged', timeInState: 120_000 });
			await expect.element(page.getByText('2m 0s')).toBeInTheDocument();
		});

		it('formats hours and minutes', async () => {
			render(TimeInState, { mood: 'sleeping', timeInState: 3_723_000 });
			await expect.element(page.getByText('1h 2m')).toBeInTheDocument();
		});

		it('formats exactly one hour', async () => {
			render(TimeInState, { mood: 'sleeping', timeInState: 3_600_000 });
			await expect.element(page.getByText('1h 0m')).toBeInTheDocument();
		});

		it('formats sub-second values as 0s', async () => {
			render(TimeInState, { mood: 'idle', timeInState: 500 });
			await expect.element(page.getByText('0s')).toBeInTheDocument();
		});
	});

	describe('mood label display', () => {
		it('displays the mood label for partying', async () => {
			render(TimeInState, { mood: 'partying', timeInState: 60_000 });
			await expect.element(page.getByText('partying')).toBeInTheDocument();
		});

		it('displays the mood label for sleeping', async () => {
			render(TimeInState, { mood: 'sleeping', timeInState: 60_000 });
			await expect.element(page.getByText('sleeping')).toBeInTheDocument();
		});
	});
});
