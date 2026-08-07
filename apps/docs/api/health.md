# health

Integration health for a rolling window.

| Environment | Method | Path |
|---|---|---|
| Local | `GET` | `/v1/health?periodHours=24` |
| Hosted | `GET` | `/api/health?periodHours=24` |

## Response

```json
{
  "ok": true,
  "metrics": {
    "periodHours": 24,
    "totalChecks": 150,
    "totalOutcomes": 142,
    "orphanCount": 8,
    "orphanRate": 0.053,
    "expiredReserveCount": 2,
    "expiredReserveRate": 0.013,
    "blockRate": 0.12,
    "actionTypeDistribution": {
      "urgency": 40,
      "reminder": 60,
      "interruption": 42
    },
    "healthScore": 90
  }
}
```

## Reading the numbers

| Metric | Target |
|---|---|
| `orphanRate` | &lt; 0.05 |
| `expiredReserveRate` | &lt; 0.05 when reserve mode is on (0 when reserve off) |
| outcomes ≈ checks | near 1:1 |
| `actionTypeDistribution` | mixed types |
| `blockRate` | some blocking in real traffic |

### `expiredReserveRate`

When `reserveTtlMs > 0`, SoftStop counts checks in the window that have **no** closing event (`executed` \| `blocked` \| `downgraded` \| `released`) **and** whose check age is ≥ `reserveTtlMs`.

`expiredReserveRate = expiredReserveCount / totalChecks` (0 if no checks or reserve disabled).

This overlaps orphans older than the lease window — intentional. Keep both metrics; see [orphan rate](/ops/orphan-rate).

### `includeOrphans=1`

Optional query flag for ops / the orphan sweeper. When set, the response also includes `orphanedChecks`: `{ decisionId, userId, actionType, createdAt }[]` (up to 100).

```bash
curl 'http://localhost:3000/v1/health?periodHours=24&includeOrphans=1'
```

## CLI

```bash
SOFTSTOP_API_URL=http://localhost:3000 pnpm softstop health
# Alert-only orphan sweeper (cron):
node scripts/orphan-sweeper.js --periodHours=24
```

## Next

- [Orphan rate](/ops/orphan-rate)
- [Adoption contract](/start/adoption-contract)
- [verify](/api/verify)
