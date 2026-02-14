import { page } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MoodIndicator from './MoodIndicator.svelte';

describe('MoodIndicator', () => {
	it('renders the mood label for sleeping', async () => {
		render(MoodIndicator, { mood: 'sleeping' });
		await expect.element(page.getByText('Sleeping')).toBeInTheDocument();
	});

	it('renders the mood label for idle', async () => {
		render(MoodIndicator, { mood: 'idle' });
		await expect.element(page.getByText('Idle')).toBeInTheDocument();
	});

	it('renders the mood label for engaged', async () => {
		render(MoodIndicator, { mood: 'engaged' });
		await expect.element(page.getByText('Engaged')).toBeInTheDocument();
	});

	it('renders the mood label for partying', async () => {
		render(MoodIndicator, { mood: 'partying' });
		await expect.element(page.getByText('Partying')).toBeInTheDocument();
	});

	it('applies pulse animation for sleeping and partying', async () => {
		const { container } = render(MoodIndicator, { mood: 'sleeping' });
		const pill = container.querySelector('[data-testid="mood-indicator"] .animate-pulse');
		expect(pill).not.toBeNull();
	});

	it('does not apply pulse animation for idle', async () => {
		const { container } = render(MoodIndicator, { mood: 'idle' });
		const pill = container.querySelector('[data-testid="mood-indicator"] .animate-pulse');
		expect(pill).toBeNull();
	});
});
