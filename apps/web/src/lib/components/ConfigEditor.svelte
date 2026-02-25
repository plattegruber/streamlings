<script>
	/**
	 * @typedef {import('$lib/config.svelte.js').StreamlingConfig} StreamlingConfig
	 */

	/**
	 * @type {{
	 *   config: StreamlingConfig,
	 *   saving: boolean,
	 *   onsave: (config: Partial<StreamlingConfig>) => void,
	 * }}
	 */
	let { config, saving, onsave } = $props();

	// ── Energy Settings (local copies for editing) ──────────────────────
	let messageWeight = $state(config.energy.messageWeight);
	let chatterWeight = $state(config.energy.chatterWeight);
	let highValueWeight = $state(config.energy.highValueWeight);
	let baselineAlpha = $state(config.energy.baselineAlpha);
	let energyAlpha = $state(config.energy.energyAlpha);

	// ── Mood Transition Settings ────────────────────────────────────────
	let sleepToIdleThreshold = $state(config.moodTransition.sleepToIdleEnergyThreshold);
	let idleToEngagedThreshold = $state(config.moodTransition.idleToEngagedEnergyThreshold);
	let engagedToPartyingThreshold = $state(config.moodTransition.engagedToPartyingEnergyThreshold);
	let partyingToEngagedThreshold = $state(config.moodTransition.partyingToEngagedEnergyThreshold);
	let engagedToIdleThreshold = $state(config.moodTransition.engagedToIdleEnergyThreshold);
	let idleToSleepingThreshold = $state(config.moodTransition.idleToSleepingEnergyThreshold);

	// Hold times: stored in ms, displayed in seconds
	let sleepToIdleHoldTime = $state(config.moodTransition.sleepToIdleHoldTime / 1000);
	let sleepToIdleMinDuration = $state(config.moodTransition.sleepToIdleMinDuration / 1000);
	let idleToEngagedHoldTime = $state(config.moodTransition.idleToEngagedHoldTime / 1000);
	let engagedToPartyingHoldTime = $state(config.moodTransition.engagedToPartyingHoldTime / 1000);
	let partyingToEngagedHoldTime = $state(config.moodTransition.partyingToEngagedHoldTime / 1000);
	let partyingToEngagedMaxDuration = $state(
		config.moodTransition.partyingToEngagedMaxDuration / 1000
	);
	let engagedToIdleHoldTime = $state(config.moodTransition.engagedToIdleHoldTime / 1000);
	let idleToSleepingHoldTime = $state(config.moodTransition.idleToSleepingHoldTime / 1000);

	// ── Internal Drive Settings ─────────────────────────────────────────
	let sleepPressureRate = $state(config.internalDrive.sleepPressureRate);
	let restednessRate = $state(config.internalDrive.restednessRate);
	let exhaustionRate = $state(config.internalDrive.exhaustionRate);
	let curiosityRate = $state(config.internalDrive.curiosityRate);
	let sleepPressureThreshold = $state(config.internalDrive.sleepPressureThreshold);
	let restednessThreshold = $state(config.internalDrive.restednessThreshold);
	let exhaustionThreshold = $state(config.internalDrive.exhaustionThreshold);

	// ── Defaults (for reference display) ────────────────────────────────
	const defaults = {
		energy: {
			messageWeight: 1.0,
			chatterWeight: 0.7,
			highValueWeight: 3.0,
			baselineAlpha: 0.05,
			energyAlpha: 0.02
		},
		moodTransition: {
			sleepToIdleEnergyThreshold: -0.5,
			sleepToIdleMinDuration: 600,
			sleepToIdleHoldTime: 120,
			idleToEngagedEnergyThreshold: 0.5,
			idleToEngagedHoldTime: 90,
			engagedToPartyingEnergyThreshold: 1.5,
			engagedToPartyingHoldTime: 120,
			partyingToEngagedEnergyThreshold: 1.2,
			partyingToEngagedMaxDuration: 600,
			partyingToEngagedHoldTime: 60,
			engagedToIdleEnergyThreshold: 0.3,
			engagedToIdleHoldTime: 180,
			idleToSleepingEnergyThreshold: -0.8,
			idleToSleepingHoldTime: 600
		},
		internalDrive: {
			sleepPressureRate: 0.001,
			restednessRate: 0.002,
			exhaustionRate: 0.01,
			curiosityRate: 0.0005,
			sleepPressureThreshold: 0.8,
			restednessThreshold: 0.9,
			exhaustionThreshold: 0.85
		}
	};

	function handleSave() {
		onsave({
			energy: {
				...config.energy,
				messageWeight,
				chatterWeight,
				highValueWeight,
				baselineAlpha,
				energyAlpha
			},
			moodTransition: {
				...config.moodTransition,
				sleepToIdleEnergyThreshold: sleepToIdleThreshold,
				idleToEngagedEnergyThreshold: idleToEngagedThreshold,
				engagedToPartyingEnergyThreshold: engagedToPartyingThreshold,
				partyingToEngagedEnergyThreshold: partyingToEngagedThreshold,
				engagedToIdleEnergyThreshold: engagedToIdleThreshold,
				idleToSleepingEnergyThreshold: idleToSleepingThreshold,
				sleepToIdleHoldTime: sleepToIdleHoldTime * 1000,
				sleepToIdleMinDuration: sleepToIdleMinDuration * 1000,
				idleToEngagedHoldTime: idleToEngagedHoldTime * 1000,
				engagedToPartyingHoldTime: engagedToPartyingHoldTime * 1000,
				partyingToEngagedHoldTime: partyingToEngagedHoldTime * 1000,
				partyingToEngagedMaxDuration: partyingToEngagedMaxDuration * 1000,
				engagedToIdleHoldTime: engagedToIdleHoldTime * 1000,
				idleToSleepingHoldTime: idleToSleepingHoldTime * 1000
			},
			internalDrive: {
				sleepPressureRate,
				restednessRate,
				exhaustionRate,
				curiosityRate,
				sleepPressureThreshold,
				restednessThreshold,
				exhaustionThreshold
			}
		});
	}
</script>

<div data-testid="config-editor" class="flex flex-col gap-8">
	<!-- Energy Settings -->
	<section data-testid="energy-settings">
		<h3 class="mb-4 text-lg font-semibold text-gray-900">Energy Settings</h3>
		<p class="mb-4 text-sm text-gray-500">
			Controls how chat activity is weighted and smoothed into the energy score.
		</p>
		<div class="flex flex-col gap-5">
			<label class="flex flex-col gap-1">
				<div class="flex items-center justify-between">
					<span class="text-sm font-medium text-gray-700">Message Weight</span>
					<span class="text-xs text-gray-400">default: {defaults.energy.messageWeight}</span>
				</div>
				<p class="text-xs text-gray-500">
					How much each chat message contributes to the activity signal.
				</p>
				<div class="flex items-center gap-3">
					<input
						type="range"
						min="0"
						max="10"
						step="0.1"
						bind:value={messageWeight}
						class="w-full"
					/>
					<span class="w-12 text-right text-sm tabular-nums text-gray-700"
						>{messageWeight.toFixed(1)}</span
					>
				</div>
			</label>

			<label class="flex flex-col gap-1">
				<div class="flex items-center justify-between">
					<span class="text-sm font-medium text-gray-700">Chatter Weight</span>
					<span class="text-xs text-gray-400">default: {defaults.energy.chatterWeight}</span>
				</div>
				<p class="text-xs text-gray-500">
					How much each unique chatter contributes to the activity signal.
				</p>
				<div class="flex items-center gap-3">
					<input
						type="range"
						min="0"
						max="10"
						step="0.1"
						bind:value={chatterWeight}
						class="w-full"
					/>
					<span class="w-12 text-right text-sm tabular-nums text-gray-700"
						>{chatterWeight.toFixed(1)}</span
					>
				</div>
			</label>

			<label class="flex flex-col gap-1">
				<div class="flex items-center justify-between">
					<span class="text-sm font-medium text-gray-700">High-Value Event Weight</span>
					<span class="text-xs text-gray-400"
						>default: {defaults.energy.highValueWeight}</span
					>
				</div>
				<p class="text-xs text-gray-500">
					How much subs, bits, and donations contribute to the activity signal.
				</p>
				<div class="flex items-center gap-3">
					<input
						type="range"
						min="0"
						max="10"
						step="0.1"
						bind:value={highValueWeight}
						class="w-full"
					/>
					<span class="w-12 text-right text-sm tabular-nums text-gray-700"
						>{highValueWeight.toFixed(1)}</span
					>
				</div>
			</label>

			<label class="flex flex-col gap-1">
				<div class="flex items-center justify-between">
					<span class="text-sm font-medium text-gray-700">Baseline Smoothing</span>
					<span class="text-xs text-gray-400"
						>default: {defaults.energy.baselineAlpha}</span
					>
				</div>
				<p class="text-xs text-gray-500">
					EMA alpha for the rolling baseline. Lower values mean slower adaptation to new
					activity levels.
				</p>
				<div class="flex items-center gap-3">
					<input
						type="range"
						min="0.01"
						max="0.5"
						step="0.01"
						bind:value={baselineAlpha}
						class="w-full"
					/>
					<span class="w-12 text-right text-sm tabular-nums text-gray-700"
						>{baselineAlpha.toFixed(2)}</span
					>
				</div>
			</label>

			<label class="flex flex-col gap-1">
				<div class="flex items-center justify-between">
					<span class="text-sm font-medium text-gray-700">Energy Smoothing</span>
					<span class="text-xs text-gray-400">default: {defaults.energy.energyAlpha}</span>
				</div>
				<p class="text-xs text-gray-500">
					EMA alpha for the energy score. Lower values make energy change more gradually.
				</p>
				<div class="flex items-center gap-3">
					<input
						type="range"
						min="0.01"
						max="0.5"
						step="0.01"
						bind:value={energyAlpha}
						class="w-full"
					/>
					<span class="w-12 text-right text-sm tabular-nums text-gray-700"
						>{energyAlpha.toFixed(2)}</span
					>
				</div>
			</label>
		</div>
	</section>

	<!-- Mood Transitions -->
	<section data-testid="mood-transitions">
		<h3 class="mb-4 text-lg font-semibold text-gray-900">Mood Transitions</h3>
		<p class="mb-4 text-sm text-gray-500">
			Energy thresholds and hold times that control when the streamling changes mood. Hold
			times are in seconds.
		</p>
		<div class="flex flex-col gap-5">
			<!-- Sleeping -> Idle -->
			<div class="rounded-md border border-gray-200 p-4">
				<h4 class="mb-3 text-sm font-semibold text-gray-800">Sleeping to Idle</h4>

				<label class="mb-3 flex flex-col gap-1">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-gray-700">Energy Threshold</span>
						<span class="text-xs text-gray-400"
							>default: {defaults.moodTransition.sleepToIdleEnergyThreshold}</span
						>
					</div>
					<p class="text-xs text-gray-500">
						Energy level that can wake the streamling from sleep.
					</p>
					<div class="flex items-center gap-3">
						<input
							type="range"
							min="-2"
							max="2"
							step="0.1"
							bind:value={sleepToIdleThreshold}
							class="w-full"
						/>
						<span class="w-12 text-right text-sm tabular-nums text-gray-700"
							>{sleepToIdleThreshold.toFixed(1)}</span
						>
					</div>
				</label>

				<label class="mb-3 flex flex-col gap-1">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-gray-700">Hold Time (seconds)</span>
						<span class="text-xs text-gray-400"
							>default: {defaults.moodTransition.sleepToIdleHoldTime}s</span
						>
					</div>
					<p class="text-xs text-gray-500">
						How long energy must stay above threshold before waking.
					</p>
					<div class="flex items-center gap-3">
						<input
							type="range"
							min="0"
							max="600"
							step="10"
							bind:value={sleepToIdleHoldTime}
							class="w-full"
						/>
						<span class="w-12 text-right text-sm tabular-nums text-gray-700"
							>{sleepToIdleHoldTime}s</span
						>
					</div>
				</label>

				<label class="flex flex-col gap-1">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-gray-700"
							>Minimum Sleep Duration (seconds)</span
						>
						<span class="text-xs text-gray-400"
							>default: {defaults.moodTransition.sleepToIdleMinDuration}s</span
						>
					</div>
					<p class="text-xs text-gray-500">
						Minimum time the streamling must sleep before it can wake.
					</p>
					<div class="flex items-center gap-3">
						<input
							type="range"
							min="0"
							max="1800"
							step="30"
							bind:value={sleepToIdleMinDuration}
							class="w-full"
						/>
						<span class="w-14 text-right text-sm tabular-nums text-gray-700"
							>{sleepToIdleMinDuration}s</span
						>
					</div>
				</label>
			</div>

			<!-- Idle -> Engaged -->
			<div class="rounded-md border border-gray-200 p-4">
				<h4 class="mb-3 text-sm font-semibold text-gray-800">Idle to Engaged</h4>

				<label class="mb-3 flex flex-col gap-1">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-gray-700">Energy Threshold</span>
						<span class="text-xs text-gray-400"
							>default: {defaults.moodTransition.idleToEngagedEnergyThreshold}</span
						>
					</div>
					<p class="text-xs text-gray-500">
						Energy level needed for the streamling to become engaged.
					</p>
					<div class="flex items-center gap-3">
						<input
							type="range"
							min="-2"
							max="2"
							step="0.1"
							bind:value={idleToEngagedThreshold}
							class="w-full"
						/>
						<span class="w-12 text-right text-sm tabular-nums text-gray-700"
							>{idleToEngagedThreshold.toFixed(1)}</span
						>
					</div>
				</label>

				<label class="flex flex-col gap-1">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-gray-700">Hold Time (seconds)</span>
						<span class="text-xs text-gray-400"
							>default: {defaults.moodTransition.idleToEngagedHoldTime}s</span
						>
					</div>
					<p class="text-xs text-gray-500">
						How long energy must stay above threshold before engaging.
					</p>
					<div class="flex items-center gap-3">
						<input
							type="range"
							min="0"
							max="600"
							step="10"
							bind:value={idleToEngagedHoldTime}
							class="w-full"
						/>
						<span class="w-12 text-right text-sm tabular-nums text-gray-700"
							>{idleToEngagedHoldTime}s</span
						>
					</div>
				</label>
			</div>

			<!-- Engaged -> Partying -->
			<div class="rounded-md border border-gray-200 p-4">
				<h4 class="mb-3 text-sm font-semibold text-gray-800">Engaged to Partying</h4>

				<label class="mb-3 flex flex-col gap-1">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-gray-700">Energy Threshold</span>
						<span class="text-xs text-gray-400"
							>default: {defaults.moodTransition.engagedToPartyingEnergyThreshold}</span
						>
					</div>
					<p class="text-xs text-gray-500">
						Energy level needed to start partying.
					</p>
					<div class="flex items-center gap-3">
						<input
							type="range"
							min="0"
							max="4"
							step="0.1"
							bind:value={engagedToPartyingThreshold}
							class="w-full"
						/>
						<span class="w-12 text-right text-sm tabular-nums text-gray-700"
							>{engagedToPartyingThreshold.toFixed(1)}</span
						>
					</div>
				</label>

				<label class="flex flex-col gap-1">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-gray-700">Hold Time (seconds)</span>
						<span class="text-xs text-gray-400"
							>default: {defaults.moodTransition.engagedToPartyingHoldTime}s</span
						>
					</div>
					<p class="text-xs text-gray-500">
						How long energy must stay above threshold before partying.
					</p>
					<div class="flex items-center gap-3">
						<input
							type="range"
							min="0"
							max="600"
							step="10"
							bind:value={engagedToPartyingHoldTime}
							class="w-full"
						/>
						<span class="w-12 text-right text-sm tabular-nums text-gray-700"
							>{engagedToPartyingHoldTime}s</span
						>
					</div>
				</label>
			</div>

			<!-- Partying -> Engaged -->
			<div class="rounded-md border border-gray-200 p-4">
				<h4 class="mb-3 text-sm font-semibold text-gray-800">Partying to Engaged</h4>

				<label class="mb-3 flex flex-col gap-1">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-gray-700">Energy Threshold</span>
						<span class="text-xs text-gray-400"
							>default: {defaults.moodTransition.partyingToEngagedEnergyThreshold}</span
						>
					</div>
					<p class="text-xs text-gray-500">
						Energy level below which the streamling calms down from partying.
					</p>
					<div class="flex items-center gap-3">
						<input
							type="range"
							min="-2"
							max="4"
							step="0.1"
							bind:value={partyingToEngagedThreshold}
							class="w-full"
						/>
						<span class="w-12 text-right text-sm tabular-nums text-gray-700"
							>{partyingToEngagedThreshold.toFixed(1)}</span
						>
					</div>
				</label>

				<label class="mb-3 flex flex-col gap-1">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-gray-700">Hold Time (seconds)</span>
						<span class="text-xs text-gray-400"
							>default: {defaults.moodTransition.partyingToEngagedHoldTime}s</span
						>
					</div>
					<p class="text-xs text-gray-500">
						How long energy must stay below threshold before calming down.
					</p>
					<div class="flex items-center gap-3">
						<input
							type="range"
							min="0"
							max="600"
							step="10"
							bind:value={partyingToEngagedHoldTime}
							class="w-full"
						/>
						<span class="w-12 text-right text-sm tabular-nums text-gray-700"
							>{partyingToEngagedHoldTime}s</span
						>
					</div>
				</label>

				<label class="flex flex-col gap-1">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-gray-700"
							>Max Party Duration (seconds)</span
						>
						<span class="text-xs text-gray-400"
							>default: {defaults.moodTransition.partyingToEngagedMaxDuration}s</span
						>
					</div>
					<p class="text-xs text-gray-500">
						Maximum time the streamling can party before it must calm down.
					</p>
					<div class="flex items-center gap-3">
						<input
							type="range"
							min="60"
							max="1800"
							step="30"
							bind:value={partyingToEngagedMaxDuration}
							class="w-full"
						/>
						<span class="w-14 text-right text-sm tabular-nums text-gray-700"
							>{partyingToEngagedMaxDuration}s</span
						>
					</div>
				</label>
			</div>

			<!-- Engaged -> Idle -->
			<div class="rounded-md border border-gray-200 p-4">
				<h4 class="mb-3 text-sm font-semibold text-gray-800">Engaged to Idle</h4>

				<label class="mb-3 flex flex-col gap-1">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-gray-700">Energy Threshold</span>
						<span class="text-xs text-gray-400"
							>default: {defaults.moodTransition.engagedToIdleEnergyThreshold}</span
						>
					</div>
					<p class="text-xs text-gray-500">
						Energy level below which the streamling goes back to idle.
					</p>
					<div class="flex items-center gap-3">
						<input
							type="range"
							min="-2"
							max="2"
							step="0.1"
							bind:value={engagedToIdleThreshold}
							class="w-full"
						/>
						<span class="w-12 text-right text-sm tabular-nums text-gray-700"
							>{engagedToIdleThreshold.toFixed(1)}</span
						>
					</div>
				</label>

				<label class="flex flex-col gap-1">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-gray-700">Hold Time (seconds)</span>
						<span class="text-xs text-gray-400"
							>default: {defaults.moodTransition.engagedToIdleHoldTime}s</span
						>
					</div>
					<p class="text-xs text-gray-500">
						How long energy must stay below threshold before going idle.
					</p>
					<div class="flex items-center gap-3">
						<input
							type="range"
							min="0"
							max="600"
							step="10"
							bind:value={engagedToIdleHoldTime}
							class="w-full"
						/>
						<span class="w-12 text-right text-sm tabular-nums text-gray-700"
							>{engagedToIdleHoldTime}s</span
						>
					</div>
				</label>
			</div>

			<!-- Idle -> Sleeping -->
			<div class="rounded-md border border-gray-200 p-4">
				<h4 class="mb-3 text-sm font-semibold text-gray-800">Idle to Sleeping</h4>

				<label class="mb-3 flex flex-col gap-1">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-gray-700">Energy Threshold</span>
						<span class="text-xs text-gray-400"
							>default: {defaults.moodTransition.idleToSleepingEnergyThreshold}</span
						>
					</div>
					<p class="text-xs text-gray-500">
						Energy level below which the streamling falls asleep.
					</p>
					<div class="flex items-center gap-3">
						<input
							type="range"
							min="-2"
							max="2"
							step="0.1"
							bind:value={idleToSleepingThreshold}
							class="w-full"
						/>
						<span class="w-12 text-right text-sm tabular-nums text-gray-700"
							>{idleToSleepingThreshold.toFixed(1)}</span
						>
					</div>
				</label>

				<label class="flex flex-col gap-1">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-gray-700">Hold Time (seconds)</span>
						<span class="text-xs text-gray-400"
							>default: {defaults.moodTransition.idleToSleepingHoldTime}s</span
						>
					</div>
					<p class="text-xs text-gray-500">
						How long energy must stay below threshold before sleeping.
					</p>
					<div class="flex items-center gap-3">
						<input
							type="range"
							min="0"
							max="1800"
							step="30"
							bind:value={idleToSleepingHoldTime}
							class="w-full"
						/>
						<span class="w-14 text-right text-sm tabular-nums text-gray-700"
							>{idleToSleepingHoldTime}s</span
						>
					</div>
				</label>
			</div>
		</div>
	</section>

	<!-- Internal Drives -->
	<section data-testid="internal-drives-settings">
		<h3 class="mb-4 text-lg font-semibold text-gray-900">Internal Drives</h3>
		<p class="mb-4 text-sm text-gray-500">
			Autonomous drive rates that accumulate over time and can force mood transitions
			independently of chat activity.
		</p>
		<div class="flex flex-col gap-5">
			<div class="rounded-md border border-gray-200 p-4">
				<h4 class="mb-3 text-sm font-semibold text-gray-800">Drive Rates</h4>
				<p class="mb-3 text-xs text-gray-500">
					How quickly each drive accumulates per tick. Lower values produce slower, more
					gradual changes.
				</p>

				<label class="mb-3 flex flex-col gap-1">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-gray-700">Sleep Pressure Rate</span>
						<span class="text-xs text-gray-400"
							>default: {defaults.internalDrive.sleepPressureRate}</span
						>
					</div>
					<p class="text-xs text-gray-500">
						Rate at which sleep pressure builds while the streamling is awake.
					</p>
					<div class="flex items-center gap-3">
						<input
							type="range"
							min="0"
							max="0.01"
							step="0.0001"
							bind:value={sleepPressureRate}
							class="w-full"
						/>
						<span class="w-16 text-right text-sm tabular-nums text-gray-700"
							>{sleepPressureRate.toFixed(4)}</span
						>
					</div>
				</label>

				<label class="mb-3 flex flex-col gap-1">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-gray-700">Restedness Rate</span>
						<span class="text-xs text-gray-400"
							>default: {defaults.internalDrive.restednessRate}</span
						>
					</div>
					<p class="text-xs text-gray-500">
						Rate at which restedness builds while the streamling is sleeping.
					</p>
					<div class="flex items-center gap-3">
						<input
							type="range"
							min="0"
							max="0.01"
							step="0.0001"
							bind:value={restednessRate}
							class="w-full"
						/>
						<span class="w-16 text-right text-sm tabular-nums text-gray-700"
							>{restednessRate.toFixed(4)}</span
						>
					</div>
				</label>

				<label class="mb-3 flex flex-col gap-1">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-gray-700">Exhaustion Rate</span>
						<span class="text-xs text-gray-400"
							>default: {defaults.internalDrive.exhaustionRate}</span
						>
					</div>
					<p class="text-xs text-gray-500">
						Rate at which exhaustion builds while the streamling is partying.
					</p>
					<div class="flex items-center gap-3">
						<input
							type="range"
							min="0"
							max="0.05"
							step="0.001"
							bind:value={exhaustionRate}
							class="w-full"
						/>
						<span class="w-16 text-right text-sm tabular-nums text-gray-700"
							>{exhaustionRate.toFixed(3)}</span
						>
					</div>
				</label>

				<label class="flex flex-col gap-1">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-gray-700">Curiosity Rate</span>
						<span class="text-xs text-gray-400"
							>default: {defaults.internalDrive.curiosityRate}</span
						>
					</div>
					<p class="text-xs text-gray-500">
						Rate at which curiosity builds while the streamling is idle.
					</p>
					<div class="flex items-center gap-3">
						<input
							type="range"
							min="0"
							max="0.005"
							step="0.0001"
							bind:value={curiosityRate}
							class="w-full"
						/>
						<span class="w-16 text-right text-sm tabular-nums text-gray-700"
							>{curiosityRate.toFixed(4)}</span
						>
					</div>
				</label>
			</div>

			<div class="rounded-md border border-gray-200 p-4">
				<h4 class="mb-3 text-sm font-semibold text-gray-800">Drive Thresholds</h4>
				<p class="mb-3 text-xs text-gray-500">
					When a drive reaches its threshold, it can force a mood transition regardless of
					energy level.
				</p>

				<label class="mb-3 flex flex-col gap-1">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-gray-700">Sleep Pressure Threshold</span>
						<span class="text-xs text-gray-400"
							>default: {defaults.internalDrive.sleepPressureThreshold}</span
						>
					</div>
					<p class="text-xs text-gray-500">
						Forces the streamling to sleep when sleep pressure exceeds this value.
					</p>
					<div class="flex items-center gap-3">
						<input
							type="range"
							min="0"
							max="1"
							step="0.05"
							bind:value={sleepPressureThreshold}
							class="w-full"
						/>
						<span class="w-12 text-right text-sm tabular-nums text-gray-700"
							>{sleepPressureThreshold.toFixed(2)}</span
						>
					</div>
				</label>

				<label class="mb-3 flex flex-col gap-1">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-gray-700">Restedness Threshold</span>
						<span class="text-xs text-gray-400"
							>default: {defaults.internalDrive.restednessThreshold}</span
						>
					</div>
					<p class="text-xs text-gray-500">
						Forces the streamling to wake up when restedness exceeds this value.
					</p>
					<div class="flex items-center gap-3">
						<input
							type="range"
							min="0"
							max="1"
							step="0.05"
							bind:value={restednessThreshold}
							class="w-full"
						/>
						<span class="w-12 text-right text-sm tabular-nums text-gray-700"
							>{restednessThreshold.toFixed(2)}</span
						>
					</div>
				</label>

				<label class="flex flex-col gap-1">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-gray-700">Exhaustion Threshold</span>
						<span class="text-xs text-gray-400"
							>default: {defaults.internalDrive.exhaustionThreshold}</span
						>
					</div>
					<p class="text-xs text-gray-500">
						Forces the streamling to calm down from partying when exhaustion exceeds this
						value.
					</p>
					<div class="flex items-center gap-3">
						<input
							type="range"
							min="0"
							max="1"
							step="0.05"
							bind:value={exhaustionThreshold}
							class="w-full"
						/>
						<span class="w-12 text-right text-sm tabular-nums text-gray-700"
							>{exhaustionThreshold.toFixed(2)}</span
						>
					</div>
				</label>
			</div>
		</div>
	</section>

	<!-- Save Button -->
	<div class="flex items-center gap-4">
		<button
			onclick={handleSave}
			disabled={saving}
			class="rounded-md bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
		>
			{saving ? 'Saving...' : 'Save Changes'}
		</button>
	</div>
</div>
