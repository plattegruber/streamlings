# Plan: Forward stream online/offline events from Twitch adapter

**Issue**: [#5 — Forward stream online/offline events from Twitch adapter](https://github.com/plattegruber/streamlings/issues/5)
**Branch**: `claude/plan-issue-5-87znE`

## Problem

The Twitch adapter needs explicit support for `stream.online` and `stream.offline` EventSub event types. These stream lifecycle events differ from chat and subscription events: there is no "chatting user" — the `broadcaster_user_id` is the primary identifier. The adapter needs tested, documented support for these events with manual test scripts.

## Analysis

### Current state

- The adapter (`apps/twitch-eventsub/src/index.ts`) generically forwards all EventSub notifications to `streamling-state`. It extracts user IDs via a fallback chain: `user_id → broadcaster_user_id → to_broadcaster_user_id → 'default_user'`. This already handles stream events correctly since they use `broadcaster_user_id`.
- The state worker (`apps/streamling-state/src/index.ts`) accepts any event type via `/webhook` and counts it. Stream events are not in `EVENT_CATEGORIES` (MESSAGE or HIGH_VALUE), so they are counted but do not affect energy/activity metrics. This is correct — stream lifecycle events are not activity events.
- The `send-random-event.sh` script already includes `stream.online` and `stream.offline` in its random event list, but there are no dedicated scripts.
- The adapter has `"test": "vitest run"` in package.json but no test files exist.

### Twitch EventSub payload shapes

**`stream.online`**:
```json
{
  "subscription": { "type": "stream.online" },
  "event": {
    "broadcaster_user_id": "1337",
    "broadcaster_user_login": "cool_user",
    "broadcaster_user_name": "Cool_User",
    "type": "live",
    "started_at": "2020-10-11T10:11:12.123Z"
  }
}
```

**`stream.offline`**:
```json
{
  "subscription": { "type": "stream.offline" },
  "event": {
    "broadcaster_user_id": "1337",
    "broadcaster_user_login": "cool_user",
    "broadcaster_user_name": "Cool_User"
  }
}
```

Key difference from chat events: no `user_id` field. The `broadcaster_user_id` serves as the primary identifier.

## Implementation Steps

### Step 1: Add integration tests for stream events in streamling-state

**File**: `apps/streamling-state/src/index.test.ts` (modify)

Add test cases to the existing integration test suite that send `stream.online` and `stream.offline` events directly to the `/webhook` endpoint and verify:
- Events are accepted with 200 response
- Event counts are incremented correctly for each event type
- Both event types can coexist with existing chat/subscription event counts

This follows the project convention: "Worker tests use Wrangler's `unstable_dev` to run against real Durable Objects."

### Step 2: Add adapter integration tests

**File**: `apps/twitch-eventsub/src/index.test.ts` (new)

Create tests for the adapter using `unstable_dev` with a lightweight Node.js HTTP server as a mock streamling-state target. The mock captures forwarded payloads for assertion.

Tests:
- Challenge verification still works (baseline sanity)
- `stream.online` events are forwarded with `broadcaster_user_id` correctly extracted
- `stream.offline` events are forwarded with `broadcaster_user_id` correctly extracted
- The forwarded payload includes `internal_user_id` and `twitch_user_id` derived from `broadcaster_user_id`
- Returns 404 for non-webhook paths
- Returns 400 for invalid payloads
- Returns 405 for unsupported HTTP methods

The mock server approach keeps tests isolated — no need to start the real streamling-state worker.

### Step 3: Add manual test scripts

**File**: `apps/twitch-eventsub/scripts/send-online-event.sh` (new)

```bash
#!/bin/bash
echo "📡 Sending: stream.online to Twitch EventSub adapter (port 8788)"
twitch event trigger stream.online -F http://localhost:8788/webhook
```

**File**: `apps/twitch-eventsub/scripts/send-offline-event.sh` (new)

```bash
#!/bin/bash
echo "📡 Sending: stream.offline to Twitch EventSub adapter (port 8788)"
twitch event trigger stream.offline -F http://localhost:8788/webhook
```

### Step 4: Add NPM scripts

**File**: `apps/twitch-eventsub/package.json` (modify)

Add:
- `"test:online": "./scripts/send-online-event.sh"`
- `"test:offline": "./scripts/send-offline-event.sh"`

### Step 5: Update adapter README

**File**: `apps/twitch-eventsub/README.md` (modify)

Add a "Supported Event Types" section documenting all handled event types organized by category:
- **Chat**: `channel.chat.message`
- **Subscriptions**: `channel.subscribe`, `channel.subscription.gift`, `channel.subscription.message`
- **Engagement**: `channel.cheer`, `channel.raid`
- **Stream lifecycle**: `stream.online`, `stream.offline` — note that these use `broadcaster_user_id` as the primary identifier

Add usage examples for the new `test:online` and `test:offline` scripts in the testing section.

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `apps/streamling-state/src/index.test.ts` | Modify | Add stream.online/offline integration tests |
| `apps/twitch-eventsub/src/index.test.ts` | Create | Adapter integration tests with mock server |
| `apps/twitch-eventsub/scripts/send-online-event.sh` | Create | Manual test script for stream.online |
| `apps/twitch-eventsub/scripts/send-offline-event.sh` | Create | Manual test script for stream.offline |
| `apps/twitch-eventsub/package.json` | Modify | Add test:online and test:offline scripts |
| `apps/twitch-eventsub/README.md` | Modify | Document supported event types and new scripts |

## Design Decisions

- **No new event category in streamling-state**: Stream lifecycle events are not activity events. They should be counted but not affect energy/mood metrics. A future issue can add lifecycle handling (e.g., transitioning to sleeping on `stream.offline`).
- **No adapter code changes needed**: The adapter's generic forwarding and fallback-based user ID extraction already handle stream events correctly. Adding special-case code would violate the "adapters are thin" principle.
- **Mock server for adapter tests**: A lightweight Node.js HTTP server in tests verifies the adapter's forwarding behavior in isolation without cross-worker dependencies.

## Testing Strategy

1. **Automated**: `pnpm -r test` from root executes both test suites. CI picks this up via existing `test.yml` workflow.
2. **Manual**: Start both workers (`pnpm dev`), then run `pnpm test:online` and `pnpm test:offline` from `apps/twitch-eventsub` to verify end-to-end forwarding.

## Out of Scope

- Stream lifecycle handling in mood/energy system (e.g., forcing sleep on stream.offline) — separate feature
- EventSub subscription management (handled outside this codebase via Twitch API)
