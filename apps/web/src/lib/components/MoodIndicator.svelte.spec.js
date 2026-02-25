import { page } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MoodIndicator from './MoodIndicator.svelte';

describe('MoodIndicator', () => {
	describe('renders correct emoji and label for each mood state', () => {
		it('renders Sleeping label and emoji', async () => {
			render(MoodIndicator, { mood: 'sleeping' });
			await expect.element(page.getByText('Sleeping')).toBeInTheDocument();
			await expect.element(page.getByRole('img', { name: 'Sleeping' })).toBeInTheDocument();
		});

		it('renders Idle label and emoji', async () => {
			render(MoodIndicator, { mood: 'idle' });
			await expect.element(page.getByText('Idle')).toBeInTheDocument();
			await expect.element(page.getByRole('img', { name: 'Idle' })).toBeInTheDocument();
		});

		it('renders Engaged label and emoji', async () => {
			render(MoodIndicator, { mood: 'engaged' });
			await expect.element(page.getByText('Engaged')).toBeInTheDocument();
			await expect.element(page.getByRole('img', { name: 'Engaged' })).toBeInTheDocument();
		});

		it('renders Partying label and emoji', async () => {
			render(MoodIndicator, { mood: 'partying' });
			await expect.element(page.getByText('Partying')).toBeInTheDocument();
			await expect.element(page.getByRole('img', { name: 'Partying' })).toBeInTheDocument();
		});
	});

	describe('pulsing animation', () => {
		it('applies pulse animation for sleeping', async () => {
			const { container } = render(MoodIndicator, { mood: 'sleeping' });
			const pill = container.querySelector('[data-testid="mood-indicator"] .animate-pulse');
			expect(pill).not.toBeNull();
		});

		it('applies pulse animation for partying', async () => {
			const { container } = render(MoodIndicator, { mood: 'partying' });
			const pill = container.querySelector('[data-testid="mood-indicator"] .animate-pulse');
			expect(pill).not.toBeNull();
		});

		it('does not apply pulse animation for idle', async () => {
			const { container } = render(MoodIndicator, { mood: 'idle' });
			const pill = container.querySelector('[data-testid="mood-indicator"] .animate-pulse');
			expect(pill).toBeNull();
		});

		it('does not apply pulse animation for engaged', async () => {
			const { container } = render(MoodIndicator, { mood: 'engaged' });
			const pill = container.querySelector('[data-testid="mood-indicator"] .animate-pulse');
			expect(pill).toBeNull();
		});
	});

	describe('unknown mood handling', () => {
		it('renders the raw state string as the label for an unknown mood', async () => {
			render(MoodIndicator, { mood: 'hypnotized' });
			await expect.element(page.getByText('hypnotized')).toBeInTheDocument();
		});

		it('renders a question-mark emoji for an unknown mood', async () => {
			const { container } = render(MoodIndicator, { mood: 'hypnotized' });
			const emoji = container.querySelector('[role="img"]');
			expect(emoji).not.toBeNull();
			expect(/** @type {HTMLElement} */ (emoji).getAttribute('aria-label')).toBe('hypnotized');
		});

		it('does not apply pulse animation for an unknown mood', async () => {
			const { container } = render(MoodIndicator, { mood: 'hypnotized' });
			const pill = container.querySelector('[data-testid="mood-indicator"] .animate-pulse');
			expect(pill).toBeNull();
		});
	});
});
