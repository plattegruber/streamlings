<script>
	/**
	 * Displays the current Twitch connection status and provides a button
	 * to sync the Clerk Twitch OAuth account to the database.
	 *
	 * Props:
	 * - connected: whether a Twitch connection exists in the database
	 * - twitchUsername: the connected Twitch username (if connected)
	 * - loading: whether the initial data is still loading
	 */

	/** @type {{ connected: boolean, twitchUsername: string | null, loading?: boolean }} */
	let { connected, twitchUsername, loading = false } = $props();

	let syncing = $state(false);
	let syncError = $state(/** @type {string|null} */ (null));

	async function syncConnection() {
		syncing = true;
		syncError = null;

		try {
			const response = await fetch('/api/twitch/connect', { method: 'POST' });

			if (!response.ok) {
				const body = await response.json().catch(() => ({ message: 'Sync failed' }));
				syncError = body.message ?? `Sync failed (${response.status})`;
				return;
			}

			const data = await response.json();
			connected = true;
			twitchUsername = data.twitchUsername;
		} catch (err) {
			syncError = err instanceof Error ? err.message : 'Unexpected error';
		} finally {
			syncing = false;
		}
	}
</script>

<div data-testid="twitch-connection" class="rounded-lg border border-gray-200 bg-white p-4">
	<h3 class="mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase">
		Twitch Connection
	</h3>

	{#if loading}
		<div data-testid="twitch-loading" class="flex items-center gap-2 text-sm text-gray-400">
			<span class="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-gray-300"></span>
			Loading...
		</div>
	{:else if connected && twitchUsername}
		<div data-testid="twitch-connected" class="flex items-center gap-3">
			<span class="inline-block h-2.5 w-2.5 rounded-full bg-green-500" aria-hidden="true"></span>
			<div>
				<p class="text-sm font-medium text-gray-900">{twitchUsername}</p>
				<p class="text-xs text-gray-500">Connected</p>
			</div>
		</div>
	{:else}
		<div data-testid="twitch-disconnected" class="space-y-3">
			<div class="flex items-center gap-2 text-sm text-gray-500">
				<span class="inline-block h-2.5 w-2.5 rounded-full bg-gray-300" aria-hidden="true"></span>
				Not connected
			</div>

			<button
				onclick={syncConnection}
				disabled={syncing}
				class="inline-flex items-center gap-2 rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
			>
				{#if syncing}
					Connecting...
				{:else}
					Connect Twitch
				{/if}
			</button>

			{#if syncError}
				<p data-testid="twitch-error" class="text-xs text-red-600">{syncError}</p>
			{/if}
		</div>
	{/if}
</div>
