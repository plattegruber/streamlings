/**
 * Simulate the energy/mood system tick-by-tick against real Twitch chat data.
 *
 * Imports the actual updateEnergyState and updateMoodState functions and runs
 * them against preprocessed per-stream CSVs from the Harvard Dataverse dataset.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

import type { ActivityMetrics, EnergyState, MoodStateData } from '@streamlings/shared/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PREPROCESSED_DIR = join(ROOT, 'data', 'preprocessed');
const OUTPUT_DIR = join(ROOT, 'output', 'telemetry');
const SELECTED_PATH = join(PREPROCESSED_DIR, 'selected.json');

interface CsvRow {
  bucketIndex: number;
  timestampMs: number;
  messagesPerMin: number;
  uniqueChattersPerMin: number;
  highValueEventsPerMin: number;
}

function parseCsv(csvPath: string): CsvRow[] {
  const content = readFileSync(csvPath, 'utf-8');
  const lines = content.trim().split('\n');
  const rows: CsvRow[] = [];

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    rows.push({
      bucketIndex: parseInt(cols[0], 10),
      timestampMs: parseInt(cols[1], 10),
      messagesPerMin: parseFloat(cols[2]),
      uniqueChattersPerMin: parseFloat(cols[3]),
      highValueEventsPerMin: parseFloat(cols[4]),
    });
  }

  return rows;
}

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

function simulateStream(streamId: string, csvPath: string): TelemetryRow[] {
  const rows = parseCsv(csvPath);
  if (rows.length === 0) return [];

  // Use a synthetic epoch — the CSV timestamps are offsets from stream start
  const epoch = 0;

  let energyState: EnergyState = {
    ...createInitialEnergyState(),
    lastUpdate: epoch,
  };

  let moodState: MoodStateData = {
    ...createInitialMoodState(),
    stateEnteredAt: epoch,
  };

  const telemetry: TelemetryRow[] = [];

  for (const row of rows) {
    const currentTime = epoch + row.timestampMs;

    const metrics: ActivityMetrics = {
      messagesPerMin: row.messagesPerMin,
      uniqueChattersPerMin: row.uniqueChattersPerMin,
      highValueEventsPerMin: row.highValueEventsPerMin,
      timestamp: currentTime,
    };

    energyState = updateEnergyState(energyState, metrics, DEFAULT_ENERGY_CONFIG);
    moodState = updateMoodState(
      moodState,
      energyState,
      DEFAULT_MOOD_TRANSITION_CONFIG,
      DEFAULT_INTERNAL_DRIVE_CONFIG,
      currentTime,
    );

    telemetry.push({
      tick: row.bucketIndex,
      timestamp_ms: row.timestampMs,
      messages_per_min: row.messagesPerMin,
      chatters_per_min: row.uniqueChattersPerMin,
      raw_activity: energyState.rawActivity,
      baseline: energyState.baseline,
      std_dev: energyState.stdDev,
      z_score: energyState.zScore,
      energy: energyState.energy,
      mood_state: moodState.currentState,
      time_in_state_ms: moodState.timeInState,
      sleep_pressure: moodState.drive.sleepPressure,
      restedness: moodState.drive.restedness,
      exhaustion: moodState.drive.exhaustion,
    });
  }

  return telemetry;
}

function writeTelemetryCsv(streamId: string, telemetry: TelemetryRow[]): void {
  const headers = [
    'tick', 'timestamp_ms', 'messages_per_min', 'chatters_per_min',
    'raw_activity', 'baseline', 'std_dev', 'z_score', 'energy',
    'mood_state', 'time_in_state_ms', 'sleep_pressure', 'restedness', 'exhaustion',
  ];

  const lines = [headers.join(',')];
  for (const row of telemetry) {
    lines.push([
      row.tick,
      row.timestamp_ms,
      row.messages_per_min.toFixed(2),
      row.chatters_per_min.toFixed(2),
      row.raw_activity.toFixed(4),
      row.baseline.toFixed(4),
      row.std_dev.toFixed(4),
      row.z_score.toFixed(4),
      row.energy.toFixed(4),
      row.mood_state,
      row.time_in_state_ms,
      row.sleep_pressure.toFixed(4),
      row.restedness.toFixed(4),
      row.exhaustion.toFixed(4),
    ].join(','));
  }

  const outPath = join(OUTPUT_DIR, `${streamId}.csv`);
  writeFileSync(outPath, lines.join('\n') + '\n');
  console.log(`  Written: ${outPath}`);
}

function main(): void {
  if (!existsSync(SELECTED_PATH)) {
    console.error(`Selected streams not found: ${SELECTED_PATH}`);
    console.error('Run: python3 scripts/select-streams.py');
    process.exit(1);
  }

  const selected: Record<string, { stream_id: string; csv_file: string }> =
    JSON.parse(readFileSync(SELECTED_PATH, 'utf-8'));

  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`Simulating ${Object.keys(selected).length} streams...\n`);
  console.log(`Energy config: baselineAlpha=${DEFAULT_ENERGY_CONFIG.baselineAlpha}, energyAlpha=${DEFAULT_ENERGY_CONFIG.energyAlpha}`);
  console.log(`Mood thresholds: idle→engaged=${DEFAULT_MOOD_TRANSITION_CONFIG.idleToEngagedEnergyThreshold}, engaged→partying=${DEFAULT_MOOD_TRANSITION_CONFIG.engagedToPartyingEnergyThreshold}\n`);

  for (const [label, stream] of Object.entries(selected)) {
    const csvPath = join(PREPROCESSED_DIR, stream.csv_file);
    if (!existsSync(csvPath)) {
      console.warn(`  SKIP ${label}: CSV not found at ${csvPath}`);
      continue;
    }

    console.log(`[${label}] ${stream.stream_id}`);
    const telemetry = simulateStream(stream.stream_id, csvPath);
    writeTelemetryCsv(stream.stream_id, telemetry);

    // Print quick summary
    const moods = telemetry.map(r => r.mood_state);
    let transitions = 0;
    for (let i = 1; i < moods.length; i++) {
      if (moods[i] !== moods[i - 1]) transitions++;
    }
    const durationMin = (telemetry[telemetry.length - 1]?.timestamp_ms ?? 0) / 60000;
    const transPerHour = durationMin > 0 ? (transitions / durationMin) * 60 : 0;
    const energies = telemetry.map(r => r.energy);
    const minE = Math.min(...energies);
    const maxE = Math.max(...energies);
    const avgE = energies.reduce((a, b) => a + b, 0) / energies.length;

    console.log(`    ${telemetry.length} ticks, ${durationMin.toFixed(0)} min, ${transitions} transitions (${transPerHour.toFixed(1)}/hr)`);
    console.log(`    Energy: min=${minE.toFixed(2)}, max=${maxE.toFixed(2)}, avg=${avgE.toFixed(2)}\n`);
  }

  console.log('Done. Run analyze.ts to compute metrics.');
}

main();
