/**
 * Analyze simulation telemetry and produce a findings report.
 *
 * Reads per-stream telemetry CSVs from output/telemetry/ and computes
 * validation metrics for the energy/mood system.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_ENERGY_CONFIG,
} from '../../../apps/streamling-state/src/energy.js';
import {
  DEFAULT_MOOD_TRANSITION_CONFIG,
  DEFAULT_INTERNAL_DRIVE_CONFIG,
} from '../../../apps/streamling-state/src/mood.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TELEMETRY_DIR = join(ROOT, 'output', 'telemetry');
const SELECTED_PATH = join(ROOT, 'data', 'preprocessed', 'selected.json');
const FINDINGS_PATH = join(ROOT, 'output', 'findings.md');

interface TelemetryRow {
  tick: number;
  timestamp_ms: number;
  messages_per_min: number;
  chatters_per_min: number;
  raw_activity: number;
  baseline: number;
  std_dev: number;
  z_score: number;
  energy: number;
  mood_state: string;
  time_in_state_ms: number;
  sleep_pressure: number;
  restedness: number;
  exhaustion: number;
}

function parseTelemetryCsv(path: string): TelemetryRow[] {
  const content = readFileSync(path, 'utf-8');
  const lines = content.trim().split('\n');
  const rows: TelemetryRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    rows.push({
      tick: parseInt(c[0], 10),
      timestamp_ms: parseInt(c[1], 10),
      messages_per_min: parseFloat(c[2]),
      chatters_per_min: parseFloat(c[3]),
      raw_activity: parseFloat(c[4]),
      baseline: parseFloat(c[5]),
      std_dev: parseFloat(c[6]),
      z_score: parseFloat(c[7]),
      energy: parseFloat(c[8]),
      mood_state: c[9],
      time_in_state_ms: parseInt(c[10], 10),
      sleep_pressure: parseFloat(c[11]),
      restedness: parseFloat(c[12]),
      exhaustion: parseFloat(c[13]),
    });
  }
  return rows;
}

interface StateSpan {
  state: string;
  startMs: number;
  endMs: number;
  durationMs: number;
}

function extractStateSpans(rows: TelemetryRow[]): StateSpan[] {
  if (rows.length === 0) return [];

  const spans: StateSpan[] = [];
  let currentState = rows[0].mood_state;
  let startMs = rows[0].timestamp_ms;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i].mood_state !== currentState) {
      spans.push({
        state: currentState,
        startMs,
        endMs: rows[i].timestamp_ms,
        durationMs: rows[i].timestamp_ms - startMs,
      });
      currentState = rows[i].mood_state;
      startMs = rows[i].timestamp_ms;
    }
  }

  // Final span
  const lastTs = rows[rows.length - 1].timestamp_ms;
  spans.push({
    state: currentState,
    startMs,
    endMs: lastTs,
    durationMs: lastTs - startMs,
  });

  return spans;
}

interface StreamMetrics {
  streamId: string;
  label: string;
  durationMin: number;
  totalTransitions: number;
  transitionsPerHour: number;
  thrashRatio: number;
  medianResponseTimeMs: number;
  energyMin: number;
  energyMax: number;
  energyMean: number;
  energyCrosses03: boolean;
  partyingReached: boolean;
  partyingSustained45s: boolean;
  timeInState: Record<string, number>;
  baselineTracking: { meanActivity: number; finalBaseline: number; withinOneSigma: boolean };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Detect activity spikes (z_score rising above 1.0) and measure how long
 * until the mood transitions upward.
 */
function computeResponseTimes(rows: TelemetryRow[]): number[] {
  const responseTimes: number[] = [];
  let spikeStart: number | null = null;
  let moodAtSpike: string | null = null;

  for (const row of rows) {
    if (row.z_score > 1.0 && spikeStart === null) {
      spikeStart = row.timestamp_ms;
      moodAtSpike = row.mood_state;
    }

    if (spikeStart !== null && moodAtSpike !== null) {
      // Check for upward mood transition
      const isUpward =
        (moodAtSpike === 'sleeping' && row.mood_state !== 'sleeping') ||
        (moodAtSpike === 'idle' && (row.mood_state === 'engaged' || row.mood_state === 'partying')) ||
        (moodAtSpike === 'engaged' && row.mood_state === 'partying');

      if (isUpward) {
        responseTimes.push(row.timestamp_ms - spikeStart);
        spikeStart = null;
        moodAtSpike = null;
      }

      // Reset if spike ends without mood change
      if (row.z_score < 0.5) {
        spikeStart = null;
        moodAtSpike = null;
      }
    }
  }

  return responseTimes;
}

function analyzeStream(streamId: string, label: string, rows: TelemetryRow[]): StreamMetrics {
  const durationMs = rows[rows.length - 1].timestamp_ms - rows[0].timestamp_ms;
  const durationMin = durationMs / 60000;

  const spans = extractStateSpans(rows);
  const totalTransitions = spans.length - 1;
  const transitionsPerHour = durationMin > 0 ? (totalTransitions / durationMin) * 60 : 0;

  // Thrash ratio: % of state spans lasting < 2 minutes
  const shortSpans = spans.filter(s => s.durationMs < 2 * 60 * 1000);
  const thrashRatio = spans.length > 0 ? shortSpans.length / spans.length : 0;

  // Response time
  const responseTimes = computeResponseTimes(rows);
  const medianResponseTimeMs = median(responseTimes);

  // Energy stats
  const energies = rows.map(r => r.energy);
  const energyMin = Math.min(...energies);
  const energyMax = Math.max(...energies);
  const energyMean = energies.reduce((a, b) => a + b, 0) / energies.length;

  // Does energy cross 0.3 regularly?
  let crosses03 = 0;
  for (let i = 1; i < energies.length; i++) {
    if ((energies[i - 1] < 0.3 && energies[i] >= 0.3) || (energies[i - 1] >= 0.3 && energies[i] < 0.3)) {
      crosses03++;
    }
  }

  // Partying reachability
  const partyingSpans = spans.filter(s => s.state === 'partying');
  const partyingReached = partyingSpans.length > 0;
  const partyingSustained45s = partyingSpans.some(s => s.durationMs >= 45000);

  // Time-in-state distribution
  const timeInState: Record<string, number> = {
    sleeping: 0, idle: 0, engaged: 0, partying: 0,
  };
  for (const span of spans) {
    if (span.state in timeInState) {
      timeInState[span.state] += span.durationMs;
    }
  }
  const totalTime = Object.values(timeInState).reduce((a, b) => a + b, 0);
  for (const state in timeInState) {
    timeInState[state] = totalTime > 0 ? timeInState[state] / totalTime : 0;
  }

  // Baseline tracking
  const activities = rows.map(r => r.raw_activity);
  const meanActivity = activities.reduce((a, b) => a + b, 0) / activities.length;
  const stdActivity = Math.sqrt(
    activities.reduce((sum, v) => sum + (v - meanActivity) ** 2, 0) / activities.length,
  );
  const finalBaseline = rows[rows.length - 1].baseline;
  const withinOneSigma = Math.abs(finalBaseline - meanActivity) <= stdActivity;

  return {
    streamId,
    label,
    durationMin,
    totalTransitions,
    transitionsPerHour,
    thrashRatio,
    medianResponseTimeMs,
    energyMin,
    energyMax,
    energyMean,
    energyCrosses03: crosses03 >= 2,
    partyingReached,
    partyingSustained45s,
    timeInState,
    baselineTracking: { meanActivity, finalBaseline, withinOneSigma },
  };
}

function formatPct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function formatTime(ms: number): string {
  if (ms === 0) return 'N/A';
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(0)}s`;
  return `${(sec / 60).toFixed(1)} min`;
}

function passOrFail(pass: boolean): string {
  return pass ? 'PASS' : 'FAIL';
}

function generateReport(metrics: StreamMetrics[]): string {
  const lines: string[] = [];

  lines.push('# Mood System Validation — Findings');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Config Used');
  lines.push('');
  lines.push('| Parameter | Value |');
  lines.push('|-----------|-------|');
  lines.push(`| baselineAlpha | ${DEFAULT_ENERGY_CONFIG.baselineAlpha} |`);
  lines.push(`| energyAlpha | ${DEFAULT_ENERGY_CONFIG.energyAlpha} |`);
  lines.push(`| minStdDev | ${DEFAULT_ENERGY_CONFIG.minStdDev} |`);
  lines.push(`| stdDevWindowSize | ${DEFAULT_ENERGY_CONFIG.stdDevWindowSize} |`);
  lines.push(`| idle→engaged threshold | ${DEFAULT_MOOD_TRANSITION_CONFIG.idleToEngagedEnergyThreshold} |`);
  lines.push(`| idle→engaged hold | ${DEFAULT_MOOD_TRANSITION_CONFIG.idleToEngagedHoldTime / 1000}s |`);
  lines.push(`| engaged→partying threshold | ${DEFAULT_MOOD_TRANSITION_CONFIG.engagedToPartyingEnergyThreshold} |`);
  lines.push(`| engaged→partying hold | ${DEFAULT_MOOD_TRANSITION_CONFIG.engagedToPartyingHoldTime / 1000}s |`);
  lines.push(`| engaged→idle threshold | ${DEFAULT_MOOD_TRANSITION_CONFIG.engagedToIdleEnergyThreshold} |`);
  lines.push(`| engaged→idle hold | ${DEFAULT_MOOD_TRANSITION_CONFIG.engagedToIdleHoldTime / 1000}s |`);
  lines.push(`| sleepPressureRate | ${DEFAULT_INTERNAL_DRIVE_CONFIG.sleepPressureRate} |`);
  lines.push(`| exhaustionRate | ${DEFAULT_INTERNAL_DRIVE_CONFIG.exhaustionRate} |`);
  lines.push('');

  // Per-stream tables
  lines.push('## Per-Stream Results');
  lines.push('');

  for (const m of metrics) {
    lines.push(`### ${m.label} — \`${m.streamId}\``);
    lines.push('');
    lines.push(`Duration: ${m.durationMin.toFixed(0)} min`);
    lines.push('');
    lines.push('| Metric | Value | Target | Status |');
    lines.push('|--------|-------|--------|--------|');
    lines.push(`| Transitions/hour | ${m.transitionsPerHour.toFixed(1)} | 3-10 | ${passOrFail(m.transitionsPerHour >= 3 && m.transitionsPerHour <= 10)} |`);
    lines.push(`| Thrash ratio | ${formatPct(m.thrashRatio)} | < 10% | ${passOrFail(m.thrashRatio < 0.1)} |`);
    lines.push(`| Median response time | ${formatTime(m.medianResponseTimeMs)} | 1-3 min | ${passOrFail(m.medianResponseTimeMs >= 60000 && m.medianResponseTimeMs <= 180000)} |`);
    lines.push(`| Energy min | ${m.energyMin.toFixed(2)} | — | — |`);
    lines.push(`| Energy max | ${m.energyMax.toFixed(2)} | — | — |`);
    lines.push(`| Energy mean | ${m.energyMean.toFixed(2)} | — | — |`);
    lines.push(`| Energy crosses 0.3 | ${passOrFail(m.energyCrosses03)} | Yes | ${passOrFail(m.energyCrosses03)} |`);
    lines.push(`| Partying reached | ${passOrFail(m.partyingReached)} | Yes (large/bursty) | — |`);
    lines.push(`| Partying sustained 45s | ${passOrFail(m.partyingSustained45s)} | Yes (large/bursty) | — |`);
    lines.push(`| Baseline tracks mean | ${passOrFail(m.baselineTracking.withinOneSigma)} | Within 1σ | ${passOrFail(m.baselineTracking.withinOneSigma)} |`);
    lines.push('');

    lines.push('Time-in-state distribution:');
    lines.push('');
    lines.push('| State | % Time |');
    lines.push('|-------|--------|');
    for (const [state, ratio] of Object.entries(m.timeInState)) {
      lines.push(`| ${state} | ${formatPct(ratio)} |`);
    }
    lines.push('');
  }

  // Overall summary
  lines.push('## Summary');
  lines.push('');

  const avgTransPerHour = metrics.reduce((s, m) => s + m.transitionsPerHour, 0) / metrics.length;
  const avgThrash = metrics.reduce((s, m) => s + m.thrashRatio, 0) / metrics.length;
  const responseTimes = metrics.map(m => m.medianResponseTimeMs).filter(t => t > 0);
  const overallMedianResponse = median(responseTimes);
  const anyPartying = metrics.some(m => m.partyingReached);
  const allBaselineTrack = metrics.every(m => m.baselineTracking.withinOneSigma);

  lines.push('| Metric | Aggregate | Target | Status |');
  lines.push('|--------|-----------|--------|--------|');
  lines.push(`| Avg transitions/hour | ${avgTransPerHour.toFixed(1)} | 3-10 | ${passOrFail(avgTransPerHour >= 3 && avgTransPerHour <= 10)} |`);
  lines.push(`| Avg thrash ratio | ${formatPct(avgThrash)} | < 10% | ${passOrFail(avgThrash < 0.1)} |`);
  lines.push(`| Median response time | ${formatTime(overallMedianResponse)} | 1-3 min | ${passOrFail(overallMedianResponse >= 60000 && overallMedianResponse <= 180000)} |`);
  lines.push(`| Partying reachable | ${passOrFail(anyPartying)} | Yes | ${passOrFail(anyPartying)} |`);
  lines.push(`| Baseline tracking | ${passOrFail(allBaselineTrack)} | All within 1σ | ${passOrFail(allBaselineTrack)} |`);
  lines.push('');

  // Recommendations
  lines.push('## Recommendations');
  lines.push('');

  if (avgTransPerHour < 3) {
    lines.push('- **Too few transitions**: Consider lowering hold times or energy thresholds to make the system more responsive.');
  } else if (avgTransPerHour > 10) {
    lines.push('- **Too many transitions**: Consider increasing hold times to add more hysteresis.');
  }

  if (avgThrash >= 0.1) {
    lines.push('- **High thrash ratio**: States are changing too quickly. Increase hold times or add wider hysteresis gaps between up/down thresholds.');
  }

  if (overallMedianResponse > 180000) {
    lines.push('- **Slow response**: The system is too sluggish reacting to activity spikes. Consider increasing energyAlpha or reducing hold times.');
  } else if (overallMedianResponse > 0 && overallMedianResponse < 60000) {
    lines.push('- **Too fast response**: The system may be over-reacting to noise. Consider decreasing energyAlpha or increasing hold times.');
  }

  if (!anyPartying) {
    lines.push('- **Partying never reached**: Energy never sustains above 1.0 long enough. This is expected with chat-only data (no highValueEvents). Consider whether the threshold should be lowered or if sub/bit events are required.');
  }

  if (!allBaselineTrack) {
    lines.push('- **Baseline drift**: Baseline is not converging to mean activity for some streams. Consider adjusting baselineAlpha.');
  }

  const allPass = avgTransPerHour >= 3 && avgTransPerHour <= 10 &&
    avgThrash < 0.1 &&
    (overallMedianResponse === 0 || (overallMedianResponse >= 60000 && overallMedianResponse <= 180000)) &&
    allBaselineTrack;

  if (allPass) {
    lines.push('- All aggregate metrics pass. Current config looks good for shipping.');
  }

  lines.push('');

  return lines.join('\n');
}

function main(): void {
  if (!existsSync(TELEMETRY_DIR)) {
    console.error(`Telemetry directory not found: ${TELEMETRY_DIR}`);
    console.error('Run simulate.ts first.');
    process.exit(1);
  }

  // Load selected streams for labels
  let labels: Record<string, string> = {};
  if (existsSync(SELECTED_PATH)) {
    const selected: Record<string, { stream_id: string }> =
      JSON.parse(readFileSync(SELECTED_PATH, 'utf-8'));
    for (const [label, info] of Object.entries(selected)) {
      labels[info.stream_id] = label;
    }
  }

  const csvFiles = readdirSync(TELEMETRY_DIR).filter(f => f.endsWith('.csv'));
  if (csvFiles.length === 0) {
    console.error('No telemetry CSVs found. Run simulate.ts first.');
    process.exit(1);
  }

  console.log(`Analyzing ${csvFiles.length} telemetry files...\n`);

  const allMetrics: StreamMetrics[] = [];

  for (const csvFile of csvFiles) {
    const streamId = basename(csvFile, '.csv');
    const label = labels[streamId] || streamId;
    const rows = parseTelemetryCsv(join(TELEMETRY_DIR, csvFile));

    if (rows.length === 0) {
      console.warn(`  SKIP ${streamId}: empty telemetry`);
      continue;
    }

    const metrics = analyzeStream(streamId, label, rows);
    allMetrics.push(metrics);

    console.log(`  [${label}] ${streamId}: ${metrics.transitionsPerHour.toFixed(1)} trans/hr, thrash=${formatPct(metrics.thrashRatio)}, response=${formatTime(metrics.medianResponseTimeMs)}`);
  }

  // Generate report
  mkdirSync(dirname(FINDINGS_PATH), { recursive: true });
  const report = generateReport(allMetrics);
  writeFileSync(FINDINGS_PATH, report);

  console.log(`\nFindings written to: ${FINDINGS_PATH}`);
}

main();
