# Review Guidelines

These are the conventions that matter during code review. Flag violations of these rules; ignore stylistic preferences not listed here.

## Architecture

- **Adapters are thin.** Platform adapters (e.g. `twitch-eventsub`) verify the webhook, extract a normalized event, and forward it. No business logic, no state, no configuration. If there's an `if` about mood or energy in an adapter, it belongs in `streamling-state`.
- **Durable Objects are the source of truth.** All Streamling runtime state lives in the Durable Object. The D1 database is for user/account data only. Don't duplicate state between the two.
- **Shared types are the contract.** The `packages/shared` types define boundaries between systems. When an event type or telemetry shape changes, shared types must be updated first, then producers and consumers. No `any` or inline types to bypass the contract.
- **Workers over servers.** No patterns that assume long-lived processes, in-memory caches surviving requests, or filesystem access. Everything persists through Durable Object storage or D1.
- **Platform-agnostic core.** The state engine knows nothing about Twitch, YouTube, or any specific platform. Platform-specific logic belongs in adapters, never in core.

## Code Conventions

- TypeScript strict mode. No `any` at module boundaries (internal `any` for Cloudflare SDK quirks is acceptable with a comment).
- Prefer `interface` over `type` for object shapes that might be extended.
- Enum values are lowercase strings (`'sleeping'`, not `'SLEEPING'` or `0`).
- Svelte 5 runes (`$state`, `$derived`, `$effect`) — not Svelte 4 stores.
- TailwindCSS v4 for styling — no CSS modules, styled-components, or inline style objects.
- SvelteKit `+page.server.ts` for data loading — not client-side fetches in `onMount`.
- Drizzle query builder — no raw SQL. Migrations via `pnpm db:generate` and `pnpm db:migrate`.

## State System Invariants

- **EMA smoothing is load-bearing.** The energy system uses exponential moving averages. Don't replace with simple averages or windowed means — the decay properties are intentional.
- **Hysteresis is intentional.** The mood state machine uses hold times. Every transition requires sustained conditions, not instantaneous threshold crossings. Don't "optimize" this away.
- **Internal drives matter.** Sleep pressure, exhaustion, etc. create autonomous behavior during quiet periods. Preserve their influence in any mood system changes.
- **State mutations through named methods.** `incrementEvent`, `updateConfig`, etc. — not direct storage writes from HTTP handlers.
- **Immediate persistence.** Persist state after mutation. Don't batch or defer writes.

## Testing

- Worker tests use Wrangler's `unstable_dev` against real Durable Objects. Don't mock the Durable Object layer.
- Energy/mood unit tests use fixed timestamps for determinism.
- New event types need a unit test (counter increments) and a category mapping test (message vs. high-value).
- New UI features need Vitest component tests at minimum.

## Vertical Slice Completeness

Every feature PR should satisfy:

- `pnpm dev` still works and the feature is exercisable locally
- Tests exist (unit for logic, integration for worker endpoints, component for UI)
- Shared types updated if an API or config shape changed
- New endpoints or scripts documented in CLAUDE.md or relevant README
- `.env.example` updated if new environment variables are introduced
- CI passes (tests, typecheck, lint)
