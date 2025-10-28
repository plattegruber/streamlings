import {
  MoodState,
  type MoodStateData,
  type MoodTransitionConfig,
  type InternalDrive,
  type InternalDriveConfig,
  type EnergyState,
} from '@streamlings/shared/types';

/**
 * Create initial mood state (starts in Idle)
 */
export function createInitialMoodState(): MoodStateData {
  return {
    currentState: MoodState.Idle,
    stateEnteredAt: Date.now(),
    timeInState: 0,
    transitionConditionMetAt: null,
    drive: {
      sleepPressure: 0,
      restedness: 1.0, // Start well-rested
      exhaustion: 0,
      curiosity: 0,
    },
  };
}

/**
 * Update internal drive pressures based on current state
 */
export function updateInternalDrive(
  drive: InternalDrive,
  currentState: MoodState,
  config: InternalDriveConfig,
): InternalDrive {
  const updated = { ...drive };

  // Sleep pressure builds while awake (not sleeping)
  if (currentState !== MoodState.Sleeping) {
    updated.sleepPressure = Math.min(1.0, updated.sleepPressure + config.sleepPressureRate);
    updated.restedness = Math.max(0, updated.restedness - config.restednessRate);
  }

  // Restedness builds while sleeping
  if (currentState === MoodState.Sleeping) {
    updated.restedness = Math.min(1.0, updated.restedness + config.restednessRate);
    updated.sleepPressure = Math.max(0, updated.sleepPressure - config.sleepPressureRate * 2);
  }

  // Exhaustion builds while partying
  if (currentState === MoodState.Partying) {
    updated.exhaustion = Math.min(1.0, updated.exhaustion + config.exhaustionRate);
  } else {
    // Exhaustion decays when not partying
    updated.exhaustion = Math.max(0, updated.exhaustion - config.exhaustionRate * 0.5);
  }

  // Curiosity builds while idle
  if (currentState === MoodState.Idle) {
    updated.curiosity = Math.min(1.0, updated.curiosity + config.curiosityRate);
  } else {
    // Curiosity satisfied when not idle
    updated.curiosity = 0;
  }

  return updated;
}

/**
 * Check if conditions are met for a state transition
 */
function checkTransitionCondition(
  currentState: MoodState,
  targetState: MoodState,
  energy: number,
  timeInState: number,
  drive: InternalDrive,
  transitionConditionMetAt: number | null,
  currentTime: number,
  config: MoodTransitionConfig,
  driveConfig: InternalDriveConfig,
): { shouldTransition: boolean; conditionMetAt: number | null } {
  let shouldTransition = false;
  let conditionMetAt = transitionConditionMetAt;

  switch (`${currentState}->${targetState}`) {
    // Sleeping → Idle
    case `${MoodState.Sleeping}->${MoodState.Idle}`: {
      const energyMet = energy > config.sleepToIdleEnergyThreshold;
      const minDurationMet = timeInState >= config.sleepToIdleMinDuration;
      const restednessForce = drive.restedness >= driveConfig.restednessThreshold;

      if (energyMet || restednessForce) {
        if (conditionMetAt === null) {
          conditionMetAt = currentTime;
        }

        // Check if we should transition
        const holdTime = currentTime - conditionMetAt!;
        if (holdTime >= config.sleepToIdleHoldTime && (minDurationMet || restednessForce)) {
          shouldTransition = true;
        }
      } else {
        conditionMetAt = null;
      }
      break;
    }

    // Idle → Engaged
    case `${MoodState.Idle}->${MoodState.Engaged}`: {
      const energyMet = energy > config.idleToEngagedEnergyThreshold;

      if (energyMet) {
        if (conditionMetAt === null) {
          conditionMetAt = currentTime;
        } else {
          const holdTime = currentTime - conditionMetAt;
          if (holdTime >= config.idleToEngagedHoldTime) {
            shouldTransition = true;
          }
        }
      } else {
        conditionMetAt = null;
      }
      break;
    }

    // Engaged → Partying
    case `${MoodState.Engaged}->${MoodState.Partying}`: {
      const energyMet = energy > config.engagedToPartyingEnergyThreshold;

      if (energyMet) {
        if (conditionMetAt === null) {
          conditionMetAt = currentTime;
        } else {
          const holdTime = currentTime - conditionMetAt;
          if (holdTime >= config.engagedToPartyingHoldTime) {
            shouldTransition = true;
          }
        }
      } else {
        conditionMetAt = null;
      }
      break;
    }

    // Partying → Engaged
    case `${MoodState.Partying}->${MoodState.Engaged}`: {
      const energyMet = energy < config.partyingToEngagedEnergyThreshold;
      const maxDurationMet = timeInState >= config.partyingToEngagedMaxDuration;
      const exhaustionForce = drive.exhaustion >= driveConfig.exhaustionThreshold;

      if (energyMet || maxDurationMet || exhaustionForce) {
        if (conditionMetAt === null) {
          conditionMetAt = currentTime;
        }

        // Check if we should transition
        const holdTime = currentTime - conditionMetAt!;
        if (holdTime >= config.partyingToEngagedHoldTime || maxDurationMet || exhaustionForce) {
          shouldTransition = true;
        }
      } else {
        conditionMetAt = null;
      }
      break;
    }

    // Engaged → Idle
    case `${MoodState.Engaged}->${MoodState.Idle}`: {
      const energyMet = energy < config.engagedToIdleEnergyThreshold;

      if (energyMet) {
        if (conditionMetAt === null) {
          conditionMetAt = currentTime;
        } else {
          const holdTime = currentTime - conditionMetAt;
          if (holdTime >= config.engagedToIdleHoldTime) {
            shouldTransition = true;
          }
        }
      } else {
        conditionMetAt = null;
      }
      break;
    }

    // Idle → Sleeping
    case `${MoodState.Idle}->${MoodState.Sleeping}`: {
      const energyMet = energy < config.idleToSleepingEnergyThreshold;
      const sleepPressureForce = drive.sleepPressure >= driveConfig.sleepPressureThreshold;

      if (energyMet || sleepPressureForce) {
        if (conditionMetAt === null) {
          conditionMetAt = currentTime;
        }

        // Check if we should transition
        const holdTime = currentTime - conditionMetAt!;
        if (holdTime >= config.idleToSleepingHoldTime || sleepPressureForce) {
          shouldTransition = true;
        }
      } else {
        conditionMetAt = null;
      }
      break;
    }
  }

  return { shouldTransition, conditionMetAt };
}

/**
 * Determine the potential next state based on current state
 * Returns the next possible state to check transition conditions for
 */
function getNextState(currentState: MoodState, energy: number): MoodState | null {
  // Define valid transitions for each state
  // Note: We check broad ranges here - specific thresholds are checked in transition conditions
  switch (currentState) {
    case MoodState.Sleeping:
      return MoodState.Idle; // Can only wake up

    case MoodState.Idle:
      // Check for upward transition first (higher priority)
      if (energy > 0.3) {
        return MoodState.Engaged; // Energy rising or neutral-high
      }
      // Otherwise check for sleep
      return MoodState.Sleeping; // Energy low or forced by sleep pressure

    case MoodState.Engaged:
      // Check for upward transition first
      if (energy > 1.0) {
        return MoodState.Partying; // Energy very high
      }
      // Otherwise calm down
      return MoodState.Idle; // Energy falling

    case MoodState.Partying:
      return MoodState.Engaged; // Can only calm down

    default:
      return null;
  }
}

/**
 * Update mood state based on energy and time
 */
export function updateMoodState(
  state: MoodStateData,
  energyState: EnergyState,
  transitionConfig: MoodTransitionConfig,
  driveConfig: InternalDriveConfig,
  currentTime: number = Date.now(),
): MoodStateData {
  // Calculate time in current state
  const timeInState = currentTime - state.stateEnteredAt;

  // Update internal drives
  const drive = updateInternalDrive(state.drive, state.currentState, driveConfig);

  // Determine potential next state
  const nextState = getNextState(state.currentState, energyState.energy);

  if (nextState === null) {
    // No valid transition, stay in current state
    return {
      ...state,
      timeInState,
      drive,
      transitionConditionMetAt: null,
    };
  }

  // Check if transition conditions are met
  const { shouldTransition, conditionMetAt } = checkTransitionCondition(
    state.currentState,
    nextState,
    energyState.energy,
    timeInState,
    drive,
    state.transitionConditionMetAt,
    currentTime,
    transitionConfig,
    driveConfig,
  );

  if (shouldTransition) {
    // Transition to next state
    return {
      currentState: nextState,
      stateEnteredAt: currentTime,
      timeInState: 0,
      transitionConditionMetAt: null,
      drive,
    };
  }

  // Conditions not yet met, update tracking
  return {
    ...state,
    timeInState,
    drive,
    transitionConditionMetAt: conditionMetAt,
  };
}

/**
 * Default mood transition configuration based on spec
 */
export const DEFAULT_MOOD_TRANSITION_CONFIG: MoodTransitionConfig = {
  // Sleeping → Idle
  sleepToIdleEnergyThreshold: -0.5,
  sleepToIdleMinDuration: 10 * 60 * 1000, // 10 minutes
  sleepToIdleHoldTime: 2 * 60 * 1000, // 2 minutes

  // Idle → Engaged
  idleToEngagedEnergyThreshold: 0.5,
  idleToEngagedHoldTime: 90 * 1000, // 90 seconds

  // Engaged → Partying
  engagedToPartyingEnergyThreshold: 1.5,
  engagedToPartyingHoldTime: 2 * 60 * 1000, // 2 minutes

  // Partying → Engaged
  partyingToEngagedEnergyThreshold: 1.2,
  partyingToEngagedMaxDuration: 10 * 60 * 1000, // 10 minutes
  partyingToEngagedHoldTime: 1 * 60 * 1000, // 1 minute

  // Engaged → Idle
  engagedToIdleEnergyThreshold: 0.3,
  engagedToIdleHoldTime: 3 * 60 * 1000, // 3 minutes

  // Idle → Sleeping
  idleToSleepingEnergyThreshold: -0.8,
  idleToSleepingHoldTime: 10 * 60 * 1000, // 10 minutes
};

/**
 * Default internal drive configuration
 */
export const DEFAULT_INTERNAL_DRIVE_CONFIG: InternalDriveConfig = {
  sleepPressureRate: 0.001, // Builds to 1.0 over ~1000 ticks (~2.7 hours at 10s tick)
  restednessRate: 0.002, // Builds to 1.0 over ~500 ticks (~1.4 hours at 10s tick)
  exhaustionRate: 0.01, // Builds to 1.0 over ~100 ticks (~16 minutes at 10s tick)
  curiosityRate: 0.0005, // Builds slowly

  sleepPressureThreshold: 0.8, // Force sleep at 80% pressure
  restednessThreshold: 0.9, // Force wake at 90% rested
  exhaustionThreshold: 0.85, // Force cooldown at 85% exhaustion
};
