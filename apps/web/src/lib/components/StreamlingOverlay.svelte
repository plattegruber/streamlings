<script>
	import { onMount } from 'svelte';
	import { groups } from '$lib/assets/streamling-paths.js';

	/**
	 * @type {{ mood?: string | null }}
	 */
	let { mood = 'idle' } = $props();

	const safeMood = $derived(mood ?? 'idle');

	/**
	 * Map mood string to numeric target (0-3).
	 * @param {string} state
	 * @returns {number}
	 */
	function moodToNumber(state) {
		switch (state) {
			case 'sleeping':
				return 0;
			case 'engaged':
				return 2;
			case 'partying':
				return 3;
			default:
				return 1;
		}
	}

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
		/** @type {{ x: number, y: number, life: number, maxLife: number, size: number }[]} */
		let zParticles = [];
		/** @type {{ x: number, y: number, life: number, maxLife: number, size: number }[]} */
		let sparkles = [];
		/** @type {{ x: number, y: number, vx: number, vy: number, life: number, maxLife: number, colorIdx: number, size: number, shape: number }[]} */
		let confetti = [];

		// --- Spawn Timers ---
		let zSpawnTimer = 0;
		let sparkleSpawnTimer = 0;
		let confettiSpawnTimer = 0;

		// ================================================================
		// Helpers
		// ================================================================

		/** @param {number} a @param {number} b @param {number} t */
		function lerp(a, b, t) {
			return a + (b - a) * t;
		}

		// ================================================================
		// State Parameters
		// ================================================================

		/**
		 * @param {number} state
		 * @param {number} t
		 * @param {number} variant
		 */
		function getStateParams(state, t, variant) {
			switch (state) {
				case 0:
					return {
						eyeState: 1,
						bounceY: Math.sin((t * Math.PI) / 2) * 4,
						rotation: 0,
						vineWave: -3,
						droop: 0.6,
						perk: 0,
						blushAlpha: 0.3,
						swayX: 0
					};
				case 1: {
					let eyeState = 0;
					let swayX = 0;
					let vineWave = Math.sin(t * 0.8) * 2;
					if (variant === 0) {
						swayX = Math.sin(t * 1.2) * 3;
						const blinkCycle = t % 4;
						if (blinkCycle > 3.8 && blinkCycle < 3.95) eyeState = 1;
					} else if (variant === 1) {
						vineWave = Math.sin(t * 1.5) * 5;
						const lookCycle = t % 5;
						if (lookCycle < 1.5) eyeState = 3;
						else if (lookCycle < 3) eyeState = 4;
					} else if (variant === 2) {
						vineWave = Math.sin(t * 2.5) * 4;
					}
					return {
						eyeState,
						bounceY: 0,
						rotation: 0,
						vineWave,
						droop: 0,
						perk: 0,
						blushAlpha: 0.5,
						swayX
					};
				}
				case 2:
					return {
						eyeState: 2,
						bounceY: Math.abs(Math.sin((t * Math.PI) / 0.75)) * 8,
						rotation: 0,
						vineWave: Math.sin(t * 2) * 6,
						droop: 0,
						perk: 0.1,
						blushAlpha: 0.6,
						swayX: 0
					};
				case 3:
					return {
						eyeState: 2,
						bounceY: Math.abs(Math.sin((t * Math.PI) / 0.4)) * 12,
						rotation: Math.sin(t * 4) * 0.05,
						vineWave: Math.sin(t * 3) * 10,
						droop: 0,
						perk: 0.15,
						blushAlpha: 0.9,
						swayX: 0
					};
				default:
					return getStateParams(1, t, 0);
			}
		}

		/**
		 * @param {number} m
		 * @param {number} t
		 * @param {number} variant
		 */
		function getAnimationState(m, t, variant) {
			const lower = Math.floor(Math.max(0, Math.min(3, m)));
			const upper = Math.min(3, lower + 1);
			const blend = m - lower;
			const stateA = getStateParams(lower, t, variant);
			const stateB = getStateParams(upper, t, variant);

			return {
				eyeState: blend < 0.5 ? stateA.eyeState : stateB.eyeState,
				bounceY: lerp(stateA.bounceY, stateB.bounceY, blend),
				rotation: lerp(stateA.rotation, stateB.rotation, blend),
				vineWave: lerp(stateA.vineWave, stateB.vineWave, blend),
				droop: lerp(stateA.droop, stateB.droop, blend),
				perk: lerp(stateA.perk, stateB.perk, blend),
				blushAlpha: lerp(stateA.blushAlpha, stateB.blushAlpha, blend),
				swayX: lerp(stateA.swayX, stateB.swayX, blend)
			};
		}

		// ================================================================
		// Particle Systems
		// ================================================================

		/** @param {number} dt */
		function updateZParticles(dt) {
			zSpawnTimer += dt;
			const nearSleep = currentMood < 0.5;
			if (nearSleep && zSpawnTimer >= 1 / 1.5) {
				zSpawnTimer -= 1 / 1.5;
				zParticles.push({
					x: 20 + Math.random() * 10,
					y: -200,
					life: 0,
					maxLife: 2.5,
					size: 8 + Math.random() * 6
				});
			}
			if (!nearSleep) zSpawnTimer = 0;
			for (let i = zParticles.length - 1; i >= 0; i--) {
				const p = zParticles[i];
				p.life += dt;
				p.y -= 30 * dt;
				p.x += Math.sin(p.life * 2) * 15 * dt;
				if (p.life >= p.maxLife) zParticles.splice(i, 1);
			}
		}

		/** @param {CanvasRenderingContext2D} c */
		function drawZParticles(c) {
			for (const p of zParticles) {
				const alpha = 1 - p.life / p.maxLife;
				c.save();
				c.globalAlpha = alpha;
				c.font = `bold ${p.size}px sans-serif`;
				c.fillStyle = 'rgb(180, 200, 255)';
				c.fillText('z', p.x, p.y);
				c.restore();
			}
		}

		/** @param {number} dt */
		function updateSparkles(dt) {
			sparkleSpawnTimer += dt;
			const nearEngaged = currentMood >= 1.5 && currentMood < 2.8;
			if (nearEngaged && sparkleSpawnTimer >= 0.5) {
				sparkleSpawnTimer -= 0.5;
				sparkles.push({
					x: (Math.random() - 0.5) * 200,
					y: -200 + Math.random() * 300,
					life: 0,
					maxLife: 0.8,
					size: 3 + Math.random() * 4
				});
			}
			if (!nearEngaged) sparkleSpawnTimer = 0;
			for (let i = sparkles.length - 1; i >= 0; i--) {
				const p = sparkles[i];
				p.life += dt;
				if (p.life >= p.maxLife) sparkles.splice(i, 1);
			}
		}

		/**
		 * @param {CanvasRenderingContext2D} c
		 * @param {number} x @param {number} y @param {number} size @param {number} alpha
		 */
		function drawSparkle(c, x, y, size, alpha) {
			c.save();
			c.globalAlpha = alpha;
			c.fillStyle = 'rgb(255, 230, 100)';
			c.beginPath();
			c.moveTo(x, y - size);
			c.lineTo(x + size * 0.3, y - size * 0.3);
			c.lineTo(x + size, y);
			c.lineTo(x + size * 0.3, y + size * 0.3);
			c.lineTo(x, y + size);
			c.lineTo(x - size * 0.3, y + size * 0.3);
			c.lineTo(x - size, y);
			c.lineTo(x - size * 0.3, y - size * 0.3);
			c.closePath();
			c.fill();
			c.restore();
		}

		/** @param {CanvasRenderingContext2D} c */
		function drawSparkles(c) {
			for (const p of sparkles) {
				const t = p.life / p.maxLife;
				const alpha = t < 0.3 ? t / 0.3 : (1 - t) / 0.7;
				drawSparkle(c, p.x, p.y, p.size, alpha);
			}
		}

		const confettiColors = [
			'rgb(255, 80, 80)',
			'rgb(80, 140, 255)',
			'rgb(255, 220, 50)',
			'rgb(80, 200, 80)'
		];

		/** @param {number} dt */
		function updateConfetti(dt) {
			confettiSpawnTimer += dt;
			const nearParty = currentMood >= 2.5;
			if (nearParty && confettiSpawnTimer >= 1 / 8) {
				confettiSpawnTimer -= 1 / 8;
				const angle = Math.random() * Math.PI * 2;
				const speed = 80 + Math.random() * 120;
				confetti.push({
					x: (Math.random() - 0.5) * 60,
					y: -50 + Math.random() * 80,
					vx: Math.cos(angle) * speed,
					vy: Math.sin(angle) * speed - 60,
					life: 0,
					maxLife: 1.5,
					colorIdx: Math.floor(Math.random() * 4),
					size: 3 + Math.random() * 3,
					shape: Math.floor(Math.random() * 3)
				});
			}
			if (!nearParty) confettiSpawnTimer = 0;
			for (let i = confetti.length - 1; i >= 0; i--) {
				const p = confetti[i];
				p.life += dt;
				p.vy += 150 * dt;
				p.x += p.vx * dt;
				p.y += p.vy * dt;
				if (p.life >= p.maxLife) confetti.splice(i, 1);
			}
		}

		/** @param {CanvasRenderingContext2D} c */
		function drawConfetti(c) {
			for (const p of confetti) {
				const alpha = Math.max(0, 1 - p.life / p.maxLife);
				c.save();
				c.globalAlpha = alpha;
				c.fillStyle = confettiColors[p.colorIdx];
				c.beginPath();
				if (p.shape === 0) {
					c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
				} else if (p.shape === 1) {
					c.rect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
				} else {
					c.moveTo(p.x, p.y - p.size);
					c.lineTo(p.x + p.size, p.y + p.size);
					c.lineTo(p.x - p.size, p.y + p.size);
					c.closePath();
				}
				c.fill();
				c.restore();
			}
		}

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
			drawZParticles(c);
			drawSparkles(c);
			drawConfetti(c);
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

			updateZParticles(dt);
			updateSparkles(dt);
			updateConfetti(dt);
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
