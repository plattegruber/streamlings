<script>
	/** @type {{ energy: number, zScore: number }} */
	let { energy, zScore } = $props();

	/** Clamp energy into a 0-100 gauge width. Energy typically ranges roughly -2 to +3. */
	const pct = $derived(Math.max(0, Math.min(100, ((energy + 2) / 5) * 100)));

	const barColor = $derived(
		energy >= 1.5
			? 'bg-pink-500'
			: energy >= 0.5
				? 'bg-amber-500'
				: energy >= -0.5
					? 'bg-emerald-500'
					: 'bg-indigo-500'
	);

	const zLabel = $derived(
		zScore >= 2
			? 'Way above normal'
			: zScore >= 1
				? 'Above normal'
				: zScore >= -1
					? 'Normal'
					: zScore >= -2
						? 'Below normal'
						: 'Way below normal'
	);
</script>

<div data-testid="energy-gauge" class="flex flex-col gap-2">
	<span class="text-xs font-medium tracking-wide text-gray-500 uppercase">Energy</span>
	<div class="h-3 w-full overflow-hidden rounded-full bg-gray-200">
		<div
			class="h-full rounded-full transition-all duration-700 ease-in-out {barColor}"
			style="width: {pct}%"
			role="meter"
			aria-valuenow={energy}
			aria-label="Energy level"
		></div>
	</div>
	<div class="flex items-center justify-between text-xs text-gray-500">
		<span>E = {energy.toFixed(2)}</span>
		<span>Z = {zScore.toFixed(2)} ({zLabel})</span>
	</div>
</div>
