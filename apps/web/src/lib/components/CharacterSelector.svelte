<script>
	import { invalidateAll } from '$app/navigation';

	/**
	 * @type {{ characterType: string, modelStatus: string | null }}
	 */
	let { characterType, modelStatus = null } = $props();

	let updating = $state(false);

	const hasCustomModel = $derived(modelStatus === 'ready');

	/** @type {Array<{ type: string, label: string, icon: string, description: string, available: boolean }>} */
	const options = $derived([
		{
			type: 'plant',
			label: 'Plant',
			icon: '🌱',
			description: '2D kawaii plant',
			available: true
		},
		{
			type: 'default-3d',
			label: '3D Default',
			icon: '🤖',
			description: '3D robot cat',
			available: true
		},
		{
			type: 'custom',
			label: 'Custom',
			icon: '✨',
			description: hasCustomModel ? 'Your generated model' : 'Generate one first',
			available: hasCustomModel
		}
	]);

	/** @param {string} type */
	async function selectCharacter(type) {
		if (type === characterType || updating) return;

		updating = true;
		try {
			const res = await fetch('/api/streamling/character', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ characterType: type })
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				console.error('[CharacterSelector]', data.message || res.statusText);
				return;
			}

			await invalidateAll();
		} catch (err) {
			console.error('[CharacterSelector]', err);
		} finally {
			updating = false;
		}
	}
</script>

<div class="rounded-lg bg-white p-6 shadow">
	<h3 class="mb-4 text-lg font-semibold text-gray-900">Choose Character</h3>
	<div class="flex gap-3">
		{#each options as option (option.type)}
			<button
				onclick={() => option.available && selectCharacter(option.type)}
				disabled={!option.available || updating}
				class="flex flex-1 flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all
					{characterType === option.type
					? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
					: option.available
						? 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
						: 'cursor-not-allowed border-gray-100 bg-gray-50 opacity-50'}"
			>
				<span class="text-2xl">{option.icon}</span>
				<span class="text-sm font-semibold text-gray-900">{option.label}</span>
				<span class="text-xs text-gray-500">{option.description}</span>
			</button>
		{/each}
	</div>
</div>
