<script>
	/**
	 * @type {{
	 *   items: import('@streamlings/shared/types').EventRecord[]
	 * }}
	 */
	let { items } = $props();

	/** Events sorted newest-first */
	const sorted = $derived([...items].sort((a, b) => b.timestamp - a.timestamp));

	/**
	 * Format a timestamp as a relative time string ("2s ago", "1m ago", "3h ago").
	 * @param {number} timestamp  Unix epoch milliseconds
	 * @returns {string}
	 */
	function relativeTime(timestamp) {
		const diffMs = Date.now() - timestamp;
		const diffSec = Math.floor(diffMs / 1000);

		if (diffSec < 60) return `${diffSec}s ago`;

		const diffMin = Math.floor(diffSec / 60);
		if (diffMin < 60) return `${diffMin}m ago`;

		const diffHr = Math.floor(diffMin / 60);
		return `${diffHr}h ago`;
	}

	/**
	 * Get visual config per event category.
	 * @param {import('@streamlings/shared/types').EventCategory} category
	 */
	function categoryConfig(category) {
		switch (category) {
			case 'message':
				return {
					bg: 'bg-gray-50',
					border: 'border-gray-200',
					badge: 'bg-gray-200 text-gray-700',
					icon: '\u{1F4AC}',
					iconLabel: 'Chat message'
				};
			case 'high_value':
				return {
					bg: 'bg-amber-50',
					border: 'border-amber-200',
					badge: 'bg-amber-200 text-amber-800',
					icon: '\u{2B50}',
					iconLabel: 'High-value event'
				};
			case 'interaction':
				return {
					bg: 'bg-blue-50',
					border: 'border-blue-200',
					badge: 'bg-blue-200 text-blue-800',
					icon: '\u{1F44B}',
					iconLabel: 'Interaction'
				};
			case 'lifecycle':
				return {
					bg: 'bg-emerald-50',
					border: 'border-emerald-200',
					badge: 'bg-emerald-200 text-emerald-800',
					icon: '\u{26A1}',
					iconLabel: 'Lifecycle event'
				};
			default:
				return {
					bg: 'bg-gray-50',
					border: 'border-gray-200',
					badge: 'bg-gray-200 text-gray-700',
					icon: '\u{2753}',
					iconLabel: 'Unknown event'
				};
		}
	}

	/**
	 * Build a human-readable detail string from event metadata.
	 * @param {import('@streamlings/shared/types').EventRecord} event
	 * @returns {string}
	 */
	function eventDetail(event) {
		const meta = event.metadata;
		if (!meta) return event.eventType;

		if (meta.message) return String(meta.message);
		if (meta.amount && meta.tier) return `Tier ${meta.tier} - ${meta.amount}`;
		if (meta.amount) return `${meta.amount} bits`;
		if (meta.tier) return `Tier ${meta.tier}`;
		if (meta.raider)
			return `Raid from ${meta.raider}${meta.viewers ? ` (${meta.viewers} viewers)` : ''}`;

		return event.eventType;
	}
</script>

<div data-testid="activity-feed" class="flex flex-col gap-2">
	<span class="text-xs font-medium tracking-wide text-gray-500 uppercase">Activity Feed</span>

	{#if sorted.length === 0}
		<p data-testid="empty-state" class="py-8 text-center text-sm text-gray-400">No events yet</p>
	{:else}
		<div class="flex max-h-96 flex-col gap-1 overflow-y-auto">
			{#each sorted as event (event.timestamp + event.eventType + (event.userId ?? ''))}
				{@const config = categoryConfig(event.category)}
				<div
					data-testid="event-row"
					data-category={event.category}
					class="flex items-start gap-3 rounded-md border px-3 py-2 {config.bg} {config.border}"
				>
					<span
						class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm {config.badge}"
						role="img"
						aria-label={config.iconLabel}
					>
						{config.icon}
					</span>

					<div class="min-w-0 flex-1">
						<div class="flex items-baseline gap-2">
							{#if event.metadata?.username}
								<span class="text-sm font-medium text-gray-900">
									{event.metadata.username}
								</span>
							{/if}
							<span class="truncate text-sm text-gray-600">
								{eventDetail(event)}
							</span>
						</div>
					</div>

					<span class="shrink-0 text-xs text-gray-400 tabular-nums">
						{relativeTime(event.timestamp)}
					</span>
				</div>
			{/each}
		</div>
	{/if}
</div>
