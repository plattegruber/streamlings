<script>
	/** @type {{ workerUrl: string, streamerId: string }} */
	let { workerUrl, streamerId } = $props();

	let running = $state(false);
	let phase = $state('');
	let round = $state(0);
	let totalRounds = $state(0);
	let speed = $state(10);
	let cancelRequested = false;

	/** Total rounds across all 4 phases */
	const TOTAL_SIM_ROUNDS = 72;

	/** Track completed phases for overall progress */
	let completedPhaseRounds = $state(0);

	const overallProgress = $derived(
		running ? Math.round(((completedPhaseRounds + round) / TOTAL_SIM_ROUNDS) * 100) : 0
	);

	const userPool = Array.from({ length: 20 }, () =>
		String(100000 + Math.floor(Math.random() * 900000))
	);

	/**
	 * @param {number} count
	 * @returns {string[]}
	 */
	function pickUsers(count) {
		const picked = [];
		for (let i = 0; i < count; i++) {
			picked.push(userPool[Math.floor(Math.random() * userPool.length)]);
		}
		return picked;
	}

	/** @param {string} userId */
	function sendChat(userId) {
		fetch(`${workerUrl}/webhook`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				subscription: { type: 'channel.chat.message' },
				event: {
					internal_user_id: streamerId,
					user_id: userId,
					user_name: `User${userId}`,
					message: { text: 'simulated message' }
				}
			})
		}).catch(() => {});
	}

	function sendHighValue() {
		const types = ['channel.subscribe', 'channel.cheer', 'channel.subscription.gift'];
		const chosen = types[Math.floor(Math.random() * types.length)];
		const userId = userPool[Math.floor(Math.random() * userPool.length)];

		/** @type {Record<string, unknown>} */
		const event = {
			internal_user_id: streamerId,
			user_id: userId,
			user_name: `User${userId}`
		};

		if (chosen === 'channel.subscription.gift') {
			event.total = 5;
		} else if (chosen === 'channel.cheer') {
			event.bits = 500;
		}

		fetch(`${workerUrl}/webhook`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				subscription: { type: chosen },
				event
			})
		}).catch(() => {});
	}

	/** @param {number} ms */
	function delay(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * @param {string} name
	 * @param {number} rounds
	 * @param {(round: number, total: number) => void} roundFn
	 */
	async function runPhase(name, rounds, roundFn) {
		phase = name;
		totalRounds = rounds;
		for (let i = 1; i <= rounds; i++) {
			if (cancelRequested) return;
			round = i;
			roundFn(i, rounds);
			const sleepMs = Math.max(50, 10000 / speed);
			await delay(sleepMs);
		}
		completedPhaseRounds += rounds;
	}

	async function start() {
		running = true;
		cancelRequested = false;
		completedPhaseRounds = 0;
		round = 0;

		// Phase 1: Quiet
		await runPhase('Quiet', 18, () => {
			const msgs = 1 + Math.floor(Math.random() * 2);
			const [userId] = pickUsers(1);
			for (let i = 0; i < msgs; i++) {
				sendChat(userId);
			}
		});
		if (cancelRequested) {
			running = false;
			return;
		}

		// Phase 2: Ramp Up
		await runPhase('Ramp Up', 18, (r, total) => {
			const msgs = Math.floor(3 + (r * 9) / total);
			const chatterCount = Math.floor(2 + (r * 6) / total);
			const users = pickUsers(chatterCount);
			let sent = 0;
			for (const userId of users) {
				const perUser = Math.floor(msgs / chatterCount) + 1;
				for (let i = 0; i < perUser && sent < msgs; i++) {
					sendChat(userId);
					sent++;
				}
			}
			if (r % 3 === 0) sendHighValue();
		});
		if (cancelRequested) {
			running = false;
			return;
		}

		// Phase 3: Hype
		await runPhase('Hype', 18, (r) => {
			const msgs = 15 + Math.floor(Math.random() * 6);
			const chatterCount = 8 + Math.floor(Math.random() * 5);
			const users = pickUsers(chatterCount);
			let sent = 0;
			for (const userId of users) {
				const perUser = Math.floor(msgs / chatterCount) + 1;
				for (let i = 0; i < perUser && sent < msgs; i++) {
					sendChat(userId);
					sent++;
				}
			}
			sendHighValue();
			if (r % 2 === 0) sendHighValue();
		});
		if (cancelRequested) {
			running = false;
			return;
		}

		// Phase 4: Cool Down
		await runPhase('Cool Down', 18, (r, total) => {
			const msgs = Math.max(0, Math.floor(15 - (r * 15) / total));
			if (msgs === 0) return;
			const chatterCount = Math.max(1, Math.floor(msgs / 2));
			const users = pickUsers(chatterCount);
			let sent = 0;
			for (const userId of users) {
				const perUser = Math.floor(msgs / chatterCount) + 1;
				for (let i = 0; i < perUser && sent < msgs; i++) {
					sendChat(userId);
					sent++;
				}
			}
		});

		running = false;
	}

	function stop() {
		cancelRequested = true;
	}

	const SPEED_STEPS = [1, 5, 10, 50, 100];

	/** @param {Event} e */
	function handleSpeedChange(e) {
		const target = /** @type {HTMLInputElement} */ (e.target);
		speed = SPEED_STEPS[Number(target.value)];
	}

	const speedIndex = $derived(SPEED_STEPS.indexOf(speed));

	const estimatedDuration = $derived(() => {
		const totalSeconds = (TOTAL_SIM_ROUNDS * 10) / speed;
		if (totalSeconds >= 60) {
			return `~${Math.round(totalSeconds / 60)}m ${Math.round(totalSeconds % 60)}s`;
		}
		return `~${Math.round(totalSeconds)}s`;
	});
</script>

<div>
	<h3 class="mb-3 text-sm font-semibold text-gray-300">Simulate Chat</h3>

	<div class="mb-3 flex items-center gap-3">
		{#if running}
			<button
				onclick={stop}
				class="cursor-pointer rounded border-0 bg-red-700 px-3 py-1.5 text-sm font-medium text-red-100 hover:bg-red-600"
			>
				Stop
			</button>
		{:else}
			<button
				onclick={start}
				class="cursor-pointer rounded border-0 bg-emerald-700 px-3 py-1.5 text-sm font-medium text-emerald-100 hover:bg-emerald-600"
			>
				Full Sim
			</button>
		{/if}

		<div class="flex flex-1 items-center gap-2 text-xs text-gray-400">
			<span>Speed:</span>
			<input
				type="range"
				min="0"
				max={SPEED_STEPS.length - 1}
				value={speedIndex}
				oninput={handleSpeedChange}
				disabled={running}
				class="h-1.5 flex-1 cursor-pointer accent-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
			/>
			<span class="w-10 text-right font-mono text-gray-200">{speed}x</span>
		</div>
	</div>

	{#if !running}
		<p class="text-xs text-gray-500">
			4 phases, 72 rounds ({estimatedDuration()})
		</p>
	{/if}

	{#if running}
		<div class="space-y-1.5">
			<div class="flex items-center justify-between text-xs">
				<span class="text-gray-300">{phase}</span>
				<span class="text-gray-400">Round {round}/{totalRounds}</span>
			</div>
			<div class="h-2 overflow-hidden rounded-full bg-gray-800">
				<div
					class="h-full rounded-full bg-emerald-500 transition-all duration-300"
					style="width: {overallProgress}%"
				></div>
			</div>
			<div class="text-right text-xs text-gray-500">{overallProgress}%</div>
		</div>
	{/if}
</div>
