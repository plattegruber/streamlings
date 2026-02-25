# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Required Reading

Before working on this codebase, read these companion documents:

- **[PHILOSOPHY.md](./PHILOSOPHY.md)** — Product vision, design principles, and what we are (and aren't) building
- **[IMPLEMENTATION.md](./IMPLEMENTATION.md)** — Technical opinions, code conventions, and guidance for adding features

## Project Overview

Streamlings is a multi-platform interactive pet that lives on stream and responds to chat - like a Tamagotchi powered by your audience. The project uses a pnpm workspace monorepo with a multi-worker architecture that supports multiple streaming platforms.

## Architecture

### Workspace Structure

**Platform Adapters** (receive platform-specific events):

- **apps/twitch-eventsub**: Twitch EventSub adapter (port 8788)
  - Receives Twitch EventSub webhooks
  - Maps Twitch user IDs → internal user IDs
  - Forwards events to StreamlingState worker
  - Handles EventSub challenge verification

**Core Workers**:

- **apps/streamling-state**: Platform-agnostic state management (port 8787)
  - Receives events from platform adapters
  - Uses Durable Objects (StreamlingState) for stateful storage
  - Tracks event counts and streamling state persistently
  - Exposes `/ws` WebSocket endpoint for real-time telemetry streaming (Hibernatable WebSocket API)
  - Platform-agnostic - works with any adapter

**Frontend**:

- **apps/web**: SvelteKit application using Svelte 5, deployed to Cloudflare Pages
  - Frontend for the streamling visualization and user dashboard
  - Database layer using Drizzle ORM with libSQL/SQLite
  - Handles OAuth flow and user management
  - Uses TailwindCSS v4 for styling

**Shared**:

- **packages/shared**: Shared TypeScript types
  - Currently exports `TwitchEventPayload` and `InstallUserTokenBody`
  - Used by all apps for type safety

### Event Flow

```
Twitch EventSub → twitch-eventsub (:8788) → streamling-state (:8787)
                   [Maps IDs]                 [Stores state]
                                                    ↓
                                              /ws WebSocket
                                              [Push telemetry every tick]
```

This architecture allows adding new platform adapters (YouTube, Facebook, etc.) without changing core logic.

### Key Technologies

- **SvelteKit**: Web framework (adapter-cloudflare for Pages deployment)
- **Drizzle ORM**: Database ORM with libSQL client
- **Cloudflare Workers + Durable Objects**: Serverless backend for Twitch event handling
- **pnpm workspaces**: Monorepo package management
- **Wrangler**: Cloudflare Workers development and deployment
- **Twitch API**: EventSub webhooks for chat/stream events

## Development Commands

### Workspace-level commands (run from root):

```bash
# Start all apps in parallel development mode
pnpm dev

# Build all apps
pnpm build

# Lint all apps
pnpm lint

# Type-check all apps
pnpm typecheck
```

### Web app (apps/web):

```bash
cd apps/web

# Development server (Vite)
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview

# Type checking
pnpm check
pnpm check:watch

# Testing
pnpm test:unit              # Run Vitest unit tests
pnpm test:unit -- --run     # Run once without watch
pnpm test:e2e               # Run Playwright e2e tests
pnpm test                   # Run all tests

# Database management
pnpm db:push      # Push schema changes to database
pnpm db:generate  # Generate migration files
pnpm db:migrate   # Run migrations
pnpm db:studio    # Open Drizzle Studio GUI

# Code quality
pnpm lint         # Run Prettier + ESLint
pnpm format       # Auto-format with Prettier
```

### Streamling State Worker (apps/streamling-state):

```bash
cd apps/streamling-state

# Local development (runs on port 8787)
pnpm dev

# Build (dry-run deployment)
pnpm build

# Deploy to Cloudflare
pnpm deploy

# Run tests
pnpm test
```

### Twitch EventSub Adapter (apps/twitch-eventsub):

```bash
cd apps/twitch-eventsub

# Local development (runs on port 8788)
pnpm dev

# Build (dry-run deployment)
pnpm build

# Deploy to Cloudflare
pnpm deploy

# Run tests
pnpm test

# Test EventSub integration
pnpm test:verify  # Verify challenge response
pnpm test:event   # Send random test event (forwards to streamling-state)

# Stream simulation (exercises energy/mood system end-to-end)
pnpm test:simulate                 # Real-time (~12 min)
pnpm test:simulate -- --speed 10   # Fast (~72 sec)
pnpm test:simulate -- --speed 100  # Smoke test (~7 sec)
```

### Local Development Workflow

To test the full event flow:

1. **Terminal 1**: Start StreamlingState worker
   ```bash
   cd apps/streamling-state && pnpm dev
   ```

2. **Terminal 2**: Start Twitch EventSub adapter
   ```bash
   cd apps/twitch-eventsub && pnpm dev
   ```

3. **Terminal 3**: Send test events
   ```bash
   cd apps/twitch-eventsub && pnpm test:event
   ```

4. **Or run a full simulation** (four phases: quiet → ramp up → hype → cool down):
   ```bash
   cd apps/twitch-eventsub && pnpm test:simulate -- --speed 10
   ```

Events will flow: Twitch CLI → adapter (:8788) → streamling-state (:8787)

## Environment Setup

1. Copy `.env.example` to create environment files for each app
2. Required environment variables:
   - `TWITCH_CLIENT_ID`: Twitch application client ID
   - `TWITCH_CLIENT_SECRET`: Twitch application secret
   - `TWITCH_REDIRECT_URI`: OAuth callback URL (default: http://localhost:5173/auth/callback)
   - `WORKER_PUBLIC_URL`: Worker URL for EventSub webhooks (default: http://127.0.0.1:8787)
   - `DATABASE_URL`: libSQL database connection string (required for web app)

3. For the worker, also configure `wrangler.toml`:
   - Set `TWITCH_CLIENT_ID` in the `[vars]` section
   - Set secrets via CLI: `wrangler secret put TWITCH_CLIENT_SECRET`

## Database Schema

Database schema is defined in `apps/web/src/lib/server/db/schema.js` using Drizzle ORM. The database client is initialized in `apps/web/src/lib/server/db/index.js` and pulls `DATABASE_URL` from SvelteKit's private environment.

### Tables

- **user**: Legacy table with `id` (UUID, PK) and `age` (integer, optional)
- **streamer**: Streamer profiles — `id` (UUID, PK), `display_name` (required), `avatar_url` (optional), `created_at` (timestamp)
- **platform_connection**: Links streamers to platform accounts — `id` (UUID, PK), `streamer_id` (FK → streamer), `platform` (e.g. `'twitch'`), `platform_user_id`, `platform_username`, OAuth tokens (`access_token`, `refresh_token`, `token_expires_at`), `connected_at` (timestamp). A streamer can have multiple platform connections.
- **streamling**: One per streamer, holds the Durable Object identifier for routing — `id` (UUID, PK), `streamer_id` (FK → streamer, unique), `durable_object_id`, `created_at` (timestamp)

## Testing Tools

- **Twitch CLI**: Installed for emulating EventSub webhooks locally
- **Wrangler**: For local Workers development and Durable Objects testing
- **Vitest**: Unit testing with browser support
- **Playwright**: End-to-end testing

## CI Pipeline

The project uses GitHub Actions for continuous integration and deployment.

### Tests (`.github/workflows/test.yml`)

Runs on every push to `main` and on every pull request targeting `main`. Two jobs run **in parallel**:

- **Worker tests**: Runs `pnpm --filter @streamlings/streamling-state test` (Vitest)
- **Web app tests**: Runs Svelte type checking (`pnpm --filter web check`) and Vitest unit tests (`pnpm --filter web test:unit -- --run`)

Playwright E2E tests are not included in CI (run those locally).

### Deploy Workers (`.github/workflows/deploy.yml`)

Deploys streamling-state and twitch-eventsub workers on push to `main` when worker-related files change. Runs preview deploys with smoke tests before promoting to production.

### Deploy Web App (`.github/workflows/deploy-web.yml`)

Deploys the SvelteKit web app to Cloudflare Pages on push to `main` when web-related files change. Runs its own type checking and unit tests before building and deploying (preview with smoke test, then production).

### PR Review (`.github/workflows/pr-review.yml`)

Runs an automated Claude-powered code review on pull requests.

## Deployment Targets

- **Web app**: Cloudflare Pages (via @sveltejs/adapter-cloudflare)
- **Worker**: Cloudflare Workers with Durable Objects enabled
