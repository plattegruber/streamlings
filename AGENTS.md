# Repository Guidelines

## Project Structure & Module Organization
This monorepo uses `pnpm` workspaces. Runtime workers live in `apps/streamling-state` (Durable Object core) and `apps/twitch-eventsub` (EventSub adapter). The SvelteKit dashboard is in `apps/web`. Shared types and utilities belong in `packages/shared`. Keep integration assets, scripts, and wrangler configs within their respective app directories to avoid cross-app coupling.

## Build, Test & Development Commands
- `pnpm install`: bootstrap all workspaces.
- `pnpm dev`: run every workspace’s `dev` script in parallel; use `pnpm --filter @streamlings/streamling-state dev` (or `@streamlings/twitch-eventsub`, `web`) to focus on one app.
- `pnpm build`: dry-run deploy for workers and `vite build` for the web UI; mirrors CI deploy checks.
- `pnpm test`, `pnpm lint`, `pnpm typecheck`: execute the matching scripts across all packages; prefer `--filter` when iterating on a specific workspace.

## Coding Style & Naming Conventions
TypeScript (Workers) and Svelte (web) both target ES modules with 2-space indentation. Use Prettier and ESLint in the web app (`pnpm --filter web lint`) plus Wrangler type generation (`pnpm --filter @streamlings/streamling-state cf-typegen`) before committing. Name worker source files in `camelCase.ts`, Durable Object classes in `PascalCase`, and Svelte components as `ComponentName.svelte`. Co-locate scripts under `scripts/` with kebab-case filenames.

## Testing Guidelines
Workers rely on Vitest; run `pnpm --filter @streamlings/streamling-state test` or `@streamlings/twitch-eventsub test` for focused suites. The dashboard pairs Vitest unit tests with Playwright E2E (`pnpm --filter web test`). Place specs alongside code as `*.test.ts` (unit) or under `apps/web/tests/*.spec.ts` (E2E). New features should include coverage for state transitions and webhook flows; add mocked EventSub payloads under `scripts/` when expanding scenarios.

## Commit & Pull Request Guidelines
Follow the repository’s imperative, title-case commits (e.g. `Add Twitch follow burst script`). Keep subject lines ≤72 characters and describe the “what” first. PRs must explain behavior changes, reference related issues, and list manual test steps or screenshots for UI updates. Ensure `pnpm test` and `pnpm lint` pass locally before requesting review.

## Security & Configuration Tips
Worker secrets live in Cloudflare environments; never commit `.env` files. Set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in GitHub Actions before enabling deploy workflows. When developing locally, update `wrangler.toml` per app with scoped namespaces and run `wrangler secret put` for any new tokens. Keep simulated chat/event scripts using sanitized sample data only.
