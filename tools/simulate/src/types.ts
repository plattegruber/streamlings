import type { StreamlingTelemetry } from '@streamlings/shared';

export type ProfileName = 'dead-chat' | 'steady' | 'hype' | 'raid' | 'full-stream';

export interface ProfileConfig {
  name: ProfileName;
  /** Min messages per tick */
  msgsMin: number;
  /** Max messages per tick */
  msgsMax: number;
  /** Min unique chatters per tick */
  chattersMin: number;
  /** Max unique chatters per tick */
  chattersMax: number;
  /** Probability (0-1) of a high-value event replacing a chat message */
  hvChance: number;
  /** Description shown in the UI */
  description: string;
}

export interface FullStreamPhase {
  profile: Exclude<ProfileName, 'full-stream'>;
  /** Duration in ticks */
  ticks: number;
}

export interface Chatter {
  id: string;
  name: string;
}

export interface TickStats {
  tick: number;
  sent: number;
  errors: number;
  msgsThisTick: number;
  chattersThisTick: number;
  hvThisTick: number;
}

export interface RuntimeState {
  profile: ProfileName;
  speed: number;
  paused: boolean;
  showTelemetry: boolean;
  running: boolean;
  stats: TickStats;
  telemetry: StreamlingTelemetry | null;
  /** Current phase index for full-stream mode */
  fullStreamPhaseIndex: number;
  /** Ticks remaining in current full-stream phase */
  fullStreamTicksRemaining: number;
}

export interface CliConfig {
  url: string;
  streamerId: string;
  profile: ProfileName;
  speed: number;
  telemetry: boolean;
}
