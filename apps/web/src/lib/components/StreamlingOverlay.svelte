<script>
	import { onMount } from 'svelte';

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

		// --- Animation State ---
		let time = 0;
		let currentMood = moodTarget;
		let idleVariant = 0;
		let idleTimer = 5;

		// --- Particle Arrays ---
		/** @type {{ x: number, y: number, life: number, maxLife: number, size: number }[]} */
		let zParticles = [];
		/** @type {{ x: number, y: number, vy: number, life: number, maxLife: number }[]} */
		let waterDrops = [];
		/** @type {{ x: number, y: number, life: number, maxLife: number, size: number }[]} */
		let sparkles = [];
		/** @type {{ x: number, y: number, vx: number, vy: number, life: number, maxLife: number, colorIdx: number, size: number, shape: number }[]} */
		let confetti = [];

		// --- Spawn Timers ---
		let zSpawnTimer = 0;
		let waterSpawnTimer = 0;
		let sparkleSpawnTimer = 0;
		let confettiSpawnTimer = 0;

		// ================================================================
		// Helpers
		// ================================================================

		/** @param {number} a @param {number} b @param {number} t */
		function lerp(a, b, t) {
			return a + (b - a) * t;
		}

		/**
		 * @param {CanvasRenderingContext2D} c
		 * @param {number} cx @param {number} cy @param {number} r
		 */
		function circle(c, cx, cy, r) {
			const k = 0.5522847498;
			c.moveTo(cx + r, cy);
			c.bezierCurveTo(cx + r, cy + r * k, cx + r * k, cy + r, cx, cy + r);
			c.bezierCurveTo(cx - r * k, cy + r, cx - r, cy + r * k, cx - r, cy);
			c.bezierCurveTo(cx - r, cy - r * k, cx - r * k, cy - r, cx, cy - r);
			c.bezierCurveTo(cx + r * k, cy - r, cx + r, cy - r * k, cx + r, cy);
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
						vineWave = Math.sin(t * 0.5) * 3;
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
					x: 30 + Math.random() * 10,
					y: -30,
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
		function updateWaterDrops(dt) {
			const isWatering = Math.round(currentMood) === 1 && idleVariant === 2;
			waterSpawnTimer += dt;
			if (isWatering && waterSpawnTimer >= 0.15) {
				waterSpawnTimer -= 0.15;
				waterDrops.push({
					x: -118 + Math.random() * 6,
					y: 42 + Math.random() * 4,
					vy: 10 + Math.random() * 20,
					life: 0,
					maxLife: 0.6
				});
			}
			if (!isWatering) waterSpawnTimer = 0;
			for (let i = waterDrops.length - 1; i >= 0; i--) {
				const p = waterDrops[i];
				p.life += dt;
				p.vy += 120 * dt;
				p.y += p.vy * dt;
				if (p.life >= p.maxLife || p.y > 20) waterDrops.splice(i, 1);
			}
		}

		/** @param {CanvasRenderingContext2D} c */
		function drawWaterDrops(c) {
			for (const p of waterDrops) {
				const alpha = Math.max(0, 0.7 * (1 - p.life / p.maxLife));
				c.beginPath();
				circle(c, p.x, p.y, 2);
				c.fillStyle = `rgba(100, 180, 255, ${alpha})`;
				c.fill();
			}
		}

		/** @param {number} dt */
		function updateSparkles(dt) {
			sparkleSpawnTimer += dt;
			const nearEngaged = currentMood >= 1.5 && currentMood < 2.8;
			if (nearEngaged && sparkleSpawnTimer >= 0.5) {
				sparkleSpawnTimer -= 0.5;
				sparkles.push({
					x: (Math.random() - 0.5) * 160,
					y: -60 + Math.random() * 120,
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
					x: (Math.random() - 0.5) * 40,
					y: -20 + Math.random() * 30,
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
					circle(c, p.x, p.y, p.size);
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
		// Drawing Functions
		// ================================================================

		/**
		 * @param {CanvasRenderingContext2D} c
		 * @param {number} x @param {number} y @param {number} angle
		 */
		function drawLeaf(c, x, y, angle) {
			c.save();
			c.translate(x, y);
			c.rotate(angle);
			c.beginPath();
			c.moveTo(0, -6);
			c.quadraticCurveTo(8, -3, 0, 6);
			c.quadraticCurveTo(-8, -3, 0, -6);
			c.closePath();
			c.fillStyle = 'rgb(120, 160, 80)';
			c.fill();
			c.restore();
		}

		/**
		 * @param {CanvasRenderingContext2D} c
		 * @param {number} x @param {number} y @param {number} tiltAngle
		 */
		function drawWateringCan(c, x, y, tiltAngle) {
			c.save();
			c.translate(x, y);
			c.rotate(tiltAngle);
			c.beginPath();
			c.rect(-8, -6, 16, 12);
			c.fillStyle = 'rgb(180, 130, 60)';
			c.fill();
			c.beginPath();
			c.arc(0, -6, 6, Math.PI, 0, false);
			c.strokeStyle = 'rgb(160, 110, 40)';
			c.lineWidth = 2;
			c.lineCap = 'round';
			c.stroke();
			c.beginPath();
			c.moveTo(8, -2);
			c.lineTo(14, -8);
			c.strokeStyle = 'rgb(180, 130, 60)';
			c.lineWidth = 2;
			c.lineCap = 'round';
			c.stroke();
			c.restore();
		}

		/**
		 * @param {CanvasRenderingContext2D} c
		 * @param {number} vineWaveOffset
		 */
		function drawVines(c, vineWaveOffset) {
			c.beginPath();
			c.moveTo(-65, 20);
			c.bezierCurveTo(-90, vineWaveOffset, -110, -15, -125, -5 + vineWaveOffset);
			c.strokeStyle = 'rgb(100, 140, 70)';
			c.lineWidth = 5;
			c.lineCap = 'round';
			c.stroke();
			drawLeaf(c, -82, 8 + vineWaveOffset * 0.3, -0.5);
			drawLeaf(c, -105, -8 + vineWaveOffset * 0.6, -0.8);
			drawWateringCan(c, -125, -5 + vineWaveOffset, -0.3);

			c.beginPath();
			c.moveTo(65, 20);
			c.bezierCurveTo(90, 5 - vineWaveOffset * 0.3, 115, -10, 135, -15 - vineWaveOffset * 0.5);
			c.strokeStyle = 'rgb(100, 140, 70)';
			c.lineWidth = 5;
			c.lineCap = 'round';
			c.stroke();
			drawLeaf(c, 80, 12 - vineWaveOffset * 0.1, 0.4);
			drawLeaf(c, 102, -2 - vineWaveOffset * 0.2, 0.6);
			drawLeaf(c, 122, -12 - vineWaveOffset * 0.4, 0.8);
		}

		/**
		 * @param {CanvasRenderingContext2D} c
		 * @param {number} droopAmount
		 */
		function drawSucculent(c, droopAmount) {
			const centerY = -45;

			c.beginPath();
			c.ellipse(0, centerY + 30, 58, 12, 0, 0, Math.PI * 2);
			c.fillStyle = 'rgb(140, 100, 60)';
			c.fill();

			const rings = [
				{
					count: 11,
					radius: 48,
					pw: 22,
					ph: 24,
					color: 'rgb(200, 170, 160)',
					offset: 0
				},
				{
					count: 8,
					radius: 30,
					pw: 18,
					ph: 20,
					color: 'rgb(180, 175, 150)',
					offset: Math.PI / 8
				},
				{
					count: 5,
					radius: 14,
					pw: 13,
					ph: 15,
					color: 'rgb(160, 180, 140)',
					offset: Math.PI / 5
				}
			];

			for (const ring of rings) {
				for (let i = 0; i < ring.count; i++) {
					const angle = (i / ring.count) * Math.PI * 2 + ring.offset;
					const px = Math.cos(angle) * ring.radius;
					const py = Math.sin(angle) * ring.radius * (1 - droopAmount * 0.3);

					c.save();
					c.translate(px, centerY + py);
					c.rotate(angle + Math.PI / 2);
					c.scale(1, 1 - droopAmount * 0.15);

					const hw = ring.pw / 2;
					const hh = ring.ph / 2;
					c.beginPath();
					c.moveTo(0, -hh);
					c.bezierCurveTo(-hw * 0.8, -hh * 0.6, -hw, hh * 0.2, -hw * 0.5, hh * 0.7);
					c.quadraticCurveTo(0, hh + 2, hw * 0.5, hh * 0.7);
					c.bezierCurveTo(hw, hh * 0.2, hw * 0.8, -hh * 0.6, 0, -hh);
					c.closePath();
					c.fillStyle = ring.color;
					c.fill();

					c.restore();
				}
			}

			c.beginPath();
			circle(c, 0, centerY, 6);
			c.fillStyle = 'rgb(150, 175, 135)';
			c.fill();
		}

		/** @param {CanvasRenderingContext2D} c */
		function drawPotBody(c) {
			const topW = 70;
			const botW = 55;
			const potH = 120;
			const rimH = 12;
			const potTop = -20;
			const potBot = potTop + potH;
			const cornerR = 16;

			c.beginPath();
			c.moveTo(-topW + cornerR, potTop + rimH);
			c.lineTo(topW - cornerR, potTop + rimH);
			c.quadraticCurveTo(topW + 3, potTop + rimH + 6, botW + 3, potBot - cornerR);
			c.quadraticCurveTo(botW + 3, potBot + 2, botW - cornerR, potBot + 2);
			c.lineTo(-botW + cornerR, potBot + 2);
			c.quadraticCurveTo(-botW - 1, potBot + 2, -topW - 1, potTop + rimH + 6);
			c.closePath();
			c.fillStyle = 'rgb(200, 170, 100)';
			c.fill();

			c.beginPath();
			c.moveTo(-topW + cornerR, potTop + rimH);
			c.lineTo(topW - cornerR, potTop + rimH);
			c.quadraticCurveTo(topW, potTop + rimH + 8, botW, potBot - cornerR);
			c.quadraticCurveTo(botW, potBot, botW - cornerR, potBot);
			c.lineTo(-botW + cornerR, potBot);
			c.quadraticCurveTo(-botW, potBot, -topW, potTop + rimH + 8);
			c.closePath();
			c.fillStyle = 'rgb(234, 206, 138)';
			c.fill();

			const rimW = topW + 8;
			const rimTop = potTop;
			const rimBot = potTop + rimH;
			const rimR = 6;

			c.beginPath();
			c.moveTo(-rimW + rimR, rimTop + 3);
			c.lineTo(rimW - rimR, rimTop + 3);
			c.quadraticCurveTo(rimW + 2, rimTop + 3, rimW + 2, rimBot + 1);
			c.lineTo(-rimW - 2, rimBot + 1);
			c.quadraticCurveTo(-rimW - 2, rimTop + 3, -rimW + rimR, rimTop + 3);
			c.closePath();
			c.fillStyle = 'rgb(200, 170, 100)';
			c.fill();

			c.beginPath();
			c.moveTo(-rimW + rimR, rimTop);
			c.lineTo(rimW - rimR, rimTop);
			c.quadraticCurveTo(rimW, rimTop, rimW, rimTop + rimH * 0.5);
			c.quadraticCurveTo(rimW, rimBot, rimW - rimR, rimBot);
			c.lineTo(-rimW + rimR, rimBot);
			c.quadraticCurveTo(-rimW, rimBot, -rimW, rimTop + rimH * 0.5);
			c.quadraticCurveTo(-rimW, rimTop, -rimW + rimR, rimTop);
			c.closePath();
			c.fillStyle = 'rgb(224, 196, 128)';
			c.fill();

			const ropeY = potTop + rimH + 52;
			const frac = 52 / (potH - rimH);
			const ropeHalfW = topW - (topW - botW) * frac - 3;

			c.strokeStyle = 'rgb(160, 120, 60)';
			c.lineWidth = 3;
			c.lineCap = 'round';

			c.beginPath();
			c.moveTo(-ropeHalfW, ropeY);
			c.quadraticCurveTo(0, ropeY + 3, ropeHalfW, ropeY);
			c.stroke();

			c.beginPath();
			c.moveTo(-ropeHalfW, ropeY + 6);
			c.quadraticCurveTo(0, ropeY + 9, ropeHalfW, ropeY + 6);
			c.stroke();

			const bowCX = 0;
			const bowCY = ropeY + 3;

			c.fillStyle = 'rgb(160, 120, 60)';

			c.beginPath();
			c.moveTo(bowCX - 2, bowCY);
			c.quadraticCurveTo(bowCX - 26, bowCY - 18, bowCX - 19, bowCY + 2);
			c.quadraticCurveTo(bowCX - 14, bowCY + 14, bowCX - 2, bowCY + 5);
			c.closePath();
			c.fill();

			c.beginPath();
			c.moveTo(bowCX + 2, bowCY);
			c.quadraticCurveTo(bowCX + 26, bowCY - 18, bowCX + 19, bowCY + 2);
			c.quadraticCurveTo(bowCX + 14, bowCY + 14, bowCX + 2, bowCY + 5);
			c.closePath();
			c.fill();

			c.beginPath();
			circle(c, bowCX, bowCY + 2, 5);
			c.closePath();
			c.fill();

			c.beginPath();
			c.moveTo(bowCX - 3, bowCY + 6);
			c.quadraticCurveTo(bowCX - 16, bowCY + 22, bowCX - 10, bowCY + 32);
			c.lineWidth = 2.5;
			c.strokeStyle = 'rgb(160, 120, 60)';
			c.stroke();

			c.beginPath();
			c.moveTo(bowCX + 3, bowCY + 6);
			c.quadraticCurveTo(bowCX + 16, bowCY + 22, bowCX + 10, bowCY + 32);
			c.stroke();
		}

		/**
		 * @param {CanvasRenderingContext2D} c
		 * @param {number} eyeState
		 * @param {number} blushAlpha
		 */
		function drawFace(c, eyeState, blushAlpha) {
			const eyeY = 18;
			const eyeX = 22;
			const eyeR = 14;
			const irisR = 8;
			const irisRWide = 10;
			const highlightR = 3;
			const blushR = 8;
			const blushY = 28;
			const blushXOff = 32;
			const mouthY = 32;

			const eyes = [
				{ cx: -eyeX, cy: eyeY },
				{ cx: eyeX, cy: eyeY }
			];

			for (const eye of eyes) {
				if (eyeState === 1) {
					c.beginPath();
					circle(c, eye.cx, eye.cy, eyeR);
					c.fillStyle = 'rgb(255, 255, 255)';
					c.fill();
					c.beginPath();
					c.arc(eye.cx, eye.cy - 2, irisR, 0.1 * Math.PI, 0.9 * Math.PI, false);
					c.strokeStyle = 'rgb(80, 40, 20)';
					c.lineWidth = 2.5;
					c.lineCap = 'round';
					c.stroke();
				} else {
					let currentIrisR = irisR;
					let irisOffsetX = 0;
					if (eyeState === 2) currentIrisR = irisRWide;
					if (eyeState === 3) irisOffsetX = -4;
					if (eyeState === 4) irisOffsetX = 4;

					c.beginPath();
					circle(c, eye.cx, eye.cy, eyeR);
					c.fillStyle = 'rgb(255, 255, 255)';
					c.fill();

					c.beginPath();
					circle(c, eye.cx + irisOffsetX, eye.cy, currentIrisR);
					c.fillStyle = 'rgb(80, 40, 20)';
					c.fill();

					c.beginPath();
					circle(c, eye.cx + irisOffsetX + 3, eye.cy - 3, highlightR);
					c.fillStyle = 'rgb(255, 255, 255)';
					c.fill();
				}
			}

			c.beginPath();
			circle(c, -blushXOff, blushY, blushR);
			c.fillStyle = `rgba(255, 140, 140, ${blushAlpha})`;
			c.fill();

			c.beginPath();
			circle(c, blushXOff, blushY, blushR);
			c.fillStyle = `rgba(255, 140, 140, ${blushAlpha})`;
			c.fill();

			c.beginPath();
			c.moveTo(-5, mouthY);
			c.quadraticCurveTo(0, mouthY + 5, 5, mouthY);
			c.quadraticCurveTo(0, mouthY + 8, -5, mouthY);
			c.closePath();
			c.fillStyle = 'rgb(180, 60, 80)';
			c.fill();
		}

		// ================================================================
		// Main Draw + Loop
		// ================================================================

		/** @param {CanvasRenderingContext2D} c */
		function drawPlant(c) {
			const state = getAnimationState(currentMood, time, idleVariant);

			c.save();
			c.translate(state.swayX, 30 - state.bounceY);
			c.rotate(state.rotation);
			drawVines(c, state.vineWave);
			drawSucculent(c, state.droop);
			drawPotBody(c);
			drawFace(c, state.eyeState, state.blushAlpha);
			c.restore();

			drawZParticles(c);
			drawWaterDrops(c);
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
			updateWaterDrops(dt);
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
