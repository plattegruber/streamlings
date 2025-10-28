import { describe, it, expect } from 'vitest';
import {
	calculateEMA,
	calculateStdDev,
	calculateRawActivity,
	createInitialEnergyState,
	updateEnergyState,
	DEFAULT_ENERGY_CONFIG,
} from './energy';
import type { ActivityMetrics } from '@streamlings/shared/types';

describe('Energy System', () => {
	describe('calculateEMA', () => {
		it('should calculate exponential moving average correctly', () => {
			const previousEMA = 10;
			const currentValue = 20;
			const alpha = 0.1;

			const result = calculateEMA(currentValue, previousEMA, alpha);

			// EMA = alpha * current + (1 - alpha) * previous
			// EMA = 0.1 * 20 + 0.9 * 10 = 2 + 9 = 11
			expect(result).toBe(11);
		});

		it('should handle alpha = 0 (no weight on new value)', () => {
			const result = calculateEMA(100, 10, 0);
			expect(result).toBe(10);
		});

		it('should handle alpha = 1 (full weight on new value)', () => {
			const result = calculateEMA(100, 10, 1);
			expect(result).toBe(100);
		});
	});

	describe('calculateStdDev', () => {
		it('should calculate standard deviation correctly', () => {
			const values = [2, 4, 4, 4, 5, 5, 7, 9];
			const result = calculateStdDev(values);

			// Mean = 5, variance = 4, std dev = 2
			expect(result).toBe(2);
		});

		it('should return 0 for empty array', () => {
			expect(calculateStdDev([])).toBe(0);
		});

		it('should return 0 for single value', () => {
			expect(calculateStdDev([5])).toBe(0);
		});

		it('should return 0 for identical values', () => {
			expect(calculateStdDev([5, 5, 5, 5])).toBe(0);
		});
	});

	describe('calculateRawActivity', () => {
		it('should calculate raw activity with default weights', () => {
			const metrics: ActivityMetrics = {
				messagesPerMin: 10,
				uniqueChattersPerMin: 5,
				highValueEventsPerMin: 2,
				timestamp: Date.now(),
			};

			const result = calculateRawActivity(metrics, DEFAULT_ENERGY_CONFIG);

			// A(t) = 1.0*10 + 0.7*5 + 3.0*2 = 10 + 3.5 + 6 = 19.5
			expect(result).toBe(19.5);
		});

		it('should handle zero activity', () => {
			const metrics: ActivityMetrics = {
				messagesPerMin: 0,
				uniqueChattersPerMin: 0,
				highValueEventsPerMin: 0,
				timestamp: Date.now(),
			};

			const result = calculateRawActivity(metrics, DEFAULT_ENERGY_CONFIG);
			expect(result).toBe(0);
		});

		it('should heavily weight high-value events', () => {
			const metrics: ActivityMetrics = {
				messagesPerMin: 0,
				uniqueChattersPerMin: 0,
				highValueEventsPerMin: 1,
				timestamp: Date.now(),
			};

			const result = calculateRawActivity(metrics, DEFAULT_ENERGY_CONFIG);

			// Only high-value events: 3.0 * 1 = 3
			expect(result).toBe(3.0);
		});
	});

	describe('createInitialEnergyState', () => {
		it('should create initial energy state with zeros', () => {
			const state = createInitialEnergyState();

			expect(state.rawActivity).toBe(0);
			expect(state.baseline).toBe(0);
			expect(state.stdDev).toBe(1.0);
			expect(state.zScore).toBe(0);
			expect(state.energy).toBe(0);
			expect(state.activityHistory).toEqual([]);
			expect(state.lastUpdate).toBeGreaterThan(0);
		});
	});

	describe('updateEnergyState', () => {
		it('should initialize baseline on first update', () => {
			const state = createInitialEnergyState();
			const metrics: ActivityMetrics = {
				messagesPerMin: 10,
				uniqueChattersPerMin: 5,
				highValueEventsPerMin: 0,
				timestamp: Date.now(),
			};

			const updated = updateEnergyState(state, metrics, DEFAULT_ENERGY_CONFIG);

			const expectedActivity = 10 * 1.0 + 5 * 0.7; // 13.5
			expect(updated.rawActivity).toBe(expectedActivity);
			expect(updated.baseline).toBe(expectedActivity); // First update sets baseline
			expect(updated.energy).toBe(0); // Z-score is 0 on first update
		});

		it('should update baseline using EMA', () => {
			let state = createInitialEnergyState();

			// First update: establish baseline
			const metrics1: ActivityMetrics = {
				messagesPerMin: 10,
				uniqueChattersPerMin: 0,
				highValueEventsPerMin: 0,
				timestamp: Date.now(),
			};
			state = updateEnergyState(state, metrics1, DEFAULT_ENERGY_CONFIG);
			expect(state.baseline).toBe(10);

			// Second update: baseline should move via EMA
			const metrics2: ActivityMetrics = {
				messagesPerMin: 20,
				uniqueChattersPerMin: 0,
				highValueEventsPerMin: 0,
				timestamp: Date.now(),
			};
			state = updateEnergyState(state, metrics2, DEFAULT_ENERGY_CONFIG);

			// Baseline = 0.05 * 20 + 0.95 * 10 = 1 + 9.5 = 10.5
			expect(state.baseline).toBe(10.5);
		});

		it('should track activity history for std dev', () => {
			let state = createInitialEnergyState();

			// Add several updates
			for (let i = 0; i < 5; i++) {
				const metrics: ActivityMetrics = {
					messagesPerMin: 10 + i,
					uniqueChattersPerMin: 0,
					highValueEventsPerMin: 0,
					timestamp: Date.now(),
				};
				state = updateEnergyState(state, metrics, DEFAULT_ENERGY_CONFIG);
			}

			expect(state.activityHistory.length).toBe(5);
			expect(state.activityHistory).toEqual([10, 11, 12, 13, 14]);
		});

		it('should limit activity history to window size', () => {
			let state = createInitialEnergyState();
			const config = { ...DEFAULT_ENERGY_CONFIG, stdDevWindowSize: 3 };

			// Add more updates than window size
			for (let i = 0; i < 5; i++) {
				const metrics: ActivityMetrics = {
					messagesPerMin: i,
					uniqueChattersPerMin: 0,
					highValueEventsPerMin: 0,
					timestamp: Date.now(),
				};
				state = updateEnergyState(state, metrics, config);
			}

			expect(state.activityHistory.length).toBe(3);
			expect(state.activityHistory).toEqual([2, 3, 4]); // Last 3 values
		});

		it('should clamp std dev to minimum', () => {
			let state = createInitialEnergyState();

			// Create very similar activity to get low std dev
			for (let i = 0; i < 5; i++) {
				const metrics: ActivityMetrics = {
					messagesPerMin: 10,
					uniqueChattersPerMin: 0,
					highValueEventsPerMin: 0,
					timestamp: Date.now(),
				};
				state = updateEnergyState(state, metrics, DEFAULT_ENERGY_CONFIG);
			}

			// Std dev should be clamped to minStdDev (0.1)
			expect(state.stdDev).toBeGreaterThanOrEqual(DEFAULT_ENERGY_CONFIG.minStdDev);
		});

		it('should calculate positive energy during increased activity', () => {
			let state = createInitialEnergyState();

			// Establish low baseline
			for (let i = 0; i < 10; i++) {
				const metrics: ActivityMetrics = {
					messagesPerMin: 5,
					uniqueChattersPerMin: 0,
					highValueEventsPerMin: 0,
					timestamp: Date.now(),
				};
				state = updateEnergyState(state, metrics, DEFAULT_ENERGY_CONFIG);
			}

			// Sudden spike in activity
			const highMetrics: ActivityMetrics = {
				messagesPerMin: 50,
				uniqueChattersPerMin: 0,
				highValueEventsPerMin: 0,
				timestamp: Date.now(),
			};
			state = updateEnergyState(state, highMetrics, DEFAULT_ENERGY_CONFIG);

			// Energy should be positive (above baseline)
			expect(state.energy).toBeGreaterThan(0);
		});

		it('should calculate negative energy during decreased activity', () => {
			let state = createInitialEnergyState();

			// Establish high baseline
			for (let i = 0; i < 10; i++) {
				const metrics: ActivityMetrics = {
					messagesPerMin: 50,
					uniqueChattersPerMin: 0,
					highValueEventsPerMin: 0,
					timestamp: Date.now(),
				};
				state = updateEnergyState(state, metrics, DEFAULT_ENERGY_CONFIG);
			}

			// Sudden drop in activity
			const lowMetrics: ActivityMetrics = {
				messagesPerMin: 5,
				uniqueChattersPerMin: 0,
				highValueEventsPerMin: 0,
				timestamp: Date.now(),
			};
			state = updateEnergyState(state, lowMetrics, DEFAULT_ENERGY_CONFIG);

			// Energy should be negative (below baseline)
			expect(state.energy).toBeLessThan(0);
		});
	});
});
