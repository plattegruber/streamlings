# Implementation Guidance

Technical opinions and conventions for working in the Streamlings codebase. These are decisions we've made — follow them for consistency.

## Architecture Opinions

### Durable Objects Are the Source of Truth

All Streamling state lives in the Durable Object. The D1 database in the web app is for user/account data, not for Streamling runtime state. Don't duplicate state between the two — the web app should read Streamling state by calling the worker's `/telemetry` endpoint, not by maintaining a parallel copy.

### Adapters Are Thin

Platform adapters (like `twitch-eventsub`) should do three things: verify the incoming webhook, extract a normalized event, and forward it. No business logic, no state, no configuration. If you're writing an `if` statement about mood or energy in an adapter, it belongs in `streamling-state` instead.

### Shared Types Are the Contract

The `packages/shared` types define the boundary between systems. When adding a new event type or changing the telemetry shape, update the shared types first, then update the producers and consumers. Don't use `any` or inline type definitions to bypass the shared contract.

### Workers Over Traditional Servers

We deploy on Cloudflare. Workers and Durable Objects are the compute model. Don't introduce patterns that assume long-lived server processes, in-memory caches that survive requests, or filesystem access. Everything persists through Durable Object storage or D1.

## Code Conventions

### TypeScript

- Strict mode, no `any` at module boundaries (internal `any` for Cloudflare SDK quirks is acceptable with a comment)
- Prefer `interface` over `type` for object shapes that might be extended
- Use the shared types package — don't redeclare types locally
- Enum values are lowercase strings (`'sleeping'`, not `'SLEEPING'` or `0`)

### State Management

- All state mutations in the Durable Object go through named methods (`incrementEvent`, `updateConfig`), not direct storage writes from the HTTP handler
- Persist state immediately after mutation — don't batch or defer writes
- Use `blockConcurrencyWhile` for initialization, not for regular operations

### Energy and Mood System

- The energy system uses EMA (exponential moving average) for smoothing. Don't replace this with simple averages or windowed means — the EMA's decay properties are load-bearing for the feel of the system
- The mood state machine uses hysteresis (hold times). Every transition requires sustained conditions, not instantaneous threshold crossings. This is intentional and should not be "optimized" away
- Internal drives (sleep pressure, exhaustion, etc.) exist to create autonomous behavior independent of chat activity. They make the Streamling feel alive during quiet periods. Preserve their influence in any mood system changes
- Default configuration values are tuned for real stream conditions. Change them with care and test with simulated event streams

### Testing

- Worker tests use Wrangler's `unstable_dev` to run against real Durable Objects. Don't mock the Durable Object layer — the integration test is the point
- Energy and mood unit tests verify mathematical properties (EMA convergence, state transition correctness). Keep these fast and deterministic by using fixed timestamps
- New event types need both a unit test (does the counter increment?) and a check that the activity category mapping is correct (message vs. high-value)
- Web app tests are currently minimal. New UI features should include Vitest component tests at minimum

### Frontend (SvelteKit)

- Svelte 5 with runes — use `$state`, `$derived`, `$effect` instead of Svelte 4 stores
- TailwindCSS v4 for styling — no CSS modules, no styled-components, no inline style objects
- Use SvelteKit's `+page.server.ts` for data loading, not client-side fetches in `onMount`
- Clerk handles auth — don't build custom auth flows

### Database (Drizzle + D1)

- Schema lives in `apps/web/src/lib/server/db/schema.js`
- Use Drizzle's query builder, not raw SQL
- Migrations via `pnpm db:generate` and `pnpm db:migrate` — don't manually write migration files
- D1 in production, libSQL locally — the client initialization in `db/index.js` handles this split

## Adding New Features

### Adding a New Platform Adapter

1. Create a new app in `apps/` (e.g., `apps/youtube-adapter`)
2. Handle webhook verification per the platform's spec
3. Extract user ID and event type from the platform payload
4. Map the event to one of the existing activity categories (message, high-value) or propose a new category in the shared types
5. Forward to `streamling-state` via its `/webhook` endpoint
6. Add wrangler.toml with `STREAMLING_STATE_URL` binding
7. Add the adapter to the CI deploy pipeline

### Adding a New Mood State

1. Add the state to `MoodState` enum in `packages/shared/types.ts`
2. Define transitions to/from adjacent states in `mood.ts`
3. Add threshold and hold time config to `MoodTransitionConfig`
4. Update `getNextState` to include the new state in the transition graph
5. Add tests for every new transition path
6. Update default config values with tuned thresholds

### Adding a New Event Type

1. Add the event type string to `EVENT_CATEGORIES` in `streamling-state/src/index.ts`
2. If it's a new category (not message or high-value), add a new weight to `EnergyConfig` and update `calculateRawActivity`
3. Update the shared types if the event payload shape needs to be typed
4. Add the event type to the adapter that produces it
5. Test with `pnpm test:event` or a custom script

## Performance Considerations

- Durable Object alarms tick every 10 seconds. This is the resolution of the energy/mood system. Don't reduce the tick rate below 5 seconds — the EMA alphas are tuned for the current rate
- Activity history is bounded by `stdDevWindowSize` (default 60 samples = 10 minutes). This prevents unbounded memory growth
- Event counts are persisted on every event. If this becomes a bottleneck at scale, consider batching writes within a tick window, but measure first
- The web app should poll `/telemetry` at a reasonable interval (every few seconds), not on every render frame. Use SSE or WebSockets if real-time updates become a requirement
