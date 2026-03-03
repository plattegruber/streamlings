/**
 * Fast bench harness — generates synthetic traffic patterns and runs
 * the actual energy/mood functions tick-by-tick. No workers, no files,
 * no Harvard download. Results in ~1 second.
 */

import {
  updateEnergyState,
  createInitialEnergyState,
  DEFAULT_ENERGY_CONFIG,
} from '../../../apps/streamling-state/src/energy.js';
import {
  updateMoodState,
  createInitialMoodState,
  DEFAULT_MOOD_TRANSITION_CONFIG,
  DEFAULT_INTERNAL_DRIVE_CONFIG,
} from '../../../apps/streamling-state/src/mood.js';

import type {
  ActivityMetrics,
  EnergyConfig,
  EnergyState,
  MoodStateData,
  MoodTransitionConfig,
  InternalDriveConfig,
} from '@streamlings/shared/types';

// ─── Traffic pattern generators ──────────────────────────────────────────

interface TickInput {
  messagesPerMin: number;
  uniqueChattersPerMin: number;
  highValueEventsPerMin: number;
}

type PatternFn = (tick: number, totalTicks: number) => TickInput;

/** Add gaussian noise to a value (clamped to 0) */
function noisy(base: number, stddev: number): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(0, base + z * stddev);
}

const PATTERNS: Record<string, { description: string; totalTicks: number; fn: PatternFn }> = {
  // Scenario 1: Dead chat → sudden hype → sustained → cool down
  'dead-to-hype': {
    description: 'Dead chat (5 min) → sudden spike (3 min) → sustained hype (10 min) → gradual cool (5 min) → dead (5 min)',
    totalTicks: 168, // 28 minutes
    fn: (tick) => {
      if (tick < 30) {
        // Dead chat: 0-2 msg/min
        return { messagesPerMin: noisy(1, 0.5), uniqueChattersPerMin: noisy(0.5, 0.3), highValueEventsPerMin: 0 };
      } else if (tick < 48) {
        // Sudden hype: 40-80 msg/min with subs
        return { messagesPerMin: noisy(60, 15), uniqueChattersPerMin: noisy(25, 5), highValueEventsPerMin: noisy(3, 1) };
      } else if (tick < 108) {
        // Sustained hype: 30-50 msg/min
        return { messagesPerMin: noisy(40, 10), uniqueChattersPerMin: noisy(18, 4), highValueEventsPerMin: noisy(1, 0.5) };
      } else if (tick < 138) {
        // Gradual cool: linearly decreasing
        const progress = (tick - 108) / 30;
        const msgs = 40 * (1 - progress) + 2 * progress;
        return { messagesPerMin: noisy(msgs, 3), uniqueChattersPerMin: noisy(msgs * 0.4, 2), highValueEventsPerMin: 0 };
      } else {
        // Dead again
        return { messagesPerMin: noisy(1, 0.5), uniqueChattersPerMin: noisy(0.5, 0.3), highValueEventsPerMin: 0 };
      }
    },
  },

  // Scenario 2: Steady stream with periodic spikes (raids)
  'steady-with-raids': {
    description: 'Steady 15 msg/min with 3 raid spikes at 8, 18, and 28 min',
    totalTicks: 216, // 36 minutes
    fn: (tick) => {
      let msgs = noisy(15, 3);
      let chatters = noisy(8, 2);
      let hv = noisy(0.5, 0.3);

      // Raid spikes: 3-tick bursts at tick 48, 108, 168
      for (const raidTick of [48, 108, 168]) {
        if (tick >= raidTick && tick < raidTick + 3) {
          msgs = noisy(120, 20);
          chatters = noisy(50, 10);
          hv = noisy(8, 2);
        }
      }

      return { messagesPerMin: msgs, uniqueChattersPerMin: chatters, highValueEventsPerMin: hv };
    },
  },

  // Scenario 3: Slow ramp up over an hour
  'slow-ramp': {
    description: 'Linear ramp from 2 to 60 msg/min over 30 min, then plateau',
    totalTicks: 270, // 45 minutes
    fn: (tick) => {
      if (tick < 180) {
        // Linear ramp
        const progress = tick / 180;
        const msgs = 2 + 58 * progress;
        return { messagesPerMin: noisy(msgs, msgs * 0.15), uniqueChattersPerMin: noisy(msgs * 0.4, 2), highValueEventsPerMin: noisy(progress * 2, 0.5) };
      } else {
        // Plateau at 60
        return { messagesPerMin: noisy(60, 8), uniqueChattersPerMin: noisy(24, 4), highValueEventsPerMin: noisy(2, 0.7) };
      }
    },
  },

  // Scenario 4: Small streamer — low but variable activity
  'small-streamer': {
    description: 'Small channel: 3-8 msg/min with natural variance, 40 min',
    totalTicks: 240, // 40 minutes
    fn: (tick) => {
      // Sinusoidal variation to simulate natural engagement waves
      const wave = Math.sin(tick / 20 * Math.PI) * 2;
      const msgs = Math.max(0, noisy(5 + wave, 1.5));
      return { messagesPerMin: msgs, uniqueChattersPerMin: noisy(msgs * 0.6, 0.5), highValueEventsPerMin: 0 };
    },
  },

  // Scenario 5: Hype → sudden death (streamer says "brb")
  'hype-to-dead': {
    description: 'Hype chat (10 min) → instant drop to zero → slow recovery (10 min)',
    totalTicks: 180, // 30 minutes
    fn: (tick) => {
      if (tick < 60) {
        // Active hype
        return { messagesPerMin: noisy(50, 10), uniqueChattersPerMin: noisy(20, 4), highValueEventsPerMin: noisy(2, 0.8) };
      } else if (tick < 90) {
        // Dead silence
        return { messagesPerMin: noisy(0.5, 0.3), uniqueChattersPerMin: noisy(0.3, 0.2), highValueEventsPerMin: 0 };
      } else {
        // Slow recovery
        const progress = (tick - 90) / 90;
        const msgs = 0.5 + 40 * progress;
        return { messagesPerMin: noisy(msgs, msgs * 0.2), uniqueChattersPerMin: noisy(msgs * 0.4, 1), highValueEventsPerMin: noisy(progress, 0.3) };
      }
    },
  },

  // Scenario 6: Rapid oscillation (chat games, polls, sub trains)
  'oscillating': {
    description: '60-second on/off cycles — tests thrash resistance',
    totalTicks: 180, // 30 minutes
    fn: (tick) => {
      // 6-tick cycles (60 seconds): 3 ticks high, 3 ticks low
      const inCycle = tick % 6;
      if (inCycle < 3) {
        return { messagesPerMin: noisy(50, 8), uniqueChattersPerMin: noisy(20, 3), highValueEventsPerMin: noisy(1, 0.5) };
      } else {
        return { messagesPerMin: noisy(5, 2), uniqueChattersPerMin: noisy(3, 1), highValueEventsPerMin: 0 };
      }
    },
  },

  // Scenario 7: Full stream lifecycle (3 hours compressed)
  'full-stream': {
    description: '3-hour stream: pre-stream → ramp → peak → mid → peak2 → wind-down → end',
    totalTicks: 1080, // 3 hours at 10s ticks
    fn: (tick) => {
      const minute = tick / 6;
      if (minute < 10) {
        // Pre-stream warmup
        return { messagesPerMin: noisy(3, 1), uniqueChattersPerMin: noisy(2, 0.5), highValueEventsPerMin: 0 };
      } else if (minute < 30) {
        // Ramp up
        const p = (minute - 10) / 20;
        const msgs = 3 + 37 * p;
        return { messagesPerMin: noisy(msgs, 5), uniqueChattersPerMin: noisy(msgs * 0.4, 2), highValueEventsPerMin: noisy(p * 1.5, 0.5) };
      } else if (minute < 50) {
        // First peak
        return { messagesPerMin: noisy(45, 10), uniqueChattersPerMin: noisy(20, 4), highValueEventsPerMin: noisy(2, 0.8) };
      } else if (minute < 80) {
        // Mid-stream lull
        return { messagesPerMin: noisy(15, 4), uniqueChattersPerMin: noisy(8, 2), highValueEventsPerMin: noisy(0.3, 0.2) };
      } else if (minute < 110) {
        // Second peak (game change or event)
        return { messagesPerMin: noisy(55, 12), uniqueChattersPerMin: noisy(25, 5), highValueEventsPerMin: noisy(3, 1) };
      } else if (minute < 150) {
        // Wind down
        const p = (minute - 110) / 40;
        const msgs = 55 * (1 - p) + 5 * p;
        return { messagesPerMin: noisy(msgs, 4), uniqueChattersPerMin: noisy(msgs * 0.35, 2), highValueEventsPerMin: noisy((1 - p) * 0.5, 0.2) };
      } else {
        // End — stragglers
        return { messagesPerMin: noisy(2, 1), uniqueChattersPerMin: noisy(1.5, 0.5), highValueEventsPerMin: 0 };
      }
    },
  },
};

// ─── Simulation engine ───────────────────────────────────────────────────

interface TickRecord {
  tick: number;
  timestampMs: number;
  messagesPerMin: number;
  energy: number;
  zScore: number;
  baseline: number;
  rawActivity: number;
  mood: string;
  timeInStateMs: number;
  sleepPressure: number;
  restedness: number;
  exhaustion: number;
}

interface StateSpan {
  state: string;
  startTick: number;
  endTick: number;
  durationMs: number;
}

interface SimResult {
  pattern: string;
  description: string;
  records: TickRecord[];
  spans: StateSpan[];
  durationMin: number;
  transitions: number;
  transitionsPerHour: number;
  thrashRatio: number;
  shortSpans: number;
  medianResponseMs: number;
  energyMin: number;
  energyMax: number;
  energyMean: number;
  crossings03: number;
  partyingReached: boolean;
  partyingMaxDurationMs: number;
  timeInState: Record<string, number>;
  baselineTrackingOk: boolean;
}

function runSimulation(
  patternName: string,
  pattern: { description: string; totalTicks: number; fn: PatternFn },
  energyConfig: EnergyConfig,
  transitionConfig: MoodTransitionConfig,
  driveConfig: InternalDriveConfig,
): SimResult {
  const tickMs = energyConfig.tickRateMs;
  const epoch = 0;

  let energyState: EnergyState = { ...createInitialEnergyState(), lastUpdate: epoch };
  let moodState: MoodStateData = { ...createInitialMoodState(), stateEnteredAt: epoch };

  const records: TickRecord[] = [];

  for (let tick = 0; tick < pattern.totalTicks; tick++) {
    const currentTime = epoch + tick * tickMs;
    const input = pattern.fn(tick, pattern.totalTicks);

    const metrics: ActivityMetrics = {
      messagesPerMin: input.messagesPerMin,
      uniqueChattersPerMin: input.uniqueChattersPerMin,
      highValueEventsPerMin: input.highValueEventsPerMin,
      timestamp: currentTime,
    };

    energyState = updateEnergyState(energyState, metrics, energyConfig);
    moodState = updateMoodState(moodState, energyState, transitionConfig, driveConfig, currentTime);

    records.push({
      tick,
      timestampMs: tick * tickMs,
      messagesPerMin: input.messagesPerMin,
      energy: energyState.energy,
      zScore: energyState.zScore,
      baseline: energyState.baseline,
      rawActivity: energyState.rawActivity,
      mood: moodState.currentState,
      timeInStateMs: moodState.timeInState,
      sleepPressure: moodState.drive.sleepPressure,
      restedness: moodState.drive.restedness,
      exhaustion: moodState.drive.exhaustion,
    });
  }

  // Extract state spans
  const spans: StateSpan[] = [];
  let spanStart = 0;
  let spanState = records[0].mood;
  for (let i = 1; i < records.length; i++) {
    if (records[i].mood !== spanState) {
      spans.push({ state: spanState, startTick: spanStart, endTick: i - 1, durationMs: (i - spanStart) * tickMs });
      spanStart = i;
      spanState = records[i].mood;
    }
  }
  spans.push({ state: spanState, startTick: spanStart, endTick: records.length - 1, durationMs: (records.length - spanStart) * tickMs });

  const transitions = spans.length - 1;
  const durationMin = (pattern.totalTicks * tickMs) / 60000;
  const transitionsPerHour = durationMin > 0 ? (transitions / durationMin) * 60 : 0;

  const shortSpans = spans.filter(s => s.durationMs < 120_000);
  const thrashRatio = spans.length > 1 ? shortSpans.length / spans.length : 0;

  // Response time: z_score spikes above 1.0 → upward mood change
  const responseTimes: number[] = [];
  let spikeStart: number | null = null;
  let moodAtSpike: string | null = null;
  for (const r of records) {
    if (r.zScore > 1.0 && spikeStart === null) {
      spikeStart = r.timestampMs;
      moodAtSpike = r.mood;
    }
    if (spikeStart !== null && moodAtSpike !== null) {
      const isUpward =
        (moodAtSpike === 'sleeping' && r.mood !== 'sleeping') ||
        (moodAtSpike === 'idle' && (r.mood === 'engaged' || r.mood === 'partying')) ||
        (moodAtSpike === 'engaged' && r.mood === 'partying');
      if (isUpward) {
        responseTimes.push(r.timestampMs - spikeStart);
        spikeStart = null;
        moodAtSpike = null;
      }
      if (r.zScore < 0.5) {
        spikeStart = null;
        moodAtSpike = null;
      }
    }
  }
  const medianResponseMs = responseTimes.length > 0
    ? responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length / 2)]
    : 0;

  const energies = records.map(r => r.energy);
  const energyMin = Math.min(...energies);
  const energyMax = Math.max(...energies);
  const energyMean = energies.reduce((a, b) => a + b, 0) / energies.length;

  let crossings03 = 0;
  for (let i = 1; i < energies.length; i++) {
    if ((energies[i - 1] < 0.3 && energies[i] >= 0.3) || (energies[i - 1] >= 0.3 && energies[i] < 0.3)) {
      crossings03++;
    }
  }

  const partyingSpans = spans.filter(s => s.state === 'partying');
  const partyingReached = partyingSpans.length > 0;
  const partyingMaxDurationMs = partyingSpans.length > 0 ? Math.max(...partyingSpans.map(s => s.durationMs)) : 0;

  const timeInState: Record<string, number> = { sleeping: 0, idle: 0, engaged: 0, partying: 0 };
  for (const span of spans) {
    if (span.state in timeInState) timeInState[span.state] += span.durationMs;
  }
  const totalTime = Object.values(timeInState).reduce((a, b) => a + b, 0);
  for (const state in timeInState) timeInState[state] = totalTime > 0 ? timeInState[state] / totalTime : 0;

  const activities = records.map(r => r.rawActivity);
  const meanAct = activities.reduce((a, b) => a + b, 0) / activities.length;
  const stdAct = Math.sqrt(activities.reduce((sum, v) => sum + (v - meanAct) ** 2, 0) / activities.length);
  const finalBaseline = records[records.length - 1].baseline;
  const baselineTrackingOk = Math.abs(finalBaseline - meanAct) <= stdAct || stdAct === 0;

  return {
    pattern: patternName,
    description: pattern.description,
    records,
    spans,
    durationMin,
    transitions,
    transitionsPerHour,
    thrashRatio,
    shortSpans: shortSpans.length,
    medianResponseMs,
    energyMin,
    energyMax,
    energyMean,
    crossings03,
    partyingReached,
    partyingMaxDurationMs,
    timeInState,
    baselineTrackingOk,
  };
}

// ─── Sparkline renderer ──────────────────────────────────────────────────

function sparkline(values: number[], width: number = 60): string {
  if (values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const bars = ' ▁▂▃▄▅▆▇█';

  // Downsample to width
  const step = Math.max(1, Math.floor(values.length / width));
  const sampled: number[] = [];
  for (let i = 0; i < values.length; i += step) {
    sampled.push(values[i]);
  }

  return sampled.map(v => {
    const idx = Math.round(((v - min) / range) * (bars.length - 1));
    return bars[idx];
  }).join('');
}

function moodTimeline(records: TickRecord[], width: number = 60): string {
  const step = Math.max(1, Math.floor(records.length / width));
  const chars: string[] = [];
  const moodChar: Record<string, string> = { sleeping: '😴', idle: '💤', engaged: '😊', partying: '🎉' };
  // For compact view, use single chars
  const moodLetter: Record<string, string> = { sleeping: 'S', idle: 'I', engaged: 'E', partying: 'P' };

  for (let i = 0; i < records.length; i += step) {
    chars.push(moodLetter[records[i].mood] || '?');
  }
  return chars.join('');
}

// ─── Reporting ───────────────────────────────────────────────────────────

function pct(ratio: number): string { return `${(ratio * 100).toFixed(1)}%`; }
function fmtMs(ms: number): string {
  if (ms === 0) return 'N/A';
  return ms < 60000 ? `${(ms / 1000).toFixed(0)}s` : `${(ms / 60000).toFixed(1)}m`;
}
function grade(ok: boolean): string { return ok ? '✅' : '❌'; }

function printResult(r: SimResult): void {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  ${r.pattern}`);
  console.log(`  ${r.description}`);
  console.log(`${'─'.repeat(70)}`);

  console.log(`  Energy:  ${sparkline(r.records.map(r => r.energy))}`);
  console.log(`           min=${r.energyMin.toFixed(2)} max=${r.energyMax.toFixed(2)} avg=${r.energyMean.toFixed(2)}`);
  console.log(`  Mood:    ${moodTimeline(r.records)}`);
  console.log(`           S=sleeping I=idle E=engaged P=partying`);
  console.log();

  const tphOk = r.transitionsPerHour >= 3 && r.transitionsPerHour <= 10;
  const thrashOk = r.thrashRatio < 0.10;
  const responseOk = r.medianResponseMs === 0 || (r.medianResponseMs >= 30_000 && r.medianResponseMs <= 180_000);

  console.log(`  Transitions/hr:     ${r.transitionsPerHour.toFixed(1).padStart(6)} (target 3-10)        ${grade(tphOk)}`);
  console.log(`  Thrash ratio:       ${pct(r.thrashRatio).padStart(6)} (target <10%)        ${grade(thrashOk)}`);
  console.log(`    Short spans:      ${String(r.shortSpans).padStart(6)} of ${r.spans.length} spans (<2 min)`);
  console.log(`  Median response:    ${fmtMs(r.medianResponseMs).padStart(6)} (target 0.5-3 min)   ${grade(responseOk)}`);
  console.log(`  0.3 crossings:      ${String(r.crossings03).padStart(6)}`);
  console.log(`  Partying reached:   ${String(r.partyingReached).padStart(6)}   max duration: ${fmtMs(r.partyingMaxDurationMs)}`);
  console.log(`  Baseline tracking:  ${grade(r.baselineTrackingOk)}`);
  console.log();
  console.log(`  Time in state:   sleeping ${pct(r.timeInState.sleeping).padStart(6)}  idle ${pct(r.timeInState.idle).padStart(6)}  engaged ${pct(r.timeInState.engaged).padStart(6)}  partying ${pct(r.timeInState.partying).padStart(6)}`);
}

// ─── Main ────────────────────────────────────────────────────────────────

function main(): void {
  const energyConfig = { ...DEFAULT_ENERGY_CONFIG };
  const transitionConfig = { ...DEFAULT_MOOD_TRANSITION_CONFIG };
  const driveConfig = { ...DEFAULT_INTERNAL_DRIVE_CONFIG };

  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  Mood System Bench — Synthetic Traffic Patterns                     ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log();
  console.log('Config:');
  console.log(`  Energy:  baselineAlpha=${energyConfig.baselineAlpha}  energyAlpha=${energyConfig.energyAlpha}  minStdDev=${energyConfig.minStdDev}`);
  console.log(`  Mood:    idle→eng=${transitionConfig.idleToEngagedEnergyThreshold} (${transitionConfig.idleToEngagedHoldTime / 1000}s hold)  eng→party=${transitionConfig.engagedToPartyingEnergyThreshold} (${transitionConfig.engagedToPartyingHoldTime / 1000}s hold)`);
  console.log(`           eng→idle=${transitionConfig.engagedToIdleEnergyThreshold} (${transitionConfig.engagedToIdleHoldTime / 1000}s hold)  idle→sleep=${transitionConfig.idleToSleepingEnergyThreshold} (${transitionConfig.idleToSleepingHoldTime / 1000}s hold)`);

  // Seed random for reproducibility
  // (Math.random is not seedable in JS, but results are still meaningful)

  const results: SimResult[] = [];

  for (const [name, pattern] of Object.entries(PATTERNS)) {
    const result = runSimulation(name, pattern, energyConfig, transitionConfig, driveConfig);
    results.push(result);
    printResult(result);
  }

  // ─── Overall summary ──────────────────────────────────────────────

  console.log(`\n${'═'.repeat(70)}`);
  console.log('  OVERALL SUMMARY');
  console.log(`${'═'.repeat(70)}`);

  const avgTph = results.reduce((s, r) => s + r.transitionsPerHour, 0) / results.length;
  const avgThrash = results.reduce((s, r) => s + r.thrashRatio, 0) / results.length;
  const responseResults = results.filter(r => r.medianResponseMs > 0);
  const avgResponse = responseResults.length > 0
    ? responseResults.reduce((s, r) => s + r.medianResponseMs, 0) / responseResults.length
    : 0;
  const anyPartying = results.some(r => r.partyingReached);
  const allBaseline = results.every(r => r.baselineTrackingOk);

  console.log();
  console.log(`  Avg transitions/hr:  ${avgTph.toFixed(1)}     ${grade(avgTph >= 3 && avgTph <= 10)}`);
  console.log(`  Avg thrash ratio:    ${pct(avgThrash)}     ${grade(avgThrash < 0.10)}`);
  console.log(`  Avg response time:   ${fmtMs(avgResponse)}     ${grade(avgResponse >= 30_000 && avgResponse <= 180_000)}`);
  console.log(`  Partying reachable:  ${anyPartying}     ${grade(anyPartying)}`);
  console.log(`  Baseline tracking:   ${allBaseline}     ${grade(allBaseline)}`);
  console.log();

  // Identify problems
  const problems: string[] = [];
  for (const r of results) {
    if (r.transitionsPerHour < 3) problems.push(`${r.pattern}: too few transitions (${r.transitionsPerHour.toFixed(1)}/hr) — mood feels stuck`);
    if (r.transitionsPerHour > 10) problems.push(`${r.pattern}: too many transitions (${r.transitionsPerHour.toFixed(1)}/hr) — mood feels jittery`);
    if (r.thrashRatio >= 0.10) problems.push(`${r.pattern}: high thrash (${pct(r.thrashRatio)}) — ${r.shortSpans} spans < 2 min`);
    if (r.medianResponseMs > 180_000) problems.push(`${r.pattern}: slow response (${fmtMs(r.medianResponseMs)}) — feels sluggish`);
    if (r.medianResponseMs > 0 && r.medianResponseMs < 30_000) problems.push(`${r.pattern}: response too fast (${fmtMs(r.medianResponseMs)}) — over-reactive`);
  }

  if (problems.length > 0) {
    console.log('  ISSUES:');
    for (const p of problems) {
      console.log(`    ❌ ${p}`);
    }
  } else {
    console.log('  All scenarios pass! Config looks good.');
  }

  console.log();
}

main();
