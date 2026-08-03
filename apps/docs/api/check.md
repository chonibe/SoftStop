# check

Request permission before raising pressure on a user.

| Environment | Method | Path |
|---|---|---|
| Local | `POST` | `/v1/check` |
| Hosted | `POST` | `/api/check` |

## Request

```json
{
  "userId": "user_123",
  "actionType": "urgency",
  "surface": "email",
  "tenantId": "pilot_acme",
  "context": {
    "campaign": "black_friday"
  }
}
```

| Field | Required | Notes |
|---|---|---|
| `userId` | yes | Stable per-user id |
| `actionType` | yes | `urgency` \| `discount` \| `interruption` \| `reminder` |
| `surface` | no | `email` \| `sms` \| `push` \| `in-app` |
| `tenantId` | no | Multi-tenant isolation (default `default`) |
| `context` | no | Opaque metadata for your audit logs |

## Response — allowed

```json
{
  "allowed": true,
  "reason": "allowed",
  "decisionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

## Response — blocked

```json
{
  "allowed": false,
  "reason": "cooldown_active",
  "explanation": "User recently dismissed or ignored this type. Cooldown expires at …",
  "cooldownUntil": "2026-01-20T10:30:00Z",
  "suggestedActionType": "reminder",
  "decisionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

Always pass `decisionId` into [`record`](/api/record). When blocked, still record with `outcome: "blocked"` and `blockReason`.

## curl

```bash
curl -s -X POST http://localhost:3000/v1/check \
  -H 'content-type: application/json' \
  -d '{"userId":"user_123","actionType":"urgency","surface":"email"}'
```

## Next

- [record](/api/record)
- [Errors](/api/errors)
- [Action types](/policies/action-types)
