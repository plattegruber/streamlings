<script>
	import { invalidateAll } from '$app/navigation';

	/**
	 * @type {{ status: string | null, prompt: string | null }}
	 */
	let { status = null, prompt = null } = $props();

	let inputPrompt = $state(prompt ?? '');
	let generating = $state(false);
	let errorMessage = $state('');
	let progress = $state(0);
	let stageLabel = $state('');

	const isActive = $derived(status === 'pending' || status === 'preview' || status === 'refining' || status === 'rigging' || status === 'animating' || status === 'retrying');

	$effect(() => {
		if (!isActive) return;

		generating = true;
		updateStageLabel(status);

		const interval = setInterval(pollStatus, 5000);
		// Initial poll
		pollStatus();

		return () => clearInterval(interval);
	});

	/** @param {string | null} s */
	function updateStageLabel(s) {
		switch (s) {
			case 'pending':
			case 'preview':
				stageLabel = 'Generating preview...';
				break;
			case 'refining':
				stageLabel = 'Refining model...';
				break;
			case 'rigging':
				stageLabel = 'Rigging model...';
				break;
			case 'animating':
				stageLabel = 'Adding animations...';
				break;
			case 'retrying':
				stageLabel = 'Retrying generation...';
				break;
			default:
				stageLabel = '';
		}
	}

	async function pollStatus() {
		try {
			const res = await fetch('/api/streamling/generate/status');
			if (!res.ok) return;

			const data = await res.json();
			progress = data.progress ?? 0;
			updateStageLabel(data.status);

			if (data.status === 'ready') {
				generating = false;
				await invalidateAll();
			} else if (data.status === 'failed') {
				generating = false;
				errorMessage = 'Generation failed. Please try again.';
			}
		} catch {
			// Silently retry on next poll
		}
	}

	async function startGeneration() {
		const trimmed = inputPrompt.trim();
		if (!trimmed) return;

		generating = true;
		errorMessage = '';
		progress = 0;
		stageLabel = 'Starting...';

		try {
			const res = await fetch('/api/streamling/generate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt: trimmed })
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.message || `Request failed (${res.status})`);
			}

			stageLabel = 'Generating preview...';
			// Polling will take over from the $effect
			await invalidateAll();
		} catch (err) {
			generating = false;
			errorMessage = err instanceof Error ? err.message : 'Something went wrong';
		}
	}
</script>

<div class="rounded-lg bg-white p-6 shadow">
	<h3 class="mb-4 text-lg font-semibold text-gray-900">Customize Streamling</h3>

	{#if generating}
		<!-- Progress state -->
		<div class="space-y-3">
			<p class="text-sm font-medium text-gray-700">{stageLabel}</p>
			<div class="h-2 w-full overflow-hidden rounded-full bg-gray-200">
				<div
					class="h-full rounded-full bg-indigo-500 transition-all duration-500"
					style="width: {progress}%"
				></div>
			</div>
			<p class="text-xs text-gray-500">This usually takes 3-5 minutes</p>
		</div>
	{:else if errorMessage}
		<!-- Error state -->
		<div class="space-y-3">
			<p class="text-sm text-red-600">{errorMessage}</p>
			<button
				onclick={() => {
					errorMessage = '';
				}}
				class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
			>
				Try Again
			</button>
		</div>
	{:else}
		<!-- Input state -->
		<div class="space-y-3">
			{#if prompt && status === 'ready'}
				<p class="text-sm text-gray-500">
					Current: <span class="font-medium text-gray-700">{prompt}</span>
				</p>
			{/if}
			<div class="flex gap-2">
				<input
					type="text"
					bind:value={inputPrompt}
					placeholder="Describe your streamling (e.g., dinosaur, robot cat)"
					maxlength="100"
					class="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
				/>
				<button
					onclick={startGeneration}
					disabled={!inputPrompt.trim()}
					class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
				>
					{prompt && status === 'ready' ? 'Regenerate' : 'Generate'}
				</button>
			</div>
		</div>
	{/if}
</div>
