import type { CliConfig, ProfileName, RuntimeState } from './types.js';
import { FULL_STREAM_SEQUENCE, resolveProfile, randInt, sampleChatters } from './profiles.js';
import { buildEvent, sendEvent } from './sender.js';
import { fetchTelemetry } from './telemetry.js';
import { render } from './display.js';

const TICK_MS = 10_000;
const SPEED_STEPS = [1, 2, 5, 10, 50];

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseArgs(): CliConfig {
  const args = process.argv.slice(2);
  const config: CliConfig = {
    url: 'http://localhost:8787',
    streamerId: 'sim-streamer-1',
    profile: 'steady',
    speed: 1,
    telemetry: true,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--url':
        config.url = args[++i];
        break;
      case '--streamer-id':
        config.streamerId = args[++i];
        break;
      case '--profile':
        config.profile = args[++i] as ProfileName;
        break;
      case '--speed':
        config.speed = Number(args[++i]);
        break;
      case '--no-telemetry':
        config.telemetry = false;
        break;
      case '--help':
        console.log(`
  pnpm simulate [options]

    --url <url>          Worker URL (default: http://localhost:8787)
    --streamer-id <id>   Target streamer (default: sim-streamer-1)
    --profile <name>     Starting profile: dead-chat|steady|hype|raid|full-stream (default: steady)
    --speed <n>          Speed multiplier (default: 1)
    --no-telemetry       Disable telemetry display
    --help               Show this help
`);
        process.exit(0);
    }
  }

  return config;
}

// ---------------------------------------------------------------------------
// Keyboard input
// ---------------------------------------------------------------------------

function setupKeyboard(state: RuntimeState): void {
  if (!process.stdin.isTTY) return;

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  process.stdin.on('data', (key: string) => {
    switch (key) {
      case '1': state.profile = 'dead-chat'; break;
      case '2': state.profile = 'steady'; break;
      case '3': state.profile = 'hype'; break;
      case '4': state.profile = 'raid'; break;
      case '0':
        state.profile = 'full-stream';
        state.fullStreamPhaseIndex = 0;
        state.fullStreamTicksRemaining = FULL_STREAM_SEQUENCE[0].ticks;
        break;
      case '+':
      case '=': {
        const idx = SPEED_STEPS.indexOf(state.speed);
        if (idx < SPEED_STEPS.length - 1) state.speed = SPEED_STEPS[idx + 1];
        break;
      }
      case '-': {
        const idx = SPEED_STEPS.indexOf(state.speed);
        if (idx > 0) state.speed = SPEED_STEPS[idx - 1];
        else if (idx === -1) state.speed = SPEED_STEPS[0];
        break;
      }
      case 't': state.showTelemetry = !state.showTelemetry; break;
      case 'p': state.paused = !state.paused; break;
      case 'q':
      case '\x03': // Ctrl+C
        state.running = false;
        break;
    }
  });
}

// ---------------------------------------------------------------------------
// Tick execution
// ---------------------------------------------------------------------------

async function executeTick(
  state: RuntimeState,
  url: string,
  streamerId: string
): Promise<void> {
  const profile = resolveProfile(state.profile, state.fullStreamPhaseIndex);
  const msgCount = randInt(profile.msgsMin, profile.msgsMax);
  const chatterCount = randInt(profile.chattersMin, profile.chattersMax);
  const chatters = sampleChatters(Math.max(chatterCount, msgCount > 0 ? 1 : 0));

  state.stats.tick++;
  state.stats.msgsThisTick = msgCount;
  state.stats.chattersThisTick = chatters.length;
  state.stats.hvThisTick = 0;

  // Build events for this tick
  const events: { payload: object; delayMs: number }[] = [];
  const tickWindow = TICK_MS / state.speed;
  const staggerWindow = tickWindow * 0.8;

  for (let i = 0; i < msgCount; i++) {
    const chatter = chatters[Math.floor(Math.random() * chatters.length)];
    const isHv = Math.random() < profile.hvChance;
    if (isHv) state.stats.hvThisTick++;
    const payload = buildEvent(streamerId, chatter, isHv, profile.name as Exclude<ProfileName, 'full-stream'>);
    events.push({ payload, delayMs: Math.random() * staggerWindow });
  }

  // Sort by delay and dispatch
  events.sort((a, b) => a.delayMs - b.delayMs);

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const prevDelay = i > 0 ? events[i - 1].delayMs : 0;
    const wait = event.delayMs - prevDelay;

    if (wait > 0) {
      await sleep(wait);
    }

    // Check if we should stop mid-tick
    if (!state.running) return;

    const result = await sendEvent(url, event.payload);
    state.stats.sent++;
    if (!result.ok) state.stats.errors++;
  }

  // Advance full-stream sequence
  if (state.profile === 'full-stream') {
    state.fullStreamTicksRemaining--;
    if (state.fullStreamTicksRemaining <= 0) {
      state.fullStreamPhaseIndex++;
      if (state.fullStreamPhaseIndex >= FULL_STREAM_SEQUENCE.length) {
        // Sequence complete — loop back
        state.fullStreamPhaseIndex = 0;
      }
      state.fullStreamTicksRemaining = FULL_STREAM_SEQUENCE[state.fullStreamPhaseIndex].ticks;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const config = parseArgs();

  const state: RuntimeState = {
    profile: config.profile,
    speed: config.speed,
    paused: false,
    showTelemetry: config.telemetry,
    running: true,
    stats: { tick: 0, sent: 0, errors: 0, msgsThisTick: 0, chattersThisTick: 0, hvThisTick: 0 },
    telemetry: null,
    fullStreamPhaseIndex: 0,
    fullStreamTicksRemaining: config.profile === 'full-stream' ? FULL_STREAM_SEQUENCE[0].ticks : 0,
  };

  setupKeyboard(state);

  // Graceful shutdown
  const cleanup = () => {
    state.running = false;
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdout.write('\x1b[?25h'); // Show cursor
    console.log('\nSimulator stopped.');
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Hide cursor
  process.stdout.write('\x1b[?25l');

  // Initial render
  render(state, config.url, config.streamerId);

  while (state.running) {
    if (state.paused) {
      render(state, config.url, config.streamerId);
      await sleep(200);
      continue;
    }

    // Execute tick
    await executeTick(state, config.url, config.streamerId);

    // Fetch telemetry if enabled
    if (state.showTelemetry) {
      state.telemetry = await fetchTelemetry(config.url, config.streamerId);
    }

    // Render
    render(state, config.url, config.streamerId);

    // Wait for remaining tick time
    // Events were already staggered across 80% of the tick, so wait for the remaining 20%
    const remainingMs = (TICK_MS / state.speed) * 0.2;
    await sleep(remainingMs);
  }

  cleanup();
}

main();
