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
| `actionType` | yes | Built-ins: `urgency` \| `discount` \| `interruption` \| `reminder`. Custom slugs allowed if defined in the loaded policy — see [action types](/policies/action-types) |
| `surface` | no | `email` \| `sms` \| `push` \| `in-app` |
| `tenantId` | no | Multi-tenant isolation (default `default`) |
| `context` | no | Opaque metadata for your audit logs |

Callers do **not** send a pressure cost. SoftStop applies server-owned costs from policy.

## Response — allowed

```json
{
  "allowed": true,
  "reason": "allowed",
  "decisionId": "550e8400-e29b-41d4-a716-446655440000",
  "pressure": 0,
  "cost": 40,
  "threshold": 100,
  "projectedPressure": 40
}
```

## Response — blocked (pressure)

```json
{
  "allowed": false,
  "reason": "pressure_exceeded",
  "explanation": "User pressure would exceed the configured threshold for another contact.",
  "decisionId": "550e8400-e29b-41d4-a716-446655440000",
  "pressure": 80,
  "cost": 40,
  "threshold": 100,
  "projectedPressure": 120,
  "suggestedActionType": "reminder"
}
```

## Response — blocked (legacy rule)

```json
{
  "allowed": false,
  "reason": "cooldown_active",
  "explanation": "User recently dismissed or ignored this type. Cooldown expires at …",
  "cooldownUntil": "2026-01-20T10:30:00Z",
  "suggestedActionType": "reminder",
  "decisionId": "550e8400-e29b-41d4-a716-446655440000",
  "pressure": 40,
  "cost": 40,
  "threshold": 100,
  "projectedPressure": 80
}
```

Always pass `decisionId` into [`record`](/api/record). When blocked, still record with `outcome: "blocked"` and `blockReason` from `reason` (use `explanation` / optional `suggestedActionType` in your own UX — do not skip `record`).

`check` is **read-only for pressure**: it evaluates current state and logs a check event; pressure, caps, and cooldowns advance on [`record`](/api/record) (`executed` / `downgraded`). Two concurrent allows can both pass before either records — SoftStop does not lock across callers. See [Errors](/api/errors#concurrent-allows-race).

Read live pressure anytime: `GET /v1/users/:userId/pressure`.

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
