<script>
	import { useClerkContext, SignOutButton, UserButton } from 'svelte-clerk';
	import { onDestroy } from 'svelte';
	import { createTelemetryPoller } from '$lib/telemetry.svelte.js';
	import { createEventsPoller } from '$lib/events.svelte.js';
	import MoodIndicator from '$lib/components/MoodIndicator.svelte';
	import EnergyGauge from '$lib/components/EnergyGauge.svelte';
	import TimeInState from '$lib/components/TimeInState.svelte';
	import InternalDrives from '$lib/components/InternalDrives.svelte';
	import ActivityFeed from '$lib/components/ActivityFeed.svelte';
	import TwitchConnection from '$lib/components/TwitchConnection.svelte';

	const ctx = useClerkContext();
	const user = $derived(ctx.user);

	/** @type {{ data: { workerUrl: string, streamerId: string, twitchConnection: { connected: boolean, twitchUsername: string|null } } }} */
	let { data } = $props();

	const poller = createTelemetryPoller(data.workerUrl);
	const eventsPoller = createEventsPoller(data.workerUrl, data.streamerId);
	onDestroy(() => {
		poller.destroy();
		eventsPoller.destroy();
	});

	const telemetry = $derived(poller.data);
	const events = $derived(eventsPoller.data ?? []);
</script>

<div class="min-h-screen bg-gray-50">
	<nav class="border-b border-gray-200 bg-white">
		<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<div class="flex h-16 items-center justify-between">
				<div class="flex items-center">
					<h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
				</div>
				<div class="flex items-center gap-4">
					<a
						href="/dashboard/settings"
						class="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
					>
						Settings
					</a>
					<UserButton />
				</div>
			</div>
		</div>
	</nav>

	<main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
		{#if user}
			<div class="mb-6 rounded-lg bg-white p-6 shadow">
				<h2 class="mb-4 text-xl font-semibold text-gray-900">
					Welcome, {user.primaryEmailAddress?.emailAddress || user.username || 'User'}!
				</h2>
				<SignOutButton>
					<button
						class="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none"
					>
						Sign Out
					</button>
				</SignOutButton>
			</div>

			<div class="mb-6">
				<TwitchConnection
					connected={data.twitchConnection.connected}
					twitchUsername={data.twitchConnection.twitchUsername}
				/>
			</div>
		{/if}

		<h2 class="mb-4 text-lg font-semibold text-gray-900">Streamling Telemetry</h2>

		{#if poller.loading}
			<p class="text-gray-500">Connecting to worker...</p>
		{:else if poller.error && !telemetry}
			<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
				<p class="font-medium">Unable to reach streamling-state worker</p>
				<p class="mt-1 text-red-600">{poller.error}</p>
				<p class="mt-2 text-xs text-red-500">
					Make sure the worker is running at
					<code class="rounded bg-red-100 px-1">{data.workerUrl}</code>
				</p>
			</div>
		{:else if telemetry}
			<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				<div class="flex items-center justify-center rounded-lg bg-white p-6 shadow">
					<MoodIndicator mood={telemetry.mood.currentState} />
				</div>

				<div class="flex items-center justify-center rounded-lg bg-white p-6 shadow">
					<TimeInState
						mood={telemetry.mood.currentState}
						timeInState={telemetry.mood.timeInState}
					/>
				</div>

				<div class="rounded-lg bg-white p-6 shadow sm:col-span-2 lg:col-span-1">
					<EnergyGauge energy={telemetry.energy.energy} zScore={telemetry.energy.zScore} />
				</div>

				<div class="rounded-lg bg-white p-6 shadow sm:col-span-2 lg:col-span-3">
					<InternalDrives
						sleepPressure={telemetry.mood.drive.sleepPressure}
						restedness={telemetry.mood.drive.restedness}
						exhaustion={telemetry.mood.drive.exhaustion}
						curiosity={telemetry.mood.drive.curiosity}
					/>
				</div>
			</div>

			{#if poller.error}
				<p class="mt-4 text-xs text-amber-600">
					Last poll failed ({poller.error}) — showing stale data.
				</p>
			{/if}
		{/if}

		<div class="mt-8 rounded-lg bg-white p-6 shadow">
			<ActivityFeed items={events} />
		</div>
	</main>
</div>
