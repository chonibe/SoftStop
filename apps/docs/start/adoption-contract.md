# Adoption contract

SoftStop protects users only when it is used correctly. Partial wiring is worse than no SoftStop — it creates **false confidence**.

## SoftStop protects users only when

1. **All** escalation touchpoints call `check` before acting  
2. **Every** check gets a matching `record`  
3. **`actionType` is correct** (not everything labeled `reminder`)  
4. **`userId` is consistent** across check and record  

## What breaks when misused

| Misuse | Effect |
|---|---|
| Partial adoption | Pressure stacks on unwired paths; you think users are protected |
| Skipped `record` | State diverges; cooldowns/caps wrong |
| Wrong `actionType` | Rules apply incorrectly |
| Wrong `userId` | Pressure attributed to the wrong person |

## Health metrics

`GET /v1/health?periodHours=24` (local) or `GET /api/health?periodHours=24` (hosted).

| Metric | Healthy | Concerning |
|---|---|---|
| **orphanRate** | &lt; 0.05 | &gt; 0.2 → many checks never recorded |
| **totalOutcomes / totalChecks** | ~1 | ≪ 0.5 → skipped record |
| **actionTypeDistribution** | Mixed | One type &gt; 80% → mislabeling |
| **blockRate** | ~0.05–0.25 | 0 = never blocking; &gt; 0.8 may be over-blocking |
| **healthScore** | &gt; 70 | &lt; 50 → integration gaps |

## Verify

```bash
curl -X POST http://localhost:3000/v1/verify
curl 'http://localhost:3000/v1/health?periodHours=24'
```

If only some paths are wired, say so — false confidence is worse than no SoftStop.

## Next

- [Orphan rate](/ops/orphan-rate)
- [Integration workflow](/integrate/workflow)
- [health API](/api/health)
