# Plan: Implement Persistent User ID Mapping in Twitch Adapter

**Issue**: [#4 — Implement persistent user ID mapping in Twitch adapter](https://github.com/plattegruber/streamlings/issues/4)

## Problem

The Twitch adapter currently maps user IDs with a naive prefix: `internal_${twitchUserId}`. This is deterministic but platform-coupled — a future YouTube adapter would produce a different internal ID for the same person, making cross-platform unification impossible.

## Approach

Add a **KV namespace** (`USER_MAPPING`) to the Twitch adapter that performs lookup-or-create for `(platform, platformUserId) → internalUserId`. Keys are platform-scoped (`twitch:<userId>`) so the same KV namespace can serve future adapters.

This keeps the adapter thin — it still just verifies, extracts, maps, and forwards — but the mapping is now persistent and platform-aware.

## Steps

### 1. Add KV namespace to `apps/twitch-eventsub/wrangler.toml`

Add a `kv_namespaces` binding for all environments (local, preview, prod):

```toml
kv_namespaces = [
  { binding = "USER_MAPPING", id = "<placeholder>" }
]
```

For local dev, wrangler creates a local KV store automatically. Preview and prod environments each get their own `kv_namespaces` block with environment-specific IDs (placeholders until actual namespaces are created in Cloudflare dashboard).

### 2. Generate Env types

Run `pnpm cf-typegen` in the adapter to produce a `worker-configuration.d.ts` that includes the `USER_MAPPING: KVNamespace` binding. Update `tsconfig.json` to include the generated types file.

### 3. Create `apps/twitch-eventsub/src/user-mapping.ts`

Extract the mapping logic into a focused module:

```typescript
export async function resolveInternalUserId(
  kv: KVNamespace,
  platform: string,
  platformUserId: string,
): Promise<string> {
  const key = `${platform}:${platformUserId}`;
  const existing = await kv.get(key);
  if (existing) return existing;

  const internalId = crypto.randomUUID();
  await kv.put(key, internalId);
  return internalId;
}
```

Design decisions:
- **Key format**: `twitch:12345` — platform-prefixed, ready for `youtube:xyz` later
- **ID format**: `crypto.randomUUID()` — available in Workers runtime, no dependencies needed
- **No metadata stored**: Just the mapping string. Metadata (created_at, etc.) can be added later by storing JSON instead
- **Function takes `KVNamespace` as a parameter** — easy to test with a mock

### 4. Update `apps/twitch-eventsub/src/index.ts`

Replace the inline `const internalUserId = \`internal_\${twitchUserId}\`` with:

```typescript
import { resolveInternalUserId } from './user-mapping';

const internalUserId = await resolveInternalUserId(env.USER_MAPPING, 'twitch', twitchUserId);
```

The rest of the forwarded payload shape stays the same — `internal_user_id` and `twitch_user_id` are already being sent to `streamling-state`.

### 5. Update `apps/streamling-state/src/index.ts` — use `internal_user_id` for chatter tracking

Currently, unique chatter tracking in `incrementEvent` uses `eventData.user_id` (the raw Twitch user ID). Change it to prefer `internal_user_id`, falling back to `user_id` for backward compatibility:

```typescript
const chatterId = eventData?.internal_user_id || eventData?.user_id;
if (chatterId) {
  this.uniqueChattersInTick.add(String(chatterId));
}
```

This ensures the Durable Object tracks chatters by internal ID, which will correctly unify users across platforms in the future.

### 6. Add unit tests — `apps/twitch-eventsub/src/user-mapping.test.ts`

Test with a mock KV (in-memory `Map` implementing the `get`/`put` interface):

- **Returns existing ID for known user**: Pre-populate KV, then call resolve — should return the stored value without calling `put`
- **Creates new UUID for unknown user**: Call resolve for a new key — should return a UUID and persist it via `put`
- **Same user always resolves to same ID**: Call resolve twice for the same key — both calls return the same UUID
- **Different platforms produce different IDs**: `twitch:123` and `youtube:123` should resolve to different internal IDs
- **Key format is correct**: Verify the KV key used is `${platform}:${platformUserId}`

### 7. Add integration tests — `apps/twitch-eventsub/src/index.test.ts`

Using `unstable_dev` (same pattern as `streamling-state/src/index.test.ts`):

- **Challenge verification still works**: POST with `challenge` field returns it back
- **Events are forwarded successfully**: POST a valid event, verify 200 response
- **Repeat user gets consistent internal ID**: Send two events with the same `user_id`, verify both forwarded payloads contain the same `internal_user_id`
- **Different users get different internal IDs**: Send events with different `user_id` values, verify different `internal_user_id` values
- **Returns 404 for non-webhook paths**
- **Returns 400 for invalid payloads**
- **Returns 405 for unsupported methods**

Note: Integration tests require the adapter to have a reachable `STREAMLING_STATE_URL`. In test, either mock the downstream or point to a local dev instance. Will evaluate best approach during implementation — may need to start a streamling-state worker in test setup or stub the fetch.

### 8. Add vitest config — `apps/twitch-eventsub/vitest.config.ts`

The adapter's `package.json` already has `"test": "vitest run"` but no vitest config exists. Create one following the pattern from `apps/streamling-state/vitest.config.ts`.

### 9. Update documentation

- **`CLAUDE.md`**: Add `USER_MAPPING` KV namespace to the Environment Setup section. Note that local dev creates it automatically but preview/prod require Cloudflare dashboard setup.
- **Root `README.md` or adapter README**: Mention the KV namespace dependency and how to create it for deployment.

## Files Changed

| File | Change |
|------|--------|
| `apps/twitch-eventsub/wrangler.toml` | Add `kv_namespaces` binding for all environments |
| `apps/twitch-eventsub/tsconfig.json` | Include generated `worker-configuration.d.ts` |
| `apps/twitch-eventsub/worker-configuration.d.ts` | **New** — Generated by `wrangler types` |
| `apps/twitch-eventsub/src/user-mapping.ts` | **New** — `resolveInternalUserId` function |
| `apps/twitch-eventsub/src/user-mapping.test.ts` | **New** — Unit tests for mapping logic |
| `apps/twitch-eventsub/src/index.ts` | Use `resolveInternalUserId` instead of prefix |
| `apps/twitch-eventsub/src/index.test.ts` | **New** — Integration tests with KV |
| `apps/twitch-eventsub/vitest.config.ts` | **New** — Vitest configuration |
| `apps/streamling-state/src/index.ts` | Prefer `internal_user_id` for chatter tracking |
| `CLAUDE.md` | Document KV namespace in Environment Setup |

## Out of Scope

Per the issue:
- **Cross-platform account linking** (merging `twitch:123` and `youtube:456` into one identity) — requires web app auth flow, separate feature
- **Legacy data migration** — no production data exists yet

## Risks and Considerations

- **KV eventual consistency**: KV is eventually consistent for reads across edge locations. A brief window where a user gets a duplicate UUID is theoretically possible but practically unlikely and inconsequential — both IDs would map to the same logical user. Cross-platform linking (out of scope) would reconcile duplicates anyway. If stronger consistency is needed later, D1 or Durable Object storage are alternatives.
- **Cold start latency**: A KV `get` adds ~1-2ms per request. Acceptable for webhook processing.
- **No TTL**: Mappings are permanent (no expiration). KV storage costs are negligible at expected user counts.

## Acceptance Criteria Mapping

| Criteria from Issue | Implementation |
|---------------------|---------------|
| Stable KV-based ID mapping | `USER_MAPPING` KV namespace configured in all environments |
| Consistent resolution for repeat users | `resolveInternalUserId` does get-then-put, same key always returns same UUID |
| New user ID creation and storage | `crypto.randomUUID()` generated and stored on first encounter |
| Internal ID propagation in forwarded payloads | `internal_user_id` already in payload; now uses real UUID instead of prefix |
| Test coverage verification | Unit tests for mapping logic + integration tests for adapter |
| Local development functionality | Wrangler auto-creates local KV; `pnpm dev` works unchanged |
| Documentation updates | `CLAUDE.md` and adapter README updated |
