# Twitch EventSub Adapter

Cloudflare Worker that receives Twitch EventSub webhooks and forwards them to the StreamlingState worker with mapped internal user IDs.

## Architecture

This adapter worker:
1. Receives Twitch EventSub webhook notifications
2. Extracts Twitch user IDs from events
3. Maps Twitch IDs → internal user IDs
4. Forwards events to StreamlingState worker

This allows StreamlingState to be platform-agnostic while supporting multiple streaming platforms.

## Local Development

### Prerequisites

- [Twitch CLI](https://dev.twitch.tv/docs/cli/) for testing EventSub events
- StreamlingState worker running on port 8787

### Running the Worker

Start the development server:

```bash
pnpm dev
```

The worker will be available at `http://localhost:8788`

### Testing the Full Flow

**Terminal 1: Start StreamlingState worker**
```bash
cd apps/streamling-state
pnpm dev
```

**Terminal 2: Start Twitch EventSub adapter**
```bash
cd apps/twitch-eventsub
pnpm dev
```

**Terminal 3: Send test events**
```bash
cd apps/twitch-eventsub

# Verify challenge response
pnpm test:verify

# Send random events
pnpm test:event
```

You should see:
- Events received in Terminal 2 (adapter logs)
- Events forwarded and counted in Terminal 1 (StreamlingState logs)

### Viewing Current Counts

Query the StreamlingState worker directly:

```bash
curl http://localhost:8787/webhook
```

## User ID Mapping

Currently uses simple prefix mapping:
- Twitch user ID `12345` → Internal ID `internal_12345`

This will be enhanced to support:
- Persistent ID mapping storage
- Multiple platform adapters (YouTube, Facebook, etc.)
- User account linking
