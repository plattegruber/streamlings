import { page } from '@vitest/browser/context';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TwitchConnection from './TwitchConnection.svelte';

describe('TwitchConnection', () => {
	describe('connected state', () => {
		it('renders the Twitch username when connected', async () => {
			render(TwitchConnection, {
				connected: true,
				twitchUsername: 'cool_streamer'
			});
			await expect.element(page.getByTestId('twitch-connected')).toBeInTheDocument();
			await expect.element(page.getByText('cool_streamer')).toBeInTheDocument();
			await expect.element(page.getByText('Connected')).toBeInTheDocument();
		});

		it('shows a green status dot when connected', async () => {
			const { container } = render(TwitchConnection, {
				connected: true,
				twitchUsername: 'cool_streamer'
			});
			const dot = container.querySelector('[data-testid="twitch-connected"] .bg-green-500');
			expect(dot).not.toBeNull();
		});

		it('does not show the connect button when connected', async () => {
			render(TwitchConnection, {
				connected: true,
				twitchUsername: 'cool_streamer'
			});
			const button = page.getByRole('button', { name: 'Connect Twitch' });
			await expect.element(button).not.toBeInTheDocument();
		});
	});

	describe('disconnected state', () => {
		it('renders "Not connected" text when disconnected', async () => {
			render(TwitchConnection, {
				connected: false,
				twitchUsername: null
			});
			await expect.element(page.getByTestId('twitch-disconnected')).toBeInTheDocument();
			await expect.element(page.getByText('Not connected')).toBeInTheDocument();
		});

		it('shows a Connect Twitch button when disconnected', async () => {
			render(TwitchConnection, {
				connected: false,
				twitchUsername: null
			});
			const button = page.getByRole('button', { name: 'Connect Twitch' });
			await expect.element(button).toBeInTheDocument();
		});

		it('does not show the username when disconnected', async () => {
			render(TwitchConnection, {
				connected: false,
				twitchUsername: null
			});
			const connected = page.getByTestId('twitch-connected');
			await expect.element(connected).not.toBeInTheDocument();
		});
	});

	describe('loading state', () => {
		it('renders loading indicator', async () => {
			render(TwitchConnection, {
				connected: false,
				twitchUsername: null,
				loading: true
			});
			await expect.element(page.getByTestId('twitch-loading')).toBeInTheDocument();
			await expect.element(page.getByText('Loading...')).toBeInTheDocument();
		});

		it('does not show connected or disconnected states while loading', async () => {
			render(TwitchConnection, {
				connected: false,
				twitchUsername: null,
				loading: true
			});
			const connected = page.getByTestId('twitch-connected');
			const disconnected = page.getByTestId('twitch-disconnected');
			await expect.element(connected).not.toBeInTheDocument();
			await expect.element(disconnected).not.toBeInTheDocument();
		});
	});

	describe('sync interaction', () => {
		it('calls the connect API when the button is clicked', async () => {
			const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						connected: true,
						twitchUsername: 'new_streamer',
						twitchUserId: '12345',
						streamerId: 's1',
						durableObjectId: 'do-1'
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				)
			);

			render(TwitchConnection, {
				connected: false,
				twitchUsername: null
			});

			const button = page.getByRole('button', { name: 'Connect Twitch' });
			await button.click();

			expect(fetchSpy).toHaveBeenCalledWith('/api/twitch/connect', { method: 'POST' });

			// After successful sync, the connected state should appear
			await expect.element(page.getByTestId('twitch-connected')).toBeInTheDocument();
			await expect.element(page.getByText('new_streamer')).toBeInTheDocument();

			fetchSpy.mockRestore();
		});

		it('shows an error message when the sync fails', async () => {
			const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
				new Response(JSON.stringify({ message: 'No Twitch account linked' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				})
			);

			render(TwitchConnection, {
				connected: false,
				twitchUsername: null
			});

			const button = page.getByRole('button', { name: 'Connect Twitch' });
			await button.click();

			await expect.element(page.getByTestId('twitch-error')).toBeInTheDocument();
			await expect.element(page.getByText('No Twitch account linked')).toBeInTheDocument();

			fetchSpy.mockRestore();
		});
	});
});
