# Streamlings Worker

Cloudflare Worker with Durable Objects that handles Twitch EventSub webhooks.

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

## Architecture

- **StreamlingState** - Durable Object that tracks event counts
- **/webhook** - POST endpoint that receives Twitch EventSub notifications
- **GET /webhook** - Returns current event counts as JSON
