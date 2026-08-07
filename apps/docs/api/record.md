# record

Record the outcome of a `check` — including when the escalation never ran.

| Environment | Method | Path |
|---|---|---|
| Local | `POST` | `/v1/record` |
| Hosted | `POST` | `/api/record` |

## Request

```json
{
  "decisionId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user_123",
  "actionType": "urgency",
  "outcome": "executed",
  "signals": {
    "dismissed": false,
    "ignored": false,
    "hesitated": false
  },
  "blockReason": "cooldown_active",
  "tenantId": "pilot_acme",
  "context": {
    "emailId": "email_12345"
  }
}
```

| Field | Required | Notes |
|---|---|---|
| `decisionId` | yes | From `check` |
| `userId` | yes | Same user as `check` |
| `actionType` | yes | Same type as `check` |
| `outcome` | yes | `executed` \| `blocked` \| `downgraded` |
| `blockReason` | when blocked | Pass `reason` from `check` |
| `signals` | no | User response hints |
| `tenantId` | no | Must match `check` when used |
| `context` | no | Opaque metadata |

## Response

```json
{
  "ok": true,
  "applied": true,
  "pressure": 40,
  "threshold": 100
}
```

When check-and-reserve is enabled and the matching lease already expired before this `executed` / `downgraded`:

```json
{
  "ok": true,
  "applied": false,
  "reserveExpired": true,
  "pressure": 0,
  "threshold": 100
}
```

`applied: false` means SoftStop did **not** add cost / windows for that outcome — re-`check` before contacting the user again. See [Errors — concurrent allows](/api/errors#concurrent-allows-race).

To free a lease without applying cost (abort path), use [`release`](/api/release) instead of inventing a record outcome.

## Blocked path (required)

```js
if (!decision.allowed) {
  // decision.reason, decision.explanation — optional decision.suggestedActionType
  await ss.record({
    decisionId: decision.decisionId,
    userId,
    actionType,
    outcome: 'blocked',
    blockReason: decision.reason
  })
  return
}
```

Skipping `record` after `check` creates **orphans**. See [orphan rate](/ops/orphan-rate).

Use the exact `decisionId` from the preceding `check`. The server does not reject unknown ids — a mismatch still writes an outcome but breaks orphan pairing. See [Errors](/api/errors).

Pressure and caps update here on `executed` / `downgraded` (not on `check`), except under reserve mode when the lease already expired (`applied: false`). Concurrent allows that both recorded `executed` can both land unless reserve is on — see [check](/api/check) and [Errors](/api/errors#concurrent-allows-race).

## Next

- [check](/api/check)
- [release](/api/release)
- [Errors](/api/errors)
- [verify](/api/verify)
- [Adoption contract](/start/adoption-contract)
