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

## Vertical Slice Completeness (Highest Priority)

This is the most important review criterion — more important than any individual item above. Every PR must be a Walking Skeleton: a complete vertical slice where hitting "merge" delivers the feature end-to-end. No manual steps, no follow-up PRs for "the deployment part," no Slack messages explaining how to get it running.

### The Merge Rule

After merge, with zero manual intervention:

- The feature deploys to production (CI/CD handles build, deploy, migrations)
- Any engineer can `git pull && pnpm install && pnpm dev` and the feature works locally
- If new environment variables are required, the app fails fast at startup with a clear, actionable error (what's missing, what it's for, where to get it)

If a PR doesn't satisfy all three, it is incomplete. Flag it.

### Local Dev Is Part of the PR

- `pnpm dev` starts everything the feature needs. If the feature adds a new worker or adapter, the root dev command must include it.
- New features are exercisable locally without live platform connections. If the feature depends on external webhooks, a simulation script or test command that exercises the same code path must be included.
- Local database changes apply automatically — migrations run, schema pushes work, no manual `db:push` required after pulling.

### CI/CD Is Part of the PR

- If the feature introduces a new deployable (worker, adapter, page), the deployment pipeline is updated in the same PR — not "we'll add that later."
- Wrangler configs, GitHub Actions workflows, and deploy targets ship together with the code they deploy.
- Secrets needed for deployment are documented with setup instructions (but never committed). If a reviewer would need a new key, that's called out prominently.

### Docs Are Part of the PR

- CLAUDE.md is updated if architecture, commands, environment setup, or the dev workflow changed.
- `.env.example` is updated for any new environment variable, with a comment explaining its purpose.
- New endpoints, scripts, or dev commands are documented where engineers will find them.
- If the event flow or architecture diagram changed, update it.

### Missing Config Fails Gracefully

- New environment variables must be validated at startup. Missing required vars produce an immediate, clear error: `Missing TWITCH_CLIENT_ID — set it in .env (see .env.example).`
- Don't silently fall back to broken defaults. A clear crash is better than a mystery bug ten steps later.
- Optional variables (with safe defaults) should be documented as optional in `.env.example`.

### Completeness Checklist

Flag a PR as incomplete if any applicable item is missing:

- `pnpm dev` works and the feature is exercisable locally
- Tests exist (unit for logic, integration for worker endpoints, component for UI)
- Shared types updated if an API or config shape changed
- CI/CD pipeline updated if a new deployable was introduced
- CLAUDE.md or relevant README updated if architecture, commands, or setup changed
- `.env.example` updated with comments for any new environment variables
- Missing env vars produce a clear, actionable error message — not a silent failure
- CI passes (tests, typecheck, lint)
- No manual steps required post-merge (no hand-run deploys, migrations, or secret rotation)
