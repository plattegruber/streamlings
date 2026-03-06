<script>
	/**
	 * @type {{ previewMood: string | null, onchange: (mood: string | null) => void }}
	 */
	let { previewMood = null, onchange } = $props();

	const moods = [
		{
			key: 'sleeping',
			label: 'Sleeping',
			icon: '💤',
			bg: 'bg-indigo-100',
			text: 'text-indigo-800',
			ring: 'ring-indigo-300'
		},
		{
			key: 'idle',
			label: 'Idle',
			icon: '😌',
			bg: 'bg-gray-100',
			text: 'text-gray-700',
			ring: 'ring-gray-300'
		},
		{
			key: 'engaged',
			label: 'Engaged',
			icon: '😄',
			bg: 'bg-amber-100',
			text: 'text-amber-800',
			ring: 'ring-amber-300'
		},
		{
			key: 'partying',
			label: 'Partying',
			icon: '🎉',
			bg: 'bg-pink-100',
			text: 'text-pink-800',
			ring: 'ring-pink-300'
		}
	];

	/** @param {string} mood */
	function toggle(mood) {
		onchange(previewMood === mood ? null : mood);
	}
</script>

<div class="flex items-center gap-3">
	{#each moods as mood (mood.key)}
		<button
			onclick={() => toggle(mood.key)}
			class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition-all
				{previewMood === mood.key
				? `${mood.bg} ${mood.text} ${mood.ring} scale-105 ring-2`
				: 'bg-white text-gray-500 ring-gray-200 hover:ring-gray-300'}"
		>
			<span class="text-base">{mood.icon}</span>
			<span class="hidden sm:inline">{mood.label}</span>
		</button>
	{/each}

	<button
		onclick={() => onchange(null)}
		class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition-all
			{previewMood === null
			? 'bg-green-100 text-green-800 ring-2 ring-green-300'
			: 'bg-white text-gray-500 ring-gray-200 hover:ring-gray-300'}"
	>
		<span class="text-base">📡</span>
		<span class="hidden sm:inline">Live</span>
	</button>

	{#if previewMood}
		<span class="text-xs text-amber-600">Preview mode</span>
	{/if}
</div>
