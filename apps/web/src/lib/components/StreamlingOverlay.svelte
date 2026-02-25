<script>
	/**
	 * @type {{ mood?: string | null }}
	 */
	let { mood = 'idle' } = $props();

	const safeMood = $derived(mood ?? 'idle');

	const moodClass = $derived(getMoodClass(safeMood));

	/**
	 * @param {string} state
	 * @returns {'sleeping' | 'idle' | 'engaged' | 'partying'}
	 */
	function getMoodClass(state) {
		switch (state) {
			case 'sleeping':
				return 'sleeping';
			case 'engaged':
				return 'engaged';
			case 'partying':
				return 'partying';
			default:
				return 'idle';
		}
	}
</script>

<div
	data-testid="streamling-overlay"
	class="streamling-container mood-{moodClass}"
	role="img"
	aria-label="Streamling in {safeMood} mood"
>
	<!-- Body blob -->
	<div class="streamling-body">
		<!-- Eyes -->
		<div class="streamling-eyes">
			<div class="eye eye-left"></div>
			<div class="eye eye-right"></div>
		</div>

		<!-- Mouth -->
		<div class="streamling-mouth"></div>
	</div>

	<!-- Zzz particles for sleeping -->
	{#if moodClass === 'sleeping'}
		<div class="zzz-container" aria-hidden="true">
			<span class="zzz zzz-1">z</span>
			<span class="zzz zzz-2">z</span>
			<span class="zzz zzz-3">z</span>
		</div>
	{/if}

	<!-- Sparkle particles for partying -->
	{#if moodClass === 'partying'}
		<div class="sparkle-container" aria-hidden="true">
			<span class="sparkle sparkle-1"></span>
			<span class="sparkle sparkle-2"></span>
			<span class="sparkle sparkle-3"></span>
			<span class="sparkle sparkle-4"></span>
		</div>
	{/if}
</div>

<style>
	/* ================================================================
	   Container
	   ================================================================ */
	.streamling-container {
		position: relative;
		width: 200px;
		height: 200px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* ================================================================
	   Body blob
	   ================================================================ */
	.streamling-body {
		position: relative;
		width: 120px;
		height: 120px;
		border-radius: 50%;
		transition:
			background 1.5s ease,
			box-shadow 1.5s ease,
			transform 0.3s ease;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	/* ================================================================
	   Eyes
	   ================================================================ */
	.streamling-eyes {
		display: flex;
		gap: 20px;
		position: relative;
		top: -4px;
	}

	.eye {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: white;
		transition:
			height 1s ease,
			width 1s ease,
			border-radius 1s ease,
			opacity 1s ease;
	}

	/* ================================================================
	   Mouth
	   ================================================================ */
	.streamling-mouth {
		width: 16px;
		height: 8px;
		border-radius: 0 0 8px 8px;
		background: transparent;
		border-bottom: 2px solid rgba(255, 255, 255, 0.6);
		border-left: 2px solid rgba(255, 255, 255, 0.6);
		border-right: 2px solid rgba(255, 255, 255, 0.6);
		transition: all 1s ease;
		position: relative;
		top: -2px;
	}

	/* ================================================================
	   Sleeping state
	   ================================================================ */
	.mood-sleeping .streamling-body {
		background: linear-gradient(135deg, #6366f1, #818cf8);
		box-shadow:
			0 0 30px rgba(99, 102, 241, 0.3),
			0 0 60px rgba(99, 102, 241, 0.1);
		animation: breathing 4s ease-in-out infinite;
		opacity: 0.8;
	}

	.mood-sleeping .eye {
		height: 3px;
		border-radius: 3px;
		opacity: 0.6;
	}

	.mood-sleeping .streamling-mouth {
		width: 10px;
		height: 5px;
		border-radius: 50%;
		border: 2px solid rgba(255, 255, 255, 0.4);
		border-top: none;
	}

	/* ================================================================
	   Idle state
	   ================================================================ */
	.mood-idle .streamling-body {
		background: linear-gradient(135deg, #94a3b8, #a5b4c8);
		box-shadow:
			0 0 20px rgba(148, 163, 184, 0.2),
			0 0 40px rgba(148, 163, 184, 0.1);
		animation: sway 5s ease-in-out infinite;
	}

	.mood-idle .eye {
		height: 12px;
		opacity: 0.9;
	}

	.mood-idle .streamling-mouth {
		width: 14px;
		height: 6px;
	}

	/* ================================================================
	   Engaged state
	   ================================================================ */
	.mood-engaged .streamling-body {
		background: linear-gradient(135deg, #f59e0b, #fbbf24);
		box-shadow:
			0 0 30px rgba(245, 158, 11, 0.3),
			0 0 60px rgba(245, 158, 11, 0.15);
		animation: bounce 1.5s ease-in-out infinite;
	}

	.mood-engaged .eye {
		height: 16px;
		width: 16px;
	}

	.mood-engaged .streamling-mouth {
		width: 20px;
		height: 10px;
		border-color: rgba(255, 255, 255, 0.8);
	}

	/* ================================================================
	   Partying state
	   ================================================================ */
	.mood-partying .streamling-body {
		background: linear-gradient(135deg, #ec4899, #f472b6);
		box-shadow:
			0 0 40px rgba(236, 72, 153, 0.4),
			0 0 80px rgba(236, 72, 153, 0.2);
		animation: dance 0.8s ease-in-out infinite;
	}

	.mood-partying .eye {
		height: 10px;
		width: 16px;
		border-radius: 8px 8px 0 0;
	}

	.mood-partying .streamling-mouth {
		width: 24px;
		height: 12px;
		border-color: rgba(255, 255, 255, 0.9);
	}

	/* ================================================================
	   Zzz particles (sleeping)
	   ================================================================ */
	.zzz-container {
		position: absolute;
		top: 20px;
		right: 30px;
		pointer-events: none;
	}

	.zzz {
		position: absolute;
		font-size: 14px;
		font-weight: 700;
		color: #a5b4fc;
		opacity: 0;
		animation: float-zzz 3s ease-in-out infinite;
	}

	.zzz-1 {
		font-size: 12px;
		animation-delay: 0s;
	}

	.zzz-2 {
		font-size: 16px;
		animation-delay: 1s;
	}

	.zzz-3 {
		font-size: 20px;
		animation-delay: 2s;
	}

	/* ================================================================
	   Sparkle particles (partying)
	   ================================================================ */
	.sparkle-container {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.sparkle {
		position: absolute;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		opacity: 0;
	}

	.sparkle-1 {
		background: #fde68a;
		top: 15%;
		left: 20%;
		animation: sparkle-pop 2s ease-in-out infinite;
	}

	.sparkle-2 {
		background: #a78bfa;
		top: 25%;
		right: 15%;
		animation: sparkle-pop 2s ease-in-out 0.5s infinite;
	}

	.sparkle-3 {
		background: #34d399;
		bottom: 25%;
		left: 15%;
		animation: sparkle-pop 2s ease-in-out 1s infinite;
	}

	.sparkle-4 {
		background: #60a5fa;
		bottom: 20%;
		right: 20%;
		animation: sparkle-pop 2s ease-in-out 1.5s infinite;
	}

	/* ================================================================
	   Keyframes
	   ================================================================ */
	@keyframes breathing {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.05);
		}
	}

	@keyframes sway {
		0%,
		100% {
			transform: translateX(0) rotate(0deg);
		}
		25% {
			transform: translateX(-3px) rotate(-1deg);
		}
		75% {
			transform: translateX(3px) rotate(1deg);
		}
	}

	@keyframes bounce {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-8px);
		}
	}

	@keyframes dance {
		0%,
		100% {
			transform: translateY(0) rotate(0deg);
		}
		25% {
			transform: translateY(-10px) rotate(-5deg);
		}
		75% {
			transform: translateY(-10px) rotate(5deg);
		}
	}

	@keyframes float-zzz {
		0% {
			opacity: 0;
			transform: translate(0, 0);
		}
		20% {
			opacity: 0.8;
		}
		100% {
			opacity: 0;
			transform: translate(15px, -40px);
		}
	}

	@keyframes sparkle-pop {
		0%,
		100% {
			opacity: 0;
			transform: scale(0);
		}
		50% {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
