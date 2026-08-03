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
| outcomes ≈ checks | near 1:1 |
| `actionTypeDistribution` | mixed types |
| `blockRate` | some blocking in real traffic |

## CLI

```bash
SOFTSTOP_API_URL=http://localhost:3000 pnpm softstop health
```

## Next

- [Orphan rate](/ops/orphan-rate)
- [Adoption contract](/start/adoption-contract)
- [verify](/api/verify)
