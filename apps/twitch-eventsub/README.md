# Twitch EventSub Adapter

Cloudflare Worker that receives Twitch EventSub webhooks and forwards them to the StreamlingState worker with mapped internal user IDs.

## Architecture

This adapter worker:
1. Verifies the webhook signature (HMAC-SHA256) to confirm the request came from Twitch
2. Receives Twitch EventSub webhook notifications
3. Extracts Twitch user IDs from events
4. Maps Twitch IDs → internal user IDs
5. Forwards events to StreamlingState worker

This allows StreamlingState to be platform-agnostic while supporting multiple streaming platforms.

## Security

### Webhook Signature Verification

Twitch signs every EventSub webhook delivery with HMAC-SHA256. This adapter verifies that signature before processing any event, ensuring requests genuinely came from Twitch.

**How it works:**

1. Twitch sends three headers with every webhook: `Twitch-Eventsub-Message-Id`, `Twitch-Eventsub-Message-Timestamp`, and `Twitch-Eventsub-Message-Signature`
2. The adapter computes `HMAC-SHA256(secret, message_id + timestamp + raw_body)` using the Web Crypto API
3. The computed signature is compared against the provided signature using a timing-safe comparison
4. Timestamps older than 10 minutes are rejected to prevent replay attacks

**Setting the secret in production:**

```bash
# Set the secret (must match the secret used when creating the EventSub subscription)
wrangler secret put TWITCH_WEBHOOK_SECRET

# For preview environment
wrangler secret put TWITCH_WEBHOOK_SECRET --env preview

# For production environment
wrangler secret put TWITCH_WEBHOOK_SECRET --env prod
```

The secret is stored securely by Cloudflare and is never committed to source control. Do not add it to `[vars]` in `wrangler.toml`.

### Local Development

When `TWITCH_WEBHOOK_SECRET` is not configured, signature verification is skipped entirely. A console warning is logged on every request to make this visible. This allows local development with the Twitch CLI and test scripts without needing to configure a shared secret.

This skip behavior is safe for local development but the secret must always be set in deployed environments.

## Supported Event Types

| EventSub Type | Category | User ID Field |
|---|---|---|
| `channel.chat.message` | Message | `event.user_id` |
| `channel.follow` | Interaction | `event.user_id` |
| `channel.subscribe` | High-value | `event.user_id` |
| `channel.subscription.gift` | High-value | `event.to_broadcaster_user_id` |
| `channel.subscription.message` | High-value | `event.user_id` |
| `channel.cheer` | High-value | `event.user_id` |
| `channel.raid` | High-value | `event.user_id` |
| `stream.online` | Stream lifecycle | `event.broadcaster_user_id` |
| `stream.offline` | Stream lifecycle | `event.broadcaster_user_id` |

Stream lifecycle events (`stream.online`, `stream.offline`) use the broadcaster as the relevant user since there is no "acting" chat user.

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

# Send specific stream lifecycle events
pnpm test:online
pnpm test:offline

# Run full stream simulation (four phases: quiet → ramp up → hype → cool down)
pnpm test:simulate              # Real-time (~12 min)
pnpm test:simulate -- --speed 10   # Fast (~72 sec)
pnpm test:simulate -- --speed 100  # Smoke test (~7 sec)
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
