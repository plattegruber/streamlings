/**
 * Test utilities for the Streamlings web app.
 *
 * Provides helpers that return valid telemetry objects with sensible defaults.
 * Every field can be selectively overridden via partial objects.
 */

/**
 * Build a mock `StreamlingTelemetry` snapshot.
 *
 * @param {Partial<import('@streamlings/shared').StreamlingTelemetry>} [overrides]
 * @returns {import('@streamlings/shared').StreamlingTelemetry}
 */
export function mockTelemetry(overrides = {}) {
	const now = Date.now();

	/** @type {import('@streamlings/shared').EnergyState} */
	const defaultEnergy = {
		rawActivity: 5,
		baseline: 3,
		stdDev: 1,
		zScore: 0.8,
		energy: 0.6,
		activityHistory: [4, 5, 3],
		lastUpdate: now
	};

	/** @type {import('@streamlings/shared').MoodStateData} */
	const defaultMood = {
		currentState: /** @type {import('@streamlings/shared').MoodState} */ ('idle'),
		stateEnteredAt: now - 60_000,
		timeInState: 60_000,
		transitionConditionMetAt: null,
		drive: {
			sleepPressure: 0.2,
			restedness: 0.9,
			exhaustion: 0,
			curiosity: 0.1
		}
	};

	/** @type {import('@streamlings/shared').ActivityMetrics} */
	const defaultActivity = {
		messagesPerMin: 10,
		uniqueChattersPerMin: 5,
		highValueEventsPerMin: 0,
		timestamp: now
	};

	return {
		energy: { ...defaultEnergy, .../** @type {any} */ (overrides.energy) },
		mood: {
			...defaultMood,
			.../** @type {any} */ (overrides.mood),
			drive: {
				...defaultMood.drive,
				.../** @type {any} */ (overrides.mood?.drive)
			}
		},
		recentActivity: {
			...defaultActivity,
			.../** @type {any} */ (overrides.recentActivity)
		},
		timestamp: overrides.timestamp ?? now
	};
}
