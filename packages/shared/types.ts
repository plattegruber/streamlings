export type TwitchEventPayload = {
  subscription: { type: string };
  event: Record<string, unknown>;
};

export type InstallUserTokenBody = {
  token: string;
};

// ============================================================================
// Energy & Mood System Types
// ============================================================================

/**
 * Mood states representing the Streamling's current behavior mode
 */
export enum MoodState {
  Sleeping = 'sleeping',
  Idle = 'idle',
  Engaged = 'engaged',
  Partying = 'partying',
}

/**
 * Activity metrics contributing to the raw activity signal A(t)
 */
export interface ActivityMetrics {
  /** Messages per minute */
  messagesPerMin: number;
  /** Unique chatters per minute */
  uniqueChattersPerMin: number;
  /** Donations/subs/bits per minute (weighted heavily) */
  highValueEventsPerMin: number;
  /** Timestamp of this measurement */
  timestamp: number;
}

/**
 * Configuration parameters for the energy model
 */
export interface EnergyConfig {
  /** Time between samples in milliseconds (default: 10000 = 10 seconds) */
  tickRateMs: number;
  /** EMA alpha for baseline (default: 0.05 → ~2-3 min half-life) */
  baselineAlpha: number;
  /** EMA beta for energy smoothing (default: 0.02 → ~5-10 min half-life) */
  energyAlpha: number;
  /** Minimum standard deviation to prevent division by micro-noise (default: 0.1) */
  minStdDev: number;
  /** Window size for rolling std dev in samples (default: 60 = 10 min at 10s tick) */
  stdDevWindowSize: number;
  /** Weight for messages in activity calculation */
  messageWeight: number;
  /** Weight for unique chatters in activity calculation */
  chatterWeight: number;
  /** Weight for high-value events (subs/bits/donations) in activity calculation */
  highValueWeight: number;
}

/**
 * Internal state for energy calculation
 */
export interface EnergyState {
  /** Current raw activity signal A(t) */
  rawActivity: number;
  /** Rolling baseline B(t) */
  baseline: number;
  /** Rolling standard deviation σ(t) */
  stdDev: number;
  /** Standardized deviation Z(t) = (A(t) - B(t)) / σ(t) */
  zScore: number;
  /** Smoothed energy score E(t) */
  energy: number;
  /** Recent activity values for std dev calculation */
  activityHistory: number[];
  /** Last update timestamp */
  lastUpdate: number;
}

/**
 * Configuration for mood state transitions
 */
export interface MoodTransitionConfig {
  /** Sleeping → Idle: energy threshold */
  sleepToIdleEnergyThreshold: number;
  /** Sleeping → Idle: minimum duration in state (ms) */
  sleepToIdleMinDuration: number;
  /** Sleeping → Idle: time above threshold required (ms) */
  sleepToIdleHoldTime: number;

  /** Idle → Engaged: energy threshold */
  idleToEngagedEnergyThreshold: number;
  /** Idle → Engaged: time above threshold required (ms) */
  idleToEngagedHoldTime: number;

  /** Engaged → Partying: energy threshold */
  engagedToPartyingEnergyThreshold: number;
  /** Engaged → Partying: time above threshold required (ms) */
  engagedToPartyingHoldTime: number;

  /** Partying → Engaged: energy threshold (cooldown) */
  partyingToEngagedEnergyThreshold: number;
  /** Partying → Engaged: maximum duration in state (ms) */
  partyingToEngagedMaxDuration: number;
  /** Partying → Engaged: time below threshold required (ms) */
  partyingToEngagedHoldTime: number;

  /** Engaged → Idle: energy threshold (cooldown) */
  engagedToIdleEnergyThreshold: number;
  /** Engaged → Idle: time below threshold required (ms) */
  engagedToIdleHoldTime: number;

  /** Idle → Sleeping: energy threshold */
  idleToSleepingEnergyThreshold: number;
  /** Idle → Sleeping: time below threshold required (ms) */
  idleToSleepingHoldTime: number;
}

/**
 * Internal drive pressures that influence state transitions
 */
export interface InternalDrive {
  /** Sleep pressure builds while awake (0.0 - 1.0) */
  sleepPressure: number;
  /** Restedness builds while sleeping (0.0 - 1.0) */
  restedness: number;
  /** Exhaustion builds while partying (0.0 - 1.0) */
  exhaustion: number;
  /** Curiosity builds while idle (0.0 - 1.0) */
  curiosity: number;
}

/**
 * Configuration for internal drive accumulation
 */
export interface InternalDriveConfig {
  /** Rate at which sleep pressure builds per tick while awake */
  sleepPressureRate: number;
  /** Rate at which restedness builds per tick while sleeping */
  restednessRate: number;
  /** Rate at which exhaustion builds per tick while partying */
  exhaustionRate: number;
  /** Rate at which curiosity builds per tick while idle */
  curiosityRate: number;
  /** Sleep pressure threshold that can force Idle → Sleeping */
  sleepPressureThreshold: number;
  /** Restedness threshold that can force Sleeping → Idle */
  restednessThreshold: number;
  /** Exhaustion threshold that can force Partying → Engaged */
  exhaustionThreshold: number;
}

/**
 * Complete mood state including current state and transition tracking
 */
export interface MoodStateData {
  /** Current mood state */
  currentState: MoodState;
  /** Timestamp when entered current state */
  stateEnteredAt: number;
  /** How long in current state (ms) */
  timeInState: number;
  /** Energy value when condition for next state was first met */
  transitionConditionMetAt: number | null;
  /** Internal drive pressures */
  drive: InternalDrive;
}

/**
 * Complete telemetry snapshot for monitoring
 */
export interface StreamlingTelemetry {
  /** Current energy state */
  energy: EnergyState;
  /** Current mood state */
  mood: MoodStateData;
  /** Recent activity metrics */
  recentActivity: ActivityMetrics;
  /** Timestamp of this telemetry snapshot */
  timestamp: number;
}
