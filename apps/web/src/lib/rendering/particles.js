/**
 * Shared particle systems used by both 2D and 3D streamling renderers.
 */

// ================================================================
// Z Particles (sleeping)
// ================================================================

/**
 * @typedef {{ x: number, y: number, life: number, maxLife: number, size: number }} ZParticle
 */

/**
 * @param {ZParticle[]} particles
 * @param {number} dt
 * @param {number} currentMood
 * @param {{ timer: number }} state
 */
export function updateZParticles(particles, dt, currentMood, state) {
	state.timer += dt;
	const nearSleep = currentMood < 0.5;
	if (nearSleep && state.timer >= 1 / 1.5) {
		state.timer -= 1 / 1.5;
		particles.push({
			x: 20 + Math.random() * 10,
			y: -200,
			life: 0,
			maxLife: 2.5,
			size: 8 + Math.random() * 6
		});
	}
	if (!nearSleep) state.timer = 0;
	for (let i = particles.length - 1; i >= 0; i--) {
		const p = particles[i];
		p.life += dt;
		p.y -= 30 * dt;
		p.x += Math.sin(p.life * 2) * 15 * dt;
		if (p.life >= p.maxLife) particles.splice(i, 1);
	}
}

/**
 * @param {CanvasRenderingContext2D} c
 * @param {ZParticle[]} particles
 */
export function drawZParticles(c, particles) {
	for (const p of particles) {
		const alpha = 1 - p.life / p.maxLife;
		c.save();
		c.globalAlpha = alpha;
		c.font = `bold ${p.size}px sans-serif`;
		c.fillStyle = 'rgb(180, 200, 255)';
		c.fillText('z', p.x, p.y);
		c.restore();
	}
}

// ================================================================
// Sparkles (engaged)
// ================================================================

/**
 * @typedef {{ x: number, y: number, life: number, maxLife: number, size: number }} Sparkle
 */

/**
 * @param {Sparkle[]} particles
 * @param {number} dt
 * @param {number} currentMood
 * @param {{ timer: number }} state
 */
export function updateSparkles(particles, dt, currentMood, state) {
	state.timer += dt;
	const nearEngaged = currentMood >= 1.5 && currentMood < 2.8;
	if (nearEngaged && state.timer >= 0.5) {
		state.timer -= 0.5;
		particles.push({
			x: (Math.random() - 0.5) * 200,
			y: -200 + Math.random() * 300,
			life: 0,
			maxLife: 0.8,
			size: 3 + Math.random() * 4
		});
	}
	if (!nearEngaged) state.timer = 0;
	for (let i = particles.length - 1; i >= 0; i--) {
		const p = particles[i];
		p.life += dt;
		if (p.life >= p.maxLife) particles.splice(i, 1);
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

/**
 * @param {CanvasRenderingContext2D} c
 * @param {Sparkle[]} particles
 */
export function drawSparkles(c, particles) {
	for (const p of particles) {
		const t = p.life / p.maxLife;
		const alpha = t < 0.3 ? t / 0.3 : (1 - t) / 0.7;
		drawSparkle(c, p.x, p.y, p.size, alpha);
	}
}

// ================================================================
// Confetti (partying)
// ================================================================

/**
 * @typedef {{ x: number, y: number, vx: number, vy: number, life: number, maxLife: number, colorIdx: number, size: number, shape: number }} ConfettiParticle
 */

const confettiColors = [
	'rgb(255, 80, 80)',
	'rgb(80, 140, 255)',
	'rgb(255, 220, 50)',
	'rgb(80, 200, 80)'
];

/**
 * @param {ConfettiParticle[]} particles
 * @param {number} dt
 * @param {number} currentMood
 * @param {{ timer: number }} state
 */
export function updateConfetti(particles, dt, currentMood, state) {
	state.timer += dt;
	const nearParty = currentMood >= 2.5;
	if (nearParty && state.timer >= 1 / 8) {
		state.timer -= 1 / 8;
		const angle = Math.random() * Math.PI * 2;
		const speed = 80 + Math.random() * 120;
		particles.push({
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
	if (!nearParty) state.timer = 0;
	for (let i = particles.length - 1; i >= 0; i--) {
		const p = particles[i];
		p.life += dt;
		p.vy += 150 * dt;
		p.x += p.vx * dt;
		p.y += p.vy * dt;
		if (p.life >= p.maxLife) particles.splice(i, 1);
	}
}

/**
 * @param {CanvasRenderingContext2D} c
 * @param {ConfettiParticle[]} particles
 */
export function drawConfetti(c, particles) {
	for (const p of particles) {
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
