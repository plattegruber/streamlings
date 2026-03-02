import type { RuntimeState, ProfileName } from './types.js';
import { FULL_STREAM_SEQUENCE, resolveProfile } from './profiles.js';

const ESC = '\x1b[';
const CLEAR_SCREEN = `${ESC}2J${ESC}H`;
const DIM = `${ESC}2m`;
const BOLD = `${ESC}1m`;
const RESET = `${ESC}0m`;
const CYAN = `${ESC}36m`;
const GREEN = `${ESC}32m`;
const YELLOW = `${ESC}33m`;
const RED = `${ESC}31m`;

function moodColor(mood: string): string {
  switch (mood) {
    case 'sleeping': return DIM;
    case 'idle': return CYAN;
    case 'engaged': return GREEN;
    case 'partying': return YELLOW;
    default: return RESET;
  }
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function profileLabel(state: RuntimeState): string {
  if (state.profile === 'full-stream') {
    const phase = FULL_STREAM_SEQUENCE[state.fullStreamPhaseIndex];
    return `full-stream [${phase.profile}] (${state.fullStreamTicksRemaining} ticks left)`;
  }
  return state.profile;
}

export function render(state: RuntimeState, url: string, streamerId: string): void {
  const { stats } = state;
  const activeProfile = resolveProfile(state.profile, state.fullStreamPhaseIndex);
  const lines: string[] = [];

  lines.push('');
  lines.push(` ${BOLD}Streamling Simulator${RESET}${state.paused ? `  ${RED}[PAUSED]${RESET}` : ''}`);
  lines.push(` Target: ${CYAN}${url}${RESET}  Streamer: ${CYAN}${streamerId}${RESET}  Speed: ${BOLD}${state.speed}x${RESET}`);
  lines.push('');
  lines.push(` Profile: ${BOLD}${profileLabel(state)}${RESET}    Tick: ${stats.tick}    Sent: ${stats.sent}    Errors: ${stats.errors > 0 ? RED + stats.errors + RESET : '0'}`);
  lines.push(` Messages: ${stats.msgsThisTick}/tick  Chatters: ${stats.chattersThisTick}/tick  HV: ${stats.hvThisTick}`);

  if (state.showTelemetry && state.telemetry) {
    const t = state.telemetry;
    const mood = t.mood.currentState;
    lines.push('');
    lines.push(` Energy: ${BOLD}${t.energy.energy.toFixed(3)}${RESET}  Mood: ${moodColor(mood)}${mood}${RESET}  In state: ${formatDuration(t.mood.timeInState)}`);
    lines.push(` Drives — sleep: ${t.mood.drive.sleepPressure.toFixed(2)}  rest: ${t.mood.drive.restedness.toFixed(2)}  exhaust: ${t.mood.drive.exhaustion.toFixed(2)}  curiosity: ${t.mood.drive.curiosity.toFixed(2)}`);
  } else if (state.showTelemetry) {
    lines.push('');
    lines.push(` ${DIM}Telemetry: waiting for data...${RESET}`);
  }

  lines.push('');
  lines.push(` ${DIM}[1]${RESET} dead  ${DIM}[2]${RESET} steady  ${DIM}[3]${RESET} hype  ${DIM}[4]${RESET} raid  ${DIM}[0]${RESET} full-stream`);
  lines.push(` ${DIM}[+/-]${RESET} speed  ${DIM}[t]${RESET} telemetry  ${DIM}[p]${RESET} pause  ${DIM}[q]${RESET} quit`);
  lines.push('');

  process.stdout.write(CLEAR_SCREEN + lines.join('\n'));
}
