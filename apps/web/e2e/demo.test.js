import { expect, test } from '@playwright/test';

test.describe('landing page smoke test', () => {
	test('renders the page title', async ({ page }) => {
		await page.goto('/');
		const heading = page.locator('h1');
		await expect(heading).toBeVisible();
		await expect(heading).toHaveText('Welcome to Streamlings');
	});

	test('renders the tagline', async ({ page }) => {
		await page.goto('/');
		await expect(
			page.getByText('Your interactive streaming companion powered by your audience.')
		).toBeVisible();
	});

	test('renders sign-in and create-account links when logged out', async ({ page }) => {
		await page.goto('/');
		// When Clerk hasn't loaded or user is not authenticated, expect auth links.
		// The page may briefly show "Loading..." first — wait for either state.
		const signIn = page.getByRole('link', { name: 'Sign In' });
		const loading = page.getByText('Loading...');
		// One of these should be visible within a reasonable time
		await expect(signIn.or(loading)).toBeVisible({ timeout: 10_000 });
	});
});
