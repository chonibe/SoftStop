# release

Drop an active check-and-reserve lease without applying pressure cost. Use when you abort after an allow (crash recovery, cancelled send) and want capacity freed before TTL.

Requires **reserve mode** (`reserveTtlMs > 0` / `SOFTSTOP_RESERVE`).

| Environment | Method | Path |
|---|---|---|
| Local | `POST` | `/v1/release` |
| Hosted | `POST` | `/api/release` |

## Request

```json
{
  "decisionId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user_123",
  "tenantId": "pilot_acme"
}
```

| Field | Required | Notes |
|---|---|---|
| `decisionId` | yes | From `check` allow |
| `userId` | yes | Same user as `check` |
| `tenantId` | no | Must match `check` when used |

## Response

```json
{ "ok": true, "released": true }
```

`released` is `false` when there was no active (non-expired) reserve for that `decisionId` (already recorded, released, or TTL elapsed). SoftStop still returns `200` and writes a `released` event when the body is valid.

## When to use

| Situation | Call |
|---|---|
| Send succeeded / blocked / downgraded | [`record`](/api/record) |
| Abort after allow; free budget early | `release` |
| Do nothing after allow | Wait for TTL (lazy prune) — raises `expiredReserveRate` |

Do **not** use `outcome: "released"` on `record` — release is a separate route so `record` stays outcome-of-send semantics.

## Errors

| Status | When |
|---|---|
| `400` | Invalid body, or reserve mode off (`reserveTtlMs` is `0`) |

## Next

- [check](/api/check)
- [record](/api/record)
- [Errors — concurrent allows](/api/errors#concurrent-allows-race)
- [Orphan rate / expired reserves](/ops/orphan-rate)
