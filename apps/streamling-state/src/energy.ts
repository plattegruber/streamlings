import type {
  EnergyConfig,
  EnergyState,
  ActivityMetrics,
} from '@streamlings/shared/types';

/**
 * Calculate exponential moving average (EMA)
 * EMA_new = alpha * value + (1 - alpha) * EMA_old
 */
export function calculateEMA(
  currentValue: number,
  previousEMA: number,
  alpha: number,
): number {
  return alpha * currentValue + (1 - alpha) * previousEMA;
}

/**
 * Calculate standard deviation of an array of values
 */
export function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;

  return Math.sqrt(variance);
}

/**
 * Calculate raw activity signal A(t) from activity metrics
 */
export function calculateRawActivity(
  metrics: ActivityMetrics,
  config: EnergyConfig,
): number {
  return (
    config.messageWeight * metrics.messagesPerMin +
    config.chatterWeight * metrics.uniqueChattersPerMin +
    config.highValueWeight * metrics.highValueEventsPerMin
  );
}

/**
 * Initialize a new energy state with default values
 */
export function createInitialEnergyState(): EnergyState {
  return {
    rawActivity: 0,
    baseline: 0,
    stdDev: 1.0,
    zScore: 0,
    energy: 0,
    activityHistory: [],
    lastUpdate: Date.now(),
  };
}

/**
 * Update energy state with new activity metrics
 *
 * This implements the full energy model:
 * 1. Calculate raw activity A(t)
 * 2. Update rolling baseline B(t) using EMA
 * 3. Update rolling standard deviation σ(t)
 * 4. Calculate standardized z-score Z(t) = (A(t) - B(t)) / σ(t)
 * 5. Smooth z-score into energy E(t) using EMA
 */
export function updateEnergyState(
  state: EnergyState,
  metrics: ActivityMetrics,
  config: EnergyConfig,
): EnergyState {
  // 1. Calculate raw activity signal A(t)
  const rawActivity = calculateRawActivity(metrics, config);

  // 2. Update rolling baseline B(t) using exponential moving average
  const baseline = state.baseline === 0
    ? rawActivity // Initialize on first update
    : calculateEMA(rawActivity, state.baseline, config.baselineAlpha);

  // 3. Update activity history for rolling std dev calculation
  const activityHistory = [...state.activityHistory, rawActivity];

  // Keep only the most recent samples for std dev window
  if (activityHistory.length > config.stdDevWindowSize) {
    activityHistory.shift();
  }

  // 4. Calculate rolling standard deviation σ(t)
  let stdDev = calculateStdDev(activityHistory);

  // Clamp to minimum to prevent division by micro-noise
  stdDev = Math.max(stdDev, config.minStdDev);

  // 5. Calculate standardized z-score Z(t)
  const zScore = (rawActivity - baseline) / stdDev;

  // 6. Smooth z-score into energy E(t) using EMA
  const energy = state.energy === 0
    ? zScore // Initialize on first update
    : calculateEMA(zScore, state.energy, config.energyAlpha);

  return {
    rawActivity,
    baseline,
    stdDev,
    zScore,
    energy,
    activityHistory,
    lastUpdate: metrics.timestamp,
  };
}

/**
 * Default energy configuration based on spec
 */
export const DEFAULT_ENERGY_CONFIG: EnergyConfig = {
  tickRateMs: 10_000, // 10 seconds
  baselineAlpha: 0.05, // ~2-3 min half-life
  energyAlpha: 0.02, // ~5-10 min half-life
  minStdDev: 0.1, // Prevent division by micro-noise
  stdDevWindowSize: 60, // 10 minutes at 10s tick rate
  messageWeight: 1.0,
  chatterWeight: 0.7,
  highValueWeight: 3.0,
};
