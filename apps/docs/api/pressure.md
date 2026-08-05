# User pressure & activity

## Get pressure

```http
GET /v1/users/:userId/pressure
```

Hosted demo uses `/api` instead of `/v1`.

```json
{
  "userId": "user_123",
  "pressure": 70,
  "threshold": 100,
  "decayPerHour": 8,
  "updatedAt": "2026-08-04T12:00:00.000Z",
  "costs": { "urgency": 40, "discount": 30, "interruption": 25, "reminder": 15 }
}
```

## Get activity

```http
GET /v1/users/:userId/activity?limit=50
```

Returns current pressure plus recent executed / blocked / downgraded events for that user (pressure snapshots are stored on check/record contexts).

```json
{
  "userId": "user_123",
  "pressure": 70,
  "threshold": 100,
  "decayPerHour": 8,
  "costs": { "urgency": 40, "discount": 30, "interruption": 25, "reminder": 15 },
  "updatedAt": "2026-08-04T12:00:00.000Z",
  "events": [
    {
      "createdAt": "2026-08-04T12:00:00.000Z",
      "actionType": "urgency",
      "eventType": "executed",
      "actor": "sales-agent",
      "pressure": 0,
      "cost": 40,
      "projectedPressure": 40,
      "blockReason": null
    }
  ]
}
```

## See it in the UI

- Local: [http://localhost:3000/demo/console.html](http://localhost:3000/demo/console.html) (`pnpm dev`)
- Hosted: [https://softstop.vercel.app/console.html](https://softstop.vercel.app/console.html)

## Related

- [check](/api/check)
- [record](/api/record)
- [Getting started](/start/getting-started)
