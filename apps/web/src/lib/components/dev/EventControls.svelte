<script>
	/** @type {{ workerUrl: string, streamerId: string }} */
	let { workerUrl, streamerId } = $props();

	let chatMessage = $state('');

	const userPool = Array.from({ length: 20 }, () =>
		String(100000 + Math.floor(Math.random() * 900000))
	);

	function randomUser() {
		const id = userPool[Math.floor(Math.random() * userPool.length)];
		return { user_id: id, user_name: `User${id}` };
	}

	/**
	 * @param {string} type
	 * @param {Record<string, unknown>} [extraEvent]
	 */
	async function sendEvent(type, extraEvent = {}) {
		const user = randomUser();
		try {
			await fetch(`${workerUrl}/webhook`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					subscription: { type },
					event: {
						internal_user_id: streamerId,
						...user,
						...extraEvent
					}
				})
			});
		} catch (e) {
			console.error('Failed to send event:', e);
		}
	}

	function sendChat() {
		const text = chatMessage.trim() || 'simulated message';
		sendEvent('channel.chat.message', { message: { text } });
		chatMessage = '';
	}

	function sendFollow() {
		sendEvent('channel.follow');
	}

	function sendSubscribe() {
		sendEvent('channel.subscribe', { tier: '1000' });
	}

	function sendCheer() {
		const bits = 100 + Math.floor(Math.random() * 901);
		sendEvent('channel.cheer', { bits });
	}

	function sendGiftSub() {
		const total = 1 + Math.floor(Math.random() * 10);
		sendEvent('channel.subscription.gift', { total });
	}

	function sendRaid() {
		const viewers = 10 + Math.floor(Math.random() * 491);
		sendEvent('channel.raid', { viewers });
	}

	/** @param {KeyboardEvent} e */
	function handleKeydown(e) {
		if (e.key === 'Enter') {
			e.preventDefault();
			sendChat();
		}
	}
</script>

<div>
	<h3 class="mb-3 text-sm font-semibold text-gray-300">Quick Events</h3>

	<div class="mb-3 grid grid-cols-3 gap-2">
		<button
			onclick={sendChat}
			class="cursor-pointer rounded border-0 bg-gray-700 px-2 py-1.5 text-sm text-gray-100 hover:bg-gray-600"
		>
			Chat
		</button>
		<button
			onclick={sendFollow}
			class="cursor-pointer rounded border-0 bg-gray-700 px-2 py-1.5 text-sm text-gray-100 hover:bg-gray-600"
		>
			Follow
		</button>
		<button
			onclick={sendSubscribe}
			class="cursor-pointer rounded border-0 bg-amber-800 px-2 py-1.5 text-sm text-amber-100 hover:bg-amber-700"
		>
			Sub
		</button>
		<button
			onclick={sendCheer}
			class="cursor-pointer rounded border-0 bg-purple-800 px-2 py-1.5 text-sm text-purple-100 hover:bg-purple-700"
		>
			Cheer
		</button>
		<button
			onclick={sendGiftSub}
			class="cursor-pointer rounded border-0 bg-pink-800 px-2 py-1.5 text-sm text-pink-100 hover:bg-pink-700"
		>
			Gift Sub
		</button>
		<button
			onclick={sendRaid}
			class="cursor-pointer rounded border-0 bg-blue-800 px-2 py-1.5 text-sm text-blue-100 hover:bg-blue-700"
		>
			Raid
		</button>
	</div>

	<div class="flex gap-2">
		<input
			type="text"
			bind:value={chatMessage}
			onkeydown={handleKeydown}
			placeholder="Type a chat message..."
			class="flex-1 rounded bg-gray-800 px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 ring-1 ring-gray-700 outline-none focus:ring-gray-500"
		/>
		<button
			onclick={sendChat}
			class="cursor-pointer rounded border-0 bg-emerald-700 px-3 py-1.5 text-sm font-medium text-emerald-100 hover:bg-emerald-600"
		>
			Send
		</button>
	</div>
</div>
