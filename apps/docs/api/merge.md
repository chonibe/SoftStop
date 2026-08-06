# merge

Merge an anonymous SoftStop journal into a known identity (e.g. PostHog `ph:` → Street Collector `sc:`).

| Environment | Method | Path |
|---|---|---|
| Local | `POST` | `/v1/users/merge` |
| Hosted | `POST` | `/api/users/merge` |

## Request

```json
{
  "fromUserId": "ph:019abc…",
  "toUserId": "sc:550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "street-collector"
}
```

| Field | Required | Notes |
|---|---|---|
| `fromUserId` | yes | Source journal (usually `ph:<distinct_id>`) |
| `toUserId` | yes | Surviving journal (`sc:<uuid>` or `email:<addr>`) |
| `tenantId` | no | Defaults to `default` |

## Semantics (v1)

| Field | Rule |
|---|---|
| Pressure | `min(threshold, decayed(from) + decayed(to))` |
| Cooldowns | `max` of ISO timestamps per action type |
| Window counts | sum, capped by type / global caps |
| Events | Historical rows stay on `fromUserId`; one `eventType: "merged"` on `toUserId` |
| After merge | `fromUserId` tombstoned (`mergedInto`, empty pressure) |

Second merge of the same pair returns `200` with `alreadyMerged: true` (no-op).

## Response

```json
{
  "ok": true,
  "alreadyMerged": false,
  "fromUserId": "ph:019abc…",
  "toUserId": "sc:550e8400-e29b-41d4-a716-446655440000",
  "pressure": 70,
  "threshold": 100
}
```

Errors: `400` if ids equal / invalid body; `409` if `fromUserId` already merged into a *different* target.

## Example

```bash
curl -s -X POST http://localhost:3000/v1/users/merge \
  -H 'content-type: application/json' \
  -d '{"fromUserId":"ph:anon","toUserId":"sc:user"}'
```
