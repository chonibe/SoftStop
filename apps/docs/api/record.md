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

## Next

- [check](/api/check)
- [verify](/api/verify)
- [Adoption contract](/start/adoption-contract)
