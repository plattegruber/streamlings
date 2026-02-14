# Plan: Add offline/between-streams state to mood system

**Issue:** [#3 — Add offline/between-streams state to mood system](https://github.com/plattegruber/streamlings/issues/3)

## Problem

The mood system has no awareness of stream lifecycle. When a stream ends, the Streamling slowly drifts toward sleep through natural pressure instead of responding to an explicit offline signal. When the streamer goes live again, the Streamling wakes with stale drive values (accumulated sleep pressure, leftover exhaustion, etc.) that weren't reset between sessions.

## Approach

Add `stream.online` and `stream.offline` as lifecycle events handled by dedicated methods on the Durable Object—not routed through the normal `incrementEvent` activity-tracking path. These events trigger immediate, forced state transitions that bypass the normal hysteresis hold times, since "the stream ended" is not an ambiguous signal that needs smoothing.

A `streamOnline` boolean is persisted to Durable Object storage so the system can distinguish "no events received yet" from "stream is offline."

## Changes by File

### 1. `packages/shared/types.ts`

- Add `streamOnline` field to `StreamlingTelemetry` interface so WebSocket consumers know stream status.

### 2. `apps/streamling-state/src/index.ts`

**New state:**
- Add `private streamOnline: boolean` field (default `false`), loaded from storage in `blockConcurrencyWhile`.

**New lifecycle methods on the Durable Object:**

- `handleStreamOnline(now: number)`: Sets `streamOnline = true`. Resets energy state to initial (`createInitialEnergyState()`). Resets mood state to fresh Idle (`createInitialMoodState()`). Resets tick counters. Persists all state. Logs the transition.
- `handleStreamOffline(now: number)`: Sets `streamOnline = false`. Forces mood to `MoodState.Sleeping` immediately (sets `currentState`, `stateEnteredAt`, resets `transitionConditionMetAt`, zeroes drives). Resets energy state to initial. Persists all state. Logs the transition.

**Updated webhook handler (`POST /webhook`):**
- Before the generic `incrementEvent` path, check if `eventType` is `stream.online` or `stream.offline`.
- Route to the appropriate lifecycle method. Return a JSON response with the current telemetry (so callers can see the immediate state change).
- These events still get counted via `incrementEvent` for observability, but the lifecycle method runs first to force the state transition.

**Updated `getTelemetry()`:**
- Include `streamOnline` in the returned `StreamlingTelemetry`.

**Updated `EVENT_CATEGORIES`:**
- Add a `LIFECYCLE` category: `['stream.online', 'stream.offline']`. These are tracked in event counts but do NOT contribute to activity metrics (no weight in the energy calculation). They are signals, not activity.

### 3. `apps/streamling-state/src/mood.test.ts`

Add a new `describe('Stream Lifecycle Transitions')` block:

- **`stream.offline` forces Sleeping from any state**: Test that when `handleStreamOffline` is called, the mood transitions to Sleeping regardless of current state (Idle, Engaged, Partying). Verify drives are zeroed.
- **`stream.online` resets to Idle with fresh drives**: Test that `handleStreamOnline` produces an Idle state with `restedness: 1.0`, `sleepPressure: 0`, `exhaustion: 0`, `curiosity: 0`.
- **Drives are fresh after online→offline→online cycle**: Accumulate some drive state, go offline, come back online, verify all drives are at their initial values.
- **Energy resets on stream.online**: Verify energy state is re-initialized (baseline, history, etc. all zeroed).

### 4. `apps/streamling-state/src/index.test.ts`

Add integration tests in a new `describe('Stream Lifecycle')` block:

- **`stream.offline` via webhook sets Sleeping**: POST a `stream.offline` event, then GET `/telemetry` and verify `mood.currentState === 'sleeping'` and `streamOnline === false`.
- **`stream.online` via webhook sets Idle with fresh state**: POST a `stream.online` event, then GET `/telemetry` and verify `mood.currentState === 'idle'`, drives are reset, and `streamOnline === true`.
- **Full cycle: online → activity → offline → online**: Go online, send some chat events, go offline (verify sleeping), go online again (verify idle with reset drives).

### 5. `apps/streamling-state/scripts/send-stream-lifecycle.sh`

New test script for local dev:

```bash
#!/bin/bash
# Simulate stream going online, some activity, then offline
echo "📡 Sending stream.online..."
curl -s -X POST http://localhost:8787/webhook \
  -H "Content-Type: application/json" \
  -d '{"subscription":{"type":"stream.online"},"event":{"type":"live"}}'
echo ""
echo "⏳ Waiting 5 seconds..."
sleep 5
echo "📡 Sending stream.offline..."
curl -s -X POST http://localhost:8787/webhook \
  -H "Content-Type: application/json" \
  -d '{"subscription":{"type":"stream.offline"},"event":{}}'
echo ""
echo "✅ Check telemetry: curl http://localhost:8787/telemetry"
```

- Add `"test:lifecycle": "./scripts/send-stream-lifecycle.sh"` to `package.json` scripts.

## Design Decisions

1. **Lifecycle events bypass hysteresis.** `stream.offline` immediately forces Sleeping; `stream.online` immediately forces Idle. These are authoritative signals from the platform, not noisy activity that needs smoothing. The philosophy doc says "slow over fast" for normal mood transitions, but stream lifecycle is a discrete event, not a gradient.

2. **Energy resets on both transitions.** Stale activity history and baselines from a previous session would pollute the energy calculation in the new session. Starting fresh means the Streamling's first wakeup in a new stream is clean.

3. **Drives fully reset on `stream.online`.** The issue explicitly calls this out. Between streams, no drive accumulation matters. The Streamling starts each stream well-rested and fresh.

4. **`stream.offline` zeroes drives too.** While sleeping between streams, there's no meaningful drive accumulation happening (no ticks running meaningfully). Starting the offline state with clean drives prevents any weirdness if the alarm fires between streams.

5. **`streamOnline` is persisted and exposed in telemetry.** This lets the frontend distinguish "sleeping because the stream ended" from "sleeping because it's a quiet period mid-stream." The issue calls for persisting stream state.

6. **Lifecycle events are counted but don't affect activity metrics.** They appear in event counts for observability but have zero weight in the energy calculation. A `stream.online` event shouldn't spike the energy signal.

## Out of Scope (per issue)

- Twitch adapter changes (it already forwards `stream.online`/`stream.offline`)
- UI display of stream status
- Stopping/starting the alarm tick based on stream status (the alarm continues ticking; it just operates on the reset state)

## Acceptance Criteria Mapping

| Criteria | Implementation |
|----------|---------------|
| `stream.offline` triggers Sleeping | `handleStreamOffline` forces `MoodState.Sleeping` |
| `stream.online` resets drives and triggers Idle | `handleStreamOnline` calls `createInitialMoodState()` |
| Drives remain fresh across sessions | Full reset on `stream.online`; zeroed on `stream.offline` |
| Tests validate transitions and reset | Unit tests in `mood.test.ts`, integration tests in `index.test.ts` |
| Local testing scripts available | `send-stream-lifecycle.sh` + `pnpm test:lifecycle` |
