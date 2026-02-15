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

**Control Plane**:

- **apps/lattice**: Phoenix 1.7 + LiveView application (Elixir), deployed to Fly.io
  - Streamer-facing control plane for managing streamling configuration
  - Health check at `GET /health`
  - Uses Bandit HTTP server, Phoenix PubSub, Telemetry
  - No database yet (--no-ecto) — will connect to streamling-state worker API
  - Asset pipeline: esbuild + Tailwind CSS + Heroicons

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
- **Phoenix + LiveView**: Elixir web framework for the Lattice control plane
- **pnpm workspaces**: Monorepo package management
- **Mix**: Elixir build tool (for apps/lattice)
- **Wrangler**: Cloudflare Workers development and deployment
- **Fly.io**: Deployment target for the Lattice app
- **Twitch API**: EventSub webhooks for chat/stream events

## Development Commands

### Workspace-level commands (run from root):

```bash
# Start all JS/TS apps in parallel development mode
pnpm dev

# Build all JS/TS apps
pnpm build

# Lint all JS/TS apps
pnpm lint

# Type-check all JS/TS apps
pnpm typecheck

# Lattice (Elixir — not covered by pnpm -r)
pnpm lattice:setup   # Install Elixir deps + build assets
pnpm lattice:dev     # Start Phoenix dev server on :4000
pnpm lattice:test    # Run ExUnit tests
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

### Lattice Control Plane (apps/lattice):

```bash
cd apps/lattice

# First-time setup (install deps + build assets)
mix setup

# Development server (runs on port 4000)
mix phx.server

# Run tests
mix test

# Compile with warnings as errors
mix compile --warnings-as-errors

# Build release (for production)
MIX_ENV=prod mix release

# Asset pipeline
mix assets.deploy    # Build + minify + digest for production
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

4. For the Lattice app (production only):
   - `SECRET_KEY_BASE`: Phoenix secret (generate with `mix phx.gen.secret`)
   - `PHX_HOST`: Production hostname (e.g. `streamlings-lattice.fly.dev`)
   - `FLY_API_TOKEN`: Fly.io deploy token (CI secret)

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
- **ExUnit**: Elixir test framework (for apps/lattice)

## Deployment Targets

- **Web app**: Cloudflare Pages (via @sveltejs/adapter-cloudflare)
- **Workers**: Cloudflare Workers with Durable Objects enabled
- **Lattice**: Fly.io (Docker-based deployment, see `apps/lattice/fly.toml`)
