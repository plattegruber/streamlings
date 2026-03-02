import type { ProfileConfig, FullStreamPhase, ProfileName, Chatter } from './types.js';

export const PROFILES: Record<Exclude<ProfileName, 'full-stream'>, ProfileConfig> = {
  'dead-chat': {
    name: 'dead-chat',
    msgsMin: 0,
    msgsMax: 1,
    chattersMin: 0,
    chattersMax: 1,
    hvChance: 0,
    description: 'Near-silence',
  },
  steady: {
    name: 'steady',
    msgsMin: 3,
    msgsMax: 6,
    chattersMin: 2,
    chattersMax: 4,
    hvChance: 0.08,
    description: 'Normal stream',
  },
  hype: {
    name: 'hype',
    msgsMin: 12,
    msgsMax: 20,
    chattersMin: 6,
    chattersMax: 12,
    hvChance: 0.5,
    description: 'Peak hype',
  },
  raid: {
    name: 'raid',
    msgsMin: 20,
    msgsMax: 30,
    chattersMin: 10,
    chattersMax: 15,
    hvChance: 0.8,
    description: 'Extreme burst',
  },
};

export const FULL_STREAM_SEQUENCE: FullStreamPhase[] = [
  { profile: 'dead-chat', ticks: 5 },
  { profile: 'steady', ticks: 18 },
  { profile: 'hype', ticks: 18 },
  { profile: 'raid', ticks: 6 },
  { profile: 'hype', ticks: 12 },
  { profile: 'steady', ticks: 18 },
  { profile: 'dead-chat', ticks: 12 },
];

/** High-value event types and their weights */
export interface HvEventType {
  type: string;
  weight: number;
}

const BASE_HV_WEIGHTS: HvEventType[] = [
  { type: 'channel.subscribe', weight: 35 },
  { type: 'channel.cheer', weight: 30 },
  { type: 'channel.subscription.gift', weight: 20 },
  { type: 'channel.subscription.message', weight: 10 },
  { type: 'channel.raid', weight: 5 },
];

const RAID_HV_WEIGHTS: HvEventType[] = [
  { type: 'channel.subscribe', weight: 20 },
  { type: 'channel.cheer', weight: 20 },
  { type: 'channel.subscription.gift', weight: 15 },
  { type: 'channel.subscription.message', weight: 15 },
  { type: 'channel.raid', weight: 30 },
];

export function getHvWeights(profile: Exclude<ProfileName, 'full-stream'>): HvEventType[] {
  return profile === 'raid' ? RAID_HV_WEIGHTS : BASE_HV_WEIGHTS;
}

/** Pick a weighted-random HV event type */
export function pickHvEventType(weights: HvEventType[]): string {
  const total = weights.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * total;
  for (const w of weights) {
    roll -= w.weight;
    if (roll <= 0) return w.type;
  }
  return weights[weights.length - 1].type;
}

/** Pool of 20 fake chatters */
export const CHATTER_POOL: Chatter[] = Array.from({ length: 20 }, (_, i) => ({
  id: `sim-chatter-${i + 1}`,
  name: `SimChatter_${i + 1}`,
}));

/** Random integer in [min, max] inclusive */
export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Sample n unique chatters from the pool */
export function sampleChatters(n: number): Chatter[] {
  const shuffled = [...CHATTER_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

/** Resolve the active ProfileConfig from a RuntimeState profile name */
export function resolveProfile(
  profileName: ProfileName,
  fullStreamPhaseIndex: number
): ProfileConfig {
  if (profileName === 'full-stream') {
    const phase = FULL_STREAM_SEQUENCE[fullStreamPhaseIndex];
    return PROFILES[phase.profile];
  }
  return PROFILES[profileName];
}
