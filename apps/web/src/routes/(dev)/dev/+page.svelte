<script>
	import { onDestroy } from 'svelte';
	import { createWebSocketTelemetry } from '$lib/ws-telemetry.svelte.js';
	import { createEventsPoller } from '$lib/events.svelte.js';
	import StreamlingOverlay from '$lib/components/StreamlingOverlay.svelte';
	import MoodIndicator from '$lib/components/MoodIndicator.svelte';
	import EnergyGauge from '$lib/components/EnergyGauge.svelte';
	import InternalDrives from '$lib/components/InternalDrives.svelte';
	import ActivityFeed from '$lib/components/ActivityFeed.svelte';
	import EventControls from '$lib/components/dev/EventControls.svelte';
	import SimulationRunner from '$lib/components/dev/SimulationRunner.svelte';

	/** @type {{ data: { workerUrl: string, streamerId: string } }} */
	let { data } = $props();

	const ws = createWebSocketTelemetry(data.workerUrl, data.streamerId);
	const eventsPoller = createEventsPoller(data.workerUrl, data.streamerId, 3000);
	onDestroy(() => {
		ws.destroy();
		eventsPoller.destroy();
	});

	const telemetry = $derived(ws.data);
	const mood = $derived(telemetry?.mood?.currentState ?? 'idle');
	const events = $derived(eventsPoller.data ?? []);

	let resetting = $state(false);

	async function reset() {
		resetting = true;
		try {
			await fetch(`${data.workerUrl}/__dev/${data.streamerId}/reset`, {
				method: 'POST'
			});
		} catch (e) {
			console.error('Reset failed:', e);
		} finally {
			resetting = false;
		}
	}
</script>

<div class="min-h-screen bg-gray-950 text-gray-100">
	<!-- Header -->
	<header class="border-b border-gray-800 bg-gray-900">
		<div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
			<h1 class="text-xl font-bold text-white">Dev Console</h1>
			<div class="flex items-center gap-3">
				{#if ws.connected}
					<span class="flex items-center gap-1.5 text-xs text-emerald-400">
						<span class="inline-block h-2 w-2 rounded-full bg-emerald-400"></span>
						Connected
					</span>
				{:else}
					<span class="flex items-center gap-1.5 text-xs text-amber-400">
						<span class="inline-block h-2 w-2 rounded-full bg-amber-400"></span>
						Reconnecting...
					</span>
				{/if}
				<button
					onclick={reset}
					disabled={resetting}
					class="cursor-pointer rounded-md border-0 bg-gray-700 px-3 py-1.5 text-sm font-medium text-gray-200 hover:bg-gray-600 disabled:opacity-50"
				>
					{resetting ? 'Resetting...' : 'Reset'}
				</button>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-7xl px-4 py-6">
		<!-- Top section: Streamling preview + Controls -->
		<div class="grid gap-6 lg:grid-cols-2">
			<!-- Streamling Preview -->
			<div
				class="flex items-center justify-center rounded-lg border border-gray-800 bg-gray-900 p-6"
			>
				<StreamlingOverlay {mood} />
			</div>

			<!-- Controls -->
			<div class="space-y-6">
				<div class="rounded-lg border border-gray-800 bg-gray-900 p-4">
					<SimulationRunner workerUrl={data.workerUrl} streamerId={data.streamerId} />
				</div>

				<div class="rounded-lg border border-gray-800 bg-gray-900 p-4">
					<EventControls workerUrl={data.workerUrl} streamerId={data.streamerId} />
				</div>
			</div>
		</div>

		<!-- Telemetry strip -->
		{#if telemetry}
			<div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<div
					class="flex items-center justify-center rounded-lg border border-gray-800 bg-gray-900 p-4"
				>
					<MoodIndicator mood={telemetry.mood.currentState} />
				</div>

				<div class="rounded-lg border border-gray-800 bg-gray-900 p-4 sm:col-span-1 lg:col-span-1">
					<EnergyGauge energy={telemetry.energy.energy} zScore={telemetry.energy.zScore} />
				</div>

				<div class="rounded-lg border border-gray-800 bg-gray-900 p-4 sm:col-span-2 lg:col-span-1">
					<InternalDrives
						sleepPressure={telemetry.mood.drive.sleepPressure}
						restedness={telemetry.mood.drive.restedness}
						exhaustion={telemetry.mood.drive.exhaustion}
						curiosity={telemetry.mood.drive.curiosity}
					/>
				</div>
			</div>
		{/if}

		<!-- Activity Feed -->
		<div class="mt-6 rounded-lg border border-gray-800 bg-gray-900 p-4">
			<ActivityFeed items={events} />
		</div>
	</main>
</div>
