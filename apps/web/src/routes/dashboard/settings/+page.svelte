<script>
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { createConfigManager } from '$lib/config.svelte.js';
	import ConfigEditor from '$lib/components/ConfigEditor.svelte';

	/** @type {{ data: { workerUrl: string, streamerId: string } }} */
	let { data } = $props();

	const cfg = createConfigManager(data.workerUrl, data.streamerId);

	onMount(() => {
		cfg.load();
	});
</script>

<div class="min-h-screen bg-gray-50">
	<nav class="border-b border-gray-200 bg-white">
		<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<div class="flex h-16 items-center justify-between">
				<div class="flex items-center gap-3">
					<a href={resolve('/dashboard')} class="text-sm text-gray-500 hover:text-gray-700">
						Dashboard
					</a>
					<span class="text-gray-300">/</span>
					<h1 class="text-2xl font-bold text-gray-900">Settings</h1>
				</div>
			</div>
		</div>
	</nav>

	<main class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
		{#if cfg.loading}
			<p class="text-gray-500">Loading configuration...</p>
		{:else if cfg.error && !cfg.config}
			<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
				<p class="font-medium">Unable to load configuration</p>
				<p class="mt-1 text-red-600">{cfg.error}</p>
				<p class="mt-2 text-xs text-red-500">
					Make sure the worker is running at
					<code class="rounded bg-red-100 px-1">{data.workerUrl}</code>
				</p>
			</div>
		{:else if cfg.config}
			<ConfigEditor
				config={cfg.config}
				saving={cfg.saving}
				onsave={(partialConfig) => cfg.save(partialConfig)}
			/>

			{#if cfg.error}
				<div class="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
					<p>Save failed: {cfg.error}</p>
				</div>
			{/if}
		{/if}
	</main>
</div>
