<script>
	/** @type {{ mood: string, timeInState: number }} */
	let { mood, timeInState } = $props();

	const formatted = $derived(formatDuration(timeInState));

	/** @param {number} ms */
	function formatDuration(ms) {
		const totalSec = Math.floor(ms / 1000);
		const h = Math.floor(totalSec / 3600);
		const m = Math.floor((totalSec % 3600) / 60);
		const s = totalSec % 60;

		if (h > 0) return `${h}h ${m}m`;
		if (m > 0) return `${m}m ${s}s`;
		return `${s}s`;
	}
</script>

<div data-testid="time-in-state" class="flex flex-col items-center gap-1">
	<span class="text-xs font-medium tracking-wide text-gray-500 uppercase">Time in state</span>
	<p class="text-lg font-semibold text-gray-900 tabular-nums">{formatted}</p>
	<p class="text-xs text-gray-400 capitalize">{mood}</p>
</div>
