# Plan: Add Event Simulation Script for Local Development (Issue #15)

## Context

The existing `test:burst` script sends ~30 seconds of events across 6 rounds. This isn't enough to exercise the energy/mood system's multi-minute hold times, EMA smoothing, and state transitions end-to-end. The simulation script needs to produce realistic activity patterns over longer durations that actually drive the Streamling through mood states (Idle → Engaged → Partying → cooldown).

Key timing constraints from the mood system:
- **Idle → Engaged**: energy > 0.5 sustained for 90 seconds
- **Engaged → Partying**: energy > 1.5 sustained for 2 minutes
- **Engaged → Idle**: energy < 0.3 sustained for 3 minutes
- **Tick rate**: 10 seconds (6 ticks/minute)
- **EMA alphas**: baseline 0.05, energy 0.02 — changes take several minutes to stabilize

## Implementation Steps

### Step 1: Create the simulation script

**File**: `apps/twitch-eventsub/scripts/simulate-stream.sh` (new)

A bash script (consistent with existing `send-burst-events.sh`, `send-chat-events.sh`, etc.) that runs four phases. Uses `curl` POSTs to `http://localhost:8788/webhook` with JSON payloads — same delivery mechanism as every other test script in this directory.

**Phases:**

1. **Quiet period** (~3 minutes real-time at 1x speed)
   - 1-2 chat messages per 10s tick window, 1 unique chatter
   - Purpose: establish a low baseline so the ramp-up registers as "above baseline" in the z-score calculation

2. **Ramp up** (~3 minutes real-time at 1x speed)
   - Gradually increase from 2-3 to 8-12 messages per tick window
   - Increase unique chatters from 2 to 6-8
   - Occasional high-value events (1 sub/cheer every ~30s)
   - Purpose: push energy above 0.5 threshold and sustain for 90s+ to trigger Idle → Engaged

3. **Hype event** (~3 minutes real-time at 1x speed)
   - 15-20 messages per tick window from 8-12 unique chatters
   - Frequent high-value events (subs, cheers, gift subs) every 10-15s
   - Purpose: spike energy above 1.5 and sustain for 2+ minutes to trigger Engaged → Partying

4. **Cool down** (~3 minutes real-time at 1x speed)
   - Rapidly taper messages from 15 → 5 → 2 → 0
   - No high-value events
   - Purpose: let energy decay, triggering Partying → Engaged → Idle transition

**Speed multiplier** (`--speed N` flag):
- Default: `--speed 1` (real-time, ~12 minutes total)
- Controls the `sleep` duration between event batches: `base_sleep / speed`
- At `--speed 10`, the full simulation runs in ~72 seconds
- At `--speed 100`, it's a quick smoke test (~7 seconds)
- Minimum sleep clamped to 0.05s to avoid overwhelming the local worker

**Console output**:
- Print phase name and progress on each round (follow the emoji pattern used in `send-burst-events.sh`)
- Print per-round stats (messages sent, unique chatters, high-value events)
- At the end, `curl` the `/telemetry` endpoint and pretty-print the final state

**Chatter simulation**:
- Maintain a pool of ~20 "regular" user IDs generated at script start
- Each round, pick a subset from the pool (simulates recurring chatters)
- Occasionally introduce new IDs (simulates new viewers joining)

### Step 2: Register the script in package.json

**File**: `apps/twitch-eventsub/package.json`

Add to the `scripts` section:
```json
"test:simulate": "./scripts/simulate-stream.sh"
```

### Step 3: Smoke test at `--speed 100`

The `--speed 100` flag compresses the entire simulation to ~7 seconds. Run it during development to verify the script completes without errors. No separate test file needed — the `--speed` flag IS the smoke test mechanism per the issue requirements.

### Step 4: Update documentation

**File**: `apps/twitch-eventsub/README.md`
- Add `pnpm test:simulate` to the testing commands section
- Briefly describe the four phases and the `--speed` flag

**File**: `CLAUDE.md`
- Add `pnpm test:simulate` to the Twitch EventSub Adapter commands section
- Add a note about the simulation in the Local Development Workflow section

## Files Changed

| File | Change |
|------|--------|
| `apps/twitch-eventsub/scripts/simulate-stream.sh` | **New** — four-phase simulation script with `--speed` flag |
| `apps/twitch-eventsub/package.json` | Add `test:simulate` script entry |
| `apps/twitch-eventsub/README.md` | Document `test:simulate` and simulation phases |
| `CLAUDE.md` | Add `test:simulate` to dev commands and workflow section |

## Out of Scope (per issue)

- Automated mood state assertions
- UI controls for the simulation
