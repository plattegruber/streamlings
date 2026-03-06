<script>
	import { onDestroy } from 'svelte';
	import { createWebSocketTelemetry } from '$lib/ws-telemetry.svelte.js';
	import StreamlingOverlay from '$lib/components/StreamlingOverlay.svelte';
	import StreamlingOverlay3D from '$lib/components/StreamlingOverlay3D.svelte';

	/** @type {{ data: { workerUrl: string, streamerId: string, characterType: string, modelUrl: string | null, animationUrls: Record<string, string> | null } }} */
	let { data } = $props();

	const ws = createWebSocketTelemetry(data.workerUrl, data.streamerId);
	onDestroy(() => ws.destroy());

	const telemetry = $derived(ws.data);
	const mood = $derived(telemetry?.mood?.currentState ?? 'idle');

	const activeModelUrl = $derived(
		data.characterType === 'custom'
			? data.modelUrl
			: data.characterType === 'default-3d'
				? '/models/default.glb'
				: null
	);
	const activeAnimationUrls = $derived(
		data.characterType === 'custom' ? data.animationUrls : null
	);
</script>

<div class="overlay-root">
	{#if activeModelUrl}
		{#key activeModelUrl}
			<StreamlingOverlay3D {mood} modelUrl={activeModelUrl} animationUrls={activeAnimationUrls} />
		{/key}
	{:else}
		<StreamlingOverlay {mood} />
	{/if}
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
