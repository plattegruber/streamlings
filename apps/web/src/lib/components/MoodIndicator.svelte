<script>
	/** @type {{ mood: string }} */
	let { mood } = $props();

	const config = $derived(moodConfig(mood));

	/** @param {string} state */
	function moodConfig(state) {
		switch (state) {
			case 'sleeping':
				return {
					label: 'Sleeping',
					bg: 'bg-indigo-100',
					text: 'text-indigo-800',
					ring: 'ring-indigo-300',
					icon: '💤',
					pulse: true
				};
			case 'idle':
				return {
					label: 'Idle',
					bg: 'bg-gray-100',
					text: 'text-gray-700',
					ring: 'ring-gray-300',
					icon: '😌',
					pulse: false
				};
			case 'engaged':
				return {
					label: 'Engaged',
					bg: 'bg-amber-100',
					text: 'text-amber-800',
					ring: 'ring-amber-300',
					icon: '😄',
					pulse: false
				};
			case 'partying':
				return {
					label: 'Partying',
					bg: 'bg-pink-100',
					text: 'text-pink-800',
					ring: 'ring-pink-300',
					icon: '🎉',
					pulse: true
				};
			default:
				return {
					label: state,
					bg: 'bg-gray-100',
					text: 'text-gray-700',
					ring: 'ring-gray-300',
					icon: '❓',
					pulse: false
				};
		}
	}
</script>

<div data-testid="mood-indicator" class="flex flex-col items-center gap-2">
	<span class="text-xs font-medium tracking-wide text-gray-500 uppercase">Mood</span>
	<div
		class="flex items-center gap-2 rounded-full px-4 py-2 ring-1 {config.bg} {config.text} {config.ring}"
		class:animate-pulse={config.pulse}
	>
		<span class="text-lg" role="img" aria-label={config.label}>{config.icon}</span>
		<span class="text-sm font-semibold">{config.label}</span>
	</div>
</div>
