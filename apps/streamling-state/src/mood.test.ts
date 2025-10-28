import { describe, it, expect } from 'vitest';
import {
	MoodState,
	type EnergyState,
} from '@streamlings/shared/types';
import {
	createInitialMoodState,
	updateMoodState,
	DEFAULT_MOOD_TRANSITION_CONFIG,
	DEFAULT_INTERNAL_DRIVE_CONFIG,
} from './mood';

describe('Mood System', () => {
	describe('createInitialMoodState', () => {
		it('should create initial mood state as Idle', () => {
			const state = createInitialMoodState();

			expect(state.currentState).toBe(MoodState.Idle);
			expect(state.timeInState).toBe(0);
			expect(state.transitionConditionMetAt).toBeNull();
			expect(state.drive.sleepPressure).toBe(0);
			expect(state.drive.restedness).toBe(1.0);
			expect(state.drive.exhaustion).toBe(0);
			expect(state.drive.curiosity).toBe(0);
		});
	});

	describe('Internal Drive System', () => {
		it('should build sleep pressure while awake', () => {
			const startTime = 1000000;
			let moodState = createInitialMoodState();
			moodState.stateEnteredAt = startTime;

			const energyState: EnergyState = {
				rawActivity: 0,
				baseline: 0,
				stdDev: 1,
				zScore: 0,
				energy: 0,
				activityHistory: [],
				lastUpdate: startTime,
			};

			const initialSleepPressure = moodState.drive.sleepPressure;

			// Update multiple times while in Idle (awake)
			for (let i = 0; i < 10; i++) {
				moodState = updateMoodState(
					moodState,
					energyState,
					DEFAULT_MOOD_TRANSITION_CONFIG,
					DEFAULT_INTERNAL_DRIVE_CONFIG,
					startTime + i * 1000,
				);
			}

			expect(moodState.drive.sleepPressure).toBeGreaterThan(initialSleepPressure);
		});

		it('should build restedness while sleeping', () => {
			const startTime = 1000000;
			let moodState = createInitialMoodState();
			moodState.currentState = MoodState.Sleeping;
			moodState.stateEnteredAt = startTime;
			moodState.drive.restedness = 0.5;

			const energyState: EnergyState = {
				rawActivity: 0,
				baseline: 0,
				stdDev: 1,
				zScore: 0,
				energy: -2.0, // Very low energy
				activityHistory: [],
				lastUpdate: startTime,
			};

			const initialRestedness = moodState.drive.restedness;

			// Update while sleeping
			for (let i = 0; i < 10; i++) {
				moodState = updateMoodState(
					moodState,
					energyState,
					DEFAULT_MOOD_TRANSITION_CONFIG,
					DEFAULT_INTERNAL_DRIVE_CONFIG,
					startTime + i * 1000,
				);
			}

			expect(moodState.drive.restedness).toBeGreaterThan(initialRestedness);
		});

		it('should build exhaustion while partying', () => {
			const startTime = 1000000;
			let moodState = createInitialMoodState();
			moodState.currentState = MoodState.Partying;
			moodState.stateEnteredAt = startTime;

			const energyState: EnergyState = {
				rawActivity: 100,
				baseline: 10,
				stdDev: 5,
				zScore: 18,
				energy: 2.0, // Very high energy
				activityHistory: [],
				lastUpdate: startTime,
			};

			const initialExhaustion = moodState.drive.exhaustion;

			// Update while partying
			for (let i = 0; i < 10; i++) {
				moodState = updateMoodState(
					moodState,
					energyState,
					DEFAULT_MOOD_TRANSITION_CONFIG,
					DEFAULT_INTERNAL_DRIVE_CONFIG,
					startTime + i * 1000,
				);
			}

			expect(moodState.drive.exhaustion).toBeGreaterThan(initialExhaustion);
		});

		it('should build curiosity while idle', () => {
			const startTime = 1000000;
			let moodState = createInitialMoodState();
			moodState.stateEnteredAt = startTime;

			const energyState: EnergyState = {
				rawActivity: 5,
				baseline: 5,
				stdDev: 1,
				zScore: 0,
				energy: 0,
				activityHistory: [],
				lastUpdate: startTime,
			};

			const initialCuriosity = moodState.drive.curiosity;

			// Update while idle
			for (let i = 0; i < 10; i++) {
				moodState = updateMoodState(
					moodState,
					energyState,
					DEFAULT_MOOD_TRANSITION_CONFIG,
					DEFAULT_INTERNAL_DRIVE_CONFIG,
					startTime + i * 1000,
				);
			}

			expect(moodState.drive.curiosity).toBeGreaterThan(initialCuriosity);
		});
	});

	describe('State Transitions', () => {
		it('should transition Idle → Engaged when energy is high', () => {
			const startTime = 1000000;
			let moodState = createInitialMoodState();
			moodState.stateEnteredAt = startTime;

			const energyState: EnergyState = {
				rawActivity: 50,
				baseline: 10,
				stdDev: 5,
				zScore: 8,
				energy: 0.6, // Above idleToEngagedEnergyThreshold (0.5)
				activityHistory: [],
				lastUpdate: startTime,
			};

			const holdTime = DEFAULT_MOOD_TRANSITION_CONFIG.idleToEngagedHoldTime;

			// First update: condition just met, tracking begins
			moodState = updateMoodState(
				moodState,
				energyState,
				DEFAULT_MOOD_TRANSITION_CONFIG,
				DEFAULT_INTERNAL_DRIVE_CONFIG,
				startTime,
			);
			expect(moodState.currentState).toBe(MoodState.Idle);
			expect(moodState.transitionConditionMetAt).toBe(startTime);

			// Before hold time has fully elapsed
			moodState = updateMoodState(
				moodState,
				energyState,
				DEFAULT_MOOD_TRANSITION_CONFIG,
				DEFAULT_INTERNAL_DRIVE_CONFIG,
				startTime + holdTime - 1000,
			);
			expect(moodState.currentState).toBe(MoodState.Idle);

			// After hold time has elapsed
			moodState = updateMoodState(
				moodState,
				energyState,
				DEFAULT_MOOD_TRANSITION_CONFIG,
				DEFAULT_INTERNAL_DRIVE_CONFIG,
				startTime + holdTime + 1000,
			);
			expect(moodState.currentState).toBe(MoodState.Engaged);
		});

		it('should transition Engaged → Partying when energy is very high', () => {
			const startTime = 1000000;
			let moodState = createInitialMoodState();
			moodState.currentState = MoodState.Engaged;
			moodState.stateEnteredAt = startTime;

			const energyState: EnergyState = {
				rawActivity: 100,
				baseline: 10,
				stdDev: 5,
				zScore: 18,
				energy: 1.6, // Above engagedToPartyingEnergyThreshold (1.5)
				activityHistory: [],
				lastUpdate: startTime,
			};

			const holdTime = DEFAULT_MOOD_TRANSITION_CONFIG.engagedToPartyingHoldTime;

			// First update: condition just met
			moodState = updateMoodState(
				moodState,
				energyState,
				DEFAULT_MOOD_TRANSITION_CONFIG,
				DEFAULT_INTERNAL_DRIVE_CONFIG,
				startTime,
			);
			expect(moodState.currentState).toBe(MoodState.Engaged);

			// Before hold time
			moodState = updateMoodState(
				moodState,
				energyState,
				DEFAULT_MOOD_TRANSITION_CONFIG,
				DEFAULT_INTERNAL_DRIVE_CONFIG,
				startTime + holdTime - 1000,
			);
			expect(moodState.currentState).toBe(MoodState.Engaged);

			// After hold time
			moodState = updateMoodState(
				moodState,
				energyState,
				DEFAULT_MOOD_TRANSITION_CONFIG,
				DEFAULT_INTERNAL_DRIVE_CONFIG,
				startTime + holdTime + 1000,
			);
			expect(moodState.currentState).toBe(MoodState.Partying);
		});

		it('should transition Engaged → Idle when energy drops', () => {
			const startTime = 1000000;
			let moodState = createInitialMoodState();
			moodState.currentState = MoodState.Engaged;
			moodState.stateEnteredAt = startTime;

			const energyState: EnergyState = {
				rawActivity: 2,
				baseline: 10,
				stdDev: 5,
				zScore: -1.6,
				energy: 0.2, // Below engagedToIdleEnergyThreshold (0.3)
				activityHistory: [],
				lastUpdate: startTime,
			};

			const holdTime = DEFAULT_MOOD_TRANSITION_CONFIG.engagedToIdleHoldTime;

			// First update: condition just met
			moodState = updateMoodState(
				moodState,
				energyState,
				DEFAULT_MOOD_TRANSITION_CONFIG,
				DEFAULT_INTERNAL_DRIVE_CONFIG,
				startTime,
			);
			expect(moodState.currentState).toBe(MoodState.Engaged);

			// Before hold time
			moodState = updateMoodState(
				moodState,
				energyState,
				DEFAULT_MOOD_TRANSITION_CONFIG,
				DEFAULT_INTERNAL_DRIVE_CONFIG,
				startTime + holdTime - 1000,
			);
			expect(moodState.currentState).toBe(MoodState.Engaged);

			// After hold time
			moodState = updateMoodState(
				moodState,
				energyState,
				DEFAULT_MOOD_TRANSITION_CONFIG,
				DEFAULT_INTERNAL_DRIVE_CONFIG,
				startTime + holdTime + 1000,
			);
			expect(moodState.currentState).toBe(MoodState.Idle);
		});

		it('should transition Idle → Sleeping when energy is very low', () => {
			const startTime = 1000000;
			let moodState = createInitialMoodState();
			moodState.stateEnteredAt = startTime;

			const energyState: EnergyState = {
				rawActivity: 0,
				baseline: 10,
				stdDev: 5,
				zScore: -2,
				energy: -0.9, // Below idleToSleepingEnergyThreshold (-0.8)
				activityHistory: [],
				lastUpdate: startTime,
			};

			const holdTime = DEFAULT_MOOD_TRANSITION_CONFIG.idleToSleepingHoldTime;

			// First update: condition just met
			moodState = updateMoodState(
				moodState,
				energyState,
				DEFAULT_MOOD_TRANSITION_CONFIG,
				DEFAULT_INTERNAL_DRIVE_CONFIG,
				startTime,
			);
			expect(moodState.currentState).toBe(MoodState.Idle);

			// Before hold time
			moodState = updateMoodState(
				moodState,
				energyState,
				DEFAULT_MOOD_TRANSITION_CONFIG,
				DEFAULT_INTERNAL_DRIVE_CONFIG,
				startTime + holdTime - 1000,
			);
			expect(moodState.currentState).toBe(MoodState.Idle);

			// After hold time
			moodState = updateMoodState(
				moodState,
				energyState,
				DEFAULT_MOOD_TRANSITION_CONFIG,
				DEFAULT_INTERNAL_DRIVE_CONFIG,
				startTime + holdTime + 1000,
			);
			expect(moodState.currentState).toBe(MoodState.Sleeping);
		});

		it('should transition Sleeping → Idle when energy rises', () => {
			const startTime = 1000000;
			let moodState = createInitialMoodState();
			moodState.currentState = MoodState.Sleeping;
			// Already slept for minimum duration
			moodState.stateEnteredAt = startTime - DEFAULT_MOOD_TRANSITION_CONFIG.sleepToIdleMinDuration - 1000;

			const energyState: EnergyState = {
				rawActivity: 10,
				baseline: 5,
				stdDev: 2,
				zScore: 2.5,
				energy: -0.4, // Above sleepToIdleEnergyThreshold (-0.5)
				activityHistory: [],
				lastUpdate: startTime,
			};

			const holdTime = DEFAULT_MOOD_TRANSITION_CONFIG.sleepToIdleHoldTime;

			// First update: condition just met
			moodState = updateMoodState(
				moodState,
				energyState,
				DEFAULT_MOOD_TRANSITION_CONFIG,
				DEFAULT_INTERNAL_DRIVE_CONFIG,
				startTime,
			);
			expect(moodState.currentState).toBe(MoodState.Sleeping);

			// Before hold time
			moodState = updateMoodState(
				moodState,
				energyState,
				DEFAULT_MOOD_TRANSITION_CONFIG,
				DEFAULT_INTERNAL_DRIVE_CONFIG,
				startTime + holdTime - 1000,
			);
			expect(moodState.currentState).toBe(MoodState.Sleeping);

			// After hold time and min duration
			moodState = updateMoodState(
				moodState,
				energyState,
				DEFAULT_MOOD_TRANSITION_CONFIG,
				DEFAULT_INTERNAL_DRIVE_CONFIG,
				startTime + holdTime + 1000,
			);
			expect(moodState.currentState).toBe(MoodState.Idle);
		});

		it('should transition Partying → Engaged after max duration', () => {
			const startTime = 1000000;
			let moodState = createInitialMoodState();
			moodState.currentState = MoodState.Partying;
			moodState.stateEnteredAt = startTime;

			const energyState: EnergyState = {
				rawActivity: 100,
				baseline: 10,
				stdDev: 5,
				zScore: 18,
				energy: 2.0, // Still very high
				activityHistory: [],
				lastUpdate: startTime,
			};

			const maxDuration = DEFAULT_MOOD_TRANSITION_CONFIG.partyingToEngagedMaxDuration;
			const holdTime = DEFAULT_MOOD_TRANSITION_CONFIG.partyingToEngagedHoldTime;

			// Before max duration
			moodState = updateMoodState(
				moodState,
				energyState,
				DEFAULT_MOOD_TRANSITION_CONFIG,
				DEFAULT_INTERNAL_DRIVE_CONFIG,
				startTime + maxDuration - 1000,
			);
			expect(moodState.currentState).toBe(MoodState.Partying);

			// At max duration + a bit more, should transition immediately
			// Max duration is a force condition that bypasses hold time
			moodState = updateMoodState(
				moodState,
				energyState,
				DEFAULT_MOOD_TRANSITION_CONFIG,
				DEFAULT_INTERNAL_DRIVE_CONFIG,
				startTime + maxDuration + 1000,
			);
			expect(moodState.currentState).toBe(MoodState.Engaged);
		});

		it('should reset transitionConditionMetAt when condition no longer met', () => {
			const startTime = 1000000;
			let moodState = createInitialMoodState();
			moodState.stateEnteredAt = startTime;

			// High energy to start transition tracking
			const highEnergyState: EnergyState = {
				rawActivity: 50,
				baseline: 10,
				stdDev: 5,
				zScore: 8,
				energy: 0.6, // Above threshold
				activityHistory: [],
				lastUpdate: startTime,
			};

			moodState = updateMoodState(
				moodState,
				highEnergyState,
				DEFAULT_MOOD_TRANSITION_CONFIG,
				DEFAULT_INTERNAL_DRIVE_CONFIG,
				startTime,
			);

			expect(moodState.transitionConditionMetAt).not.toBeNull();

			// Energy drops, should reset tracking
			const lowEnergyState: EnergyState = {
				...highEnergyState,
				energy: 0.4, // Below threshold
			};

			moodState = updateMoodState(
				moodState,
				lowEnergyState,
				DEFAULT_MOOD_TRANSITION_CONFIG,
				DEFAULT_INTERNAL_DRIVE_CONFIG,
				startTime + 5000,
			);

			expect(moodState.transitionConditionMetAt).toBeNull();
		});
	});

	describe('Drive-Forced Transitions', () => {
		it('should force Idle → Sleeping when sleep pressure is high', () => {
			const startTime = 1000000;
			let moodState = createInitialMoodState();
			moodState.stateEnteredAt = startTime;
			moodState.drive.sleepPressure = DEFAULT_INTERNAL_DRIVE_CONFIG.sleepPressureThreshold + 0.1;

			const energyState: EnergyState = {
				rawActivity: 10,
				baseline: 10,
				stdDev: 1,
				zScore: 0,
				energy: 0, // Neutral energy, but high sleep pressure should force sleep
				activityHistory: [],
				lastUpdate: startTime,
			};

			const holdTime = DEFAULT_MOOD_TRANSITION_CONFIG.idleToSleepingHoldTime;

			// First update with high sleep pressure
			moodState = updateMoodState(
				moodState,
				energyState,
				DEFAULT_MOOD_TRANSITION_CONFIG,
				DEFAULT_INTERNAL_DRIVE_CONFIG,
				startTime,
			);

			// Should transition immediately/quickly due to high sleep pressure
			moodState = updateMoodState(
				moodState,
				energyState,
				DEFAULT_MOOD_TRANSITION_CONFIG,
				DEFAULT_INTERNAL_DRIVE_CONFIG,
				startTime + holdTime + 1000,
			);

			expect(moodState.currentState).toBe(MoodState.Sleeping);
		});

		it('should force Partying → Engaged when exhaustion is high', () => {
			const startTime = 1000000;
			let moodState = createInitialMoodState();
			moodState.currentState = MoodState.Partying;
			moodState.stateEnteredAt = startTime;
			moodState.drive.exhaustion = DEFAULT_INTERNAL_DRIVE_CONFIG.exhaustionThreshold + 0.1;

			const energyState: EnergyState = {
				rawActivity: 100,
				baseline: 10,
				stdDev: 5,
				zScore: 18,
				energy: 2.0, // Still very high, but exhaustion should force cooldown
				activityHistory: [],
				lastUpdate: startTime,
			};

			const holdTime = DEFAULT_MOOD_TRANSITION_CONFIG.partyingToEngagedHoldTime;

			// First update with high exhaustion
			moodState = updateMoodState(
				moodState,
				energyState,
				DEFAULT_MOOD_TRANSITION_CONFIG,
				DEFAULT_INTERNAL_DRIVE_CONFIG,
				startTime,
			);

			// Should transition immediately/quickly due to high exhaustion
			moodState = updateMoodState(
				moodState,
				energyState,
				DEFAULT_MOOD_TRANSITION_CONFIG,
				DEFAULT_INTERNAL_DRIVE_CONFIG,
				startTime + holdTime + 1000,
			);

			expect(moodState.currentState).toBe(MoodState.Engaged);
		});
	});
});
