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
{ "ok": true }
```

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

Pressure and caps update here on `executed` / `downgraded` (not on `check`). Concurrent allows that both recorded `executed` can both land — see [check](/api/check) and [Errors](/api/errors#concurrent-allows-race).

## Next

- [check](/api/check)
- [Errors](/api/errors)
- [verify](/api/verify)
- [Adoption contract](/start/adoption-contract)
