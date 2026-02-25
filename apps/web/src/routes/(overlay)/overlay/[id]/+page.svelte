<script>
	import { onDestroy } from 'svelte';
	import { createWebSocketTelemetry } from '$lib/ws-telemetry.svelte.js';
	import StreamlingOverlay from '$lib/components/StreamlingOverlay.svelte';

	/** @type {{ data: { workerUrl: string, streamerId: string } }} */
	let { data } = $props();

	const ws = createWebSocketTelemetry(data.workerUrl, data.streamerId);
	onDestroy(() => ws.destroy());

	const telemetry = $derived(ws.data);
	const mood = $derived(telemetry?.mood?.currentState ?? 'idle');
</script>

<div class="overlay-root">
	<StreamlingOverlay {mood} />
</div>

<style>
	.overlay-root {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100vw;
		height: 100vh;
		background: transparent;
		overflow: hidden;
	}
</style>
