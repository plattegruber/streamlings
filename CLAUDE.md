# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Streamlings is a Twitch-integrated interactive pet that lives on stream and responds to chat - like a Tamagotchi powered by your audience. The project uses a pnpm workspace monorepo architecture with two main applications and a shared types package.

## Architecture

### Workspace Structure

- **apps/web**: SvelteKit application using Svelte 5, deployed to Cloudflare Pages
  - Frontend for the streamling visualization and user dashboard
  - Database layer using Drizzle ORM with libSQL/SQLite
  - Handles Twitch OAuth flow and user management
  - Uses TailwindCSS v4 for styling

- **apps/worker**: Cloudflare Worker for handling Twitch events
  - Receives Twitch EventSub webhooks
  - Uses Durable Objects (TwitchDO) for stateful event processing
  - Communicates with the web app for state updates

- **packages/shared**: Shared TypeScript types
  - Currently exports `TwitchEventPayload` and `InstallUserTokenBody`
  - Used by both web and worker apps for type safety

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

### Worker (apps/worker):

```bash
cd apps/worker

# Local development (runs on port 8787)
pnpm dev

# Build (dry-run deployment)
pnpm build

# Deploy to Cloudflare
pnpm deploy
```

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

## Testing Tools

- **Twitch CLI**: Installed for emulating EventSub webhooks locally
- **Wrangler**: For local Workers development and Durable Objects testing
- **Vitest**: Unit testing with browser support
- **Playwright**: End-to-end testing

## Deployment Targets

- **Web app**: Cloudflare Pages (via @sveltejs/adapter-cloudflare)
- **Worker**: Cloudflare Workers with Durable Objects enabled
