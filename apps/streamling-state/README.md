# Streamling State Worker

Cloudflare Worker with Durable Objects that handles Twitch EventSub webhooks and tracks streamling state.

## Local Development

### Prerequisites

- [Twitch CLI](https://dev.twitch.tv/docs/cli/) installed for testing EventSub events

### Running the Worker

Start the development server:

```bash
pnpm dev
```

The worker will be available at `http://localhost:8787`

### Verifying Challenge Response

Before sending events, verify that your webhook correctly handles EventSub challenge verification:

```bash
# Verify the challenge response works
pnpm test:verify

# Or use the Twitch CLI directly
twitch event verify-subscription channel.follow -F http://localhost:8787/webhook
```

You should see:
- ✔ Valid response. Received challenge [ID] in body
- ✔ Valid status code. Received status 200

### Testing EventSub Integration

With the worker running, open a second terminal and send test events:

```bash
# Send a random event (follow, subscribe, cheer, stream.online, stream.offline)
pnpm test:event

# Or send a specific event using the Twitch CLI directly
twitch event trigger channel.follow -F http://localhost:8787/webhook
twitch event trigger channel.subscribe -F http://localhost:8787/webhook
twitch event trigger channel.cheer -F http://localhost:8787/webhook
```

You'll see a live event count table in the worker logs (terminal 1) after each event.

### Viewing Current Counts

Query the current event counts:

```bash
curl http://localhost:8787/webhook
```

### Viewing Recent Events

Query the recent events ring buffer (up to 200 most recent events):

```bash
curl http://localhost:8787/events
```

Each event record contains:

| Field       | Type     | Description                                          |
|-------------|----------|------------------------------------------------------|
| `timestamp` | number   | Unix epoch milliseconds                              |
| `eventType` | string   | Platform event type, e.g. `channel.chat.message`     |
| `category`  | string   | `message`, `high_value`, `interaction`, or `lifecycle`|
| `userId`    | string?  | Internal user ID (if available)                      |
| `metadata`  | object?  | Extra context: username, amount, tier, raider, etc.  |

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `ALLOWED_ORIGIN` | Origin allowed for CORS requests (e.g. the web app URL) | `http://localhost:5173` |

Set in `wrangler.toml` under `[vars]` for local development. For production, set via `wrangler secret put ALLOWED_ORIGIN --env prod` or in the `[env.prod.vars]` section.

## Architecture

- **StreamlingState** - Durable Object that tracks event counts and recent event history
- **/webhook** - POST endpoint that receives Twitch EventSub notifications
- **GET /webhook** - Returns current event counts as JSON
- **GET /events** - Returns the recent events ring buffer (up to 200 events, newest last)
- **GET /telemetry** - Returns current energy/mood telemetry snapshot
- **GET /config** - Returns current configuration
- **POST /config** - Updates configuration parameters
- **/ws** - WebSocket endpoint for real-time telemetry streaming

All HTTP responses from the worker include CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`). `OPTIONS` preflight requests return `204 No Content` with the appropriate headers.
