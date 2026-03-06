/**
 * Shared mood animation logic used by both 2D and 3D streamling renderers.
 */

/**
 * Map mood string to numeric target (0-3).
 * @param {string} state
 * @returns {number}
 */
export function moodToNumber(state) {
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

/** @param {number} a @param {number} b @param {number} t */
export function lerp(a, b, t) {
	return a + (b - a) * t;
}

/**
 * @param {number} state
 * @param {number} t
 * @param {number} variant
 */
export function getStateParams(state, t, variant) {
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
export function getAnimationState(m, t, variant) {
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
