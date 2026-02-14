<script>
	/**
	 * @type {{
	 *   sleepPressure: number,
	 *   restedness: number,
	 *   exhaustion: number,
	 *   curiosity: number
	 * }}
	 */
	let { sleepPressure, restedness, exhaustion, curiosity } = $props();

	/**
	 * @param {string} label
	 * @param {number} value
	 * @param {string} color
	 */
	function drive(label, value, color) {
		return { label, value, color, pct: Math.round(value * 100) };
	}

	const drives = $derived([
		drive('Sleep pressure', sleepPressure, 'bg-indigo-400'),
		drive('Restedness', restedness, 'bg-emerald-400'),
		drive('Exhaustion', exhaustion, 'bg-red-400'),
		drive('Curiosity', curiosity, 'bg-sky-400')
	]);
</script>

<div data-testid="internal-drives" class="flex flex-col gap-3">
	<span class="text-xs font-medium tracking-wide text-gray-500 uppercase">Internal drives</span>
	{#each drives as d (d.label)}
		<div class="flex items-center gap-3">
			<span class="w-28 shrink-0 text-xs text-gray-600">{d.label}</span>
			<div class="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
				<div
					class="h-full rounded-full transition-all duration-700 ease-in-out {d.color}"
					style="width: {d.pct}%"
				></div>
			</div>
			<span class="w-9 text-right text-xs text-gray-500 tabular-nums">{d.pct}%</span>
		</div>
	{/each}
</div>
