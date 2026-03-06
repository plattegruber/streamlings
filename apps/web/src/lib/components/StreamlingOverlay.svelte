<script>
	import { onMount } from 'svelte';
	import { groups } from '$lib/assets/streamling-paths.js';
	import { moodToNumber, getAnimationState } from '$lib/rendering/mood-animation.js';
	import {
		updateZParticles,
		drawZParticles,
		updateSparkles,
		drawSparkles,
		updateConfetti,
		drawConfetti
	} from '$lib/rendering/particles.js';

	/**
	 * @type {{ mood?: string | null }}
	 */
	let { mood = 'idle' } = $props();

	const safeMood = $derived(mood ?? 'idle');

	// Mutable variable shared between $effect and the animation loop closure.
	// The $effect writes to it when the mood prop changes;
	// the requestAnimationFrame loop reads it each frame.
	let moodTarget = 1;

	$effect(() => {
		moodTarget = moodToNumber(safeMood);
	});

	/** @type {HTMLCanvasElement} */
	let canvas;

	onMount(() => {
		const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
		let animFrame = 0;
		let lastTime = 0;

		// --- SVG → Canvas mapping ---
		const SVG_CX = 512;
		const SVG_CY = 749;
		const SCALE = 460 / 784;

		// --- Pre-built Path2D objects (created once) ---
		/** @type {Record<string, { fill: string, path: Path2D }[]>} */
		const pathGroups = {};
		for (const [name, paths] of Object.entries(groups)) {
			pathGroups[name] = paths.map((p) => ({
				fill: p.fill,
				path: new Path2D(p.d)
			}));
		}

		// --- Animation State ---
		let time = 0;
		let currentMood = moodTarget;
		let idleVariant = 0;
		let idleTimer = 5;

		// --- Particle Arrays ---
		/** @type {import('$lib/rendering/particles.js').ZParticle[]} */
		let zParticles = [];
		/** @type {import('$lib/rendering/particles.js').Sparkle[]} */
		let sparkles = [];
		/** @type {import('$lib/rendering/particles.js').ConfettiParticle[]} */
		let confetti = [];

		// --- Spawn Timers ---
		let zState = { timer: 0 };
		let sparkleState = { timer: 0 };
		let confettiState = { timer: 0 };

		// ================================================================
		// SVG Drawing Functions
		// ================================================================

		/**
		 * @param {CanvasRenderingContext2D} c
		 * @param {string} groupName
		 */
		function drawSVGGroup(c, groupName) {
			const group = pathGroups[groupName];
			if (!group) return;
			for (const { fill, path } of group) {
				c.fillStyle = fill;
				c.fill(path);
			}
		}

		/**
		 * @param {CanvasRenderingContext2D} c
		 * @param {number} leafSway
		 * @param {number} droop
		 */
		function drawLeaves(c, leafSway, droop) {
			c.save();
			c.translate(512, 820);
			c.rotate(leafSway * 0.004);
			c.scale(1, 1 - droop * 0.15);
			c.translate(-512, -820);
			drawSVGGroup(c, 'leaves');
			drawSVGGroup(c, 'buds');
			c.restore();
		}

		/**
		 * @param {CanvasRenderingContext2D} c
		 * @param {number} bounceY
		 */
		function drawShadow(c, bounceY) {
			const shadowScale = 1 - bounceY * 0.003;
			c.save();
			c.scale(SCALE, SCALE);
			c.translate(-SVG_CX, -SVG_CY);
			c.translate(612, 1122);
			c.scale(shadowScale, 1);
			c.translate(-612, -1122);
			drawSVGGroup(c, 'shadow');
			c.restore();
		}

		/**
		 * @param {CanvasRenderingContext2D} c
		 * @param {number} eyeState
		 * @param {number} blushAlpha
		 */
		function drawFace(c, eyeState, blushAlpha) {
			const eyeY = 955;
			const eyeXL = 420;
			const eyeXR = 600;
			const whiteR = 42;
			const irisR = 30;
			const irisWide = 36;
			const highlightR = 10;

			for (const ex of [eyeXL, eyeXR]) {
				c.beginPath();
				c.arc(ex, eyeY, whiteR, 0, Math.PI * 2);
				c.fillStyle = '#FFF';
				c.fill();

				if (eyeState === 1) {
					c.beginPath();
					c.arc(ex, eyeY - 4, irisR, 0.1 * Math.PI, 0.9 * Math.PI);
					c.strokeStyle = 'rgb(80, 40, 20)';
					c.lineWidth = 5;
					c.lineCap = 'round';
					c.stroke();
				} else {
					let r = eyeState === 2 ? irisWide : irisR;
					let ox = eyeState === 3 ? -8 : eyeState === 4 ? 8 : 0;
					c.beginPath();
					c.arc(ex + ox, eyeY, r, 0, Math.PI * 2);
					c.fillStyle = '#2A0D0F';
					c.fill();
					c.beginPath();
					c.arc(ex + ox + 6, eyeY - 6, highlightR, 0, Math.PI * 2);
					c.fillStyle = '#FFF';
					c.fill();
				}
			}

			// Cheeks
			c.beginPath();
			c.arc(380, 1000, 20, 0, Math.PI * 2);
			c.fillStyle = `rgba(255, 140, 140, ${blushAlpha})`;
			c.fill();
			c.beginPath();
			c.arc(640, 1000, 20, 0, Math.PI * 2);
			c.fillStyle = `rgba(255, 140, 140, ${blushAlpha})`;
			c.fill();

			// Mouth
			c.beginPath();
			c.moveTo(490, 1010);
			c.quadraticCurveTo(510, 1025, 530, 1010);
			c.quadraticCurveTo(510, 1035, 490, 1010);
			c.fillStyle = 'rgb(180, 60, 80)';
			c.fill();
		}

		// ================================================================
		// Main Draw + Loop
		// ================================================================

		/** @param {CanvasRenderingContext2D} c */
		function drawPlant(c) {
			const state = getAnimationState(currentMood, time, idleVariant);

			// Shadow stays on ground (outside bounce transform)
			drawShadow(c, state.bounceY);

			c.save();
			// Animation transforms (canvas space)
			c.translate(state.swayX, -state.bounceY);
			c.rotate(state.rotation);
			// Map SVG → canvas
			c.scale(SCALE, SCALE);
			c.translate(-SVG_CX, -SVG_CY);

			// Draw SVG groups (back to front)
			drawLeaves(c, state.vineWave, state.droop);
			drawSVGGroup(c, 'pot');
			drawSVGGroup(c, 'soil');
			drawSVGGroup(c, 'highlight');
			drawFace(c, state.eyeState, state.blushAlpha);

			c.restore();

			// Particles (canvas space, drawn after restore)
			drawZParticles(c, zParticles);
			drawSparkles(c, sparkles);
			drawConfetti(c, confetti);
		}

		/** @param {number} dt */
		function advance(dt) {
			time += dt;
			// Read from the component-level moodTarget (updated by $effect)
			currentMood += (moodTarget - currentMood) * Math.min(1, dt * 4);

			if (Math.round(currentMood) === 1) {
				idleTimer -= dt;
				if (idleTimer <= 0) {
					idleVariant = (idleVariant + 1) % 3;
					idleTimer = 5 + Math.random() * 3;
				}
			}

			updateZParticles(zParticles, dt, currentMood, zState);
			updateSparkles(sparkles, dt, currentMood, sparkleState);
			updateConfetti(confetti, dt, currentMood, confettiState);
		}

		/** @param {number} timestamp */
		function animate(timestamp) {
			const dt = lastTime ? (timestamp - lastTime) / 1000 : 0;
			lastTime = timestamp;
			advance(dt);

			ctx.save();
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, 512, 512);
			ctx.restore();

			drawPlant(ctx);
			animFrame = requestAnimationFrame(animate);
		}

		ctx.translate(256, 256);
		animFrame = requestAnimationFrame(animate);

		return () => {
			cancelAnimationFrame(animFrame);
		};
	});
</script>

<div
	data-testid="streamling-overlay"
	class="streamling-container"
	role="img"
	aria-label="Streamling in {safeMood} mood"
>
	<canvas bind:this={canvas} width="512" height="512"></canvas>
</div>

<style>
	.streamling-container {
		position: relative;
		width: 512px;
		height: 512px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	canvas {
		display: block;
		background: transparent;
	}
</style>
