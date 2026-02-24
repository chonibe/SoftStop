# Governor Adoption Contract

Governor protects users only when it is used correctly. This document describes the contract, failure modes, and how to verify integration health.

## When Governor Protects Users

Governor protects users **only when**:

1. **All escalation touchpoints** (popups, push notifications, emails, in-app prompts) call `POST /api/check` before acting
2. **Every check receives a matching record** via `POST /api/record` after the escalation runs (or is skipped)
3. **actionType is correct** for each escalation (urgency, discount, interruption, reminder)
4. **userId is consistent** across check and record for the same user

## What Breaks When Misused

| Misuse | Effect |
|--------|--------|
| **Partial adoption** | Some touchpoints skip Governor; pressure stacks; you believe users are protected when they are not |
| **Skipped record()** | Governor's state diverges from reality; counts and cooldowns are wrong; decisions become incorrect |
| **Wrong actionType** | Rules apply incorrectly; too much or too little pressure gets through |
| **Wrong userId** | Pressure attributed to wrong user; one user over-pushed, another under-pushed |

## Main Risk: False Confidence

The worst outcome is **false confidence**: you believe Governor is protecting users when it is not. This happens when:

- Only some systems call Governor
- record() is often skipped
- actionType is mislabeled (e.g. everything as "reminder" to avoid limits)

**Worse than no Governor:** With no Governor, you know pressure is ungoverned. With misused Governor, you assume the problem is solved when it is not.

## Health Metrics

Use `GET /api/health?periodHours=24` to monitor integration health.

### Response

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

### Interpreting Metrics

| Metric | Healthy | Concerning |
|--------|---------|------------|
| **orphanRate** | < 0.05 | > 0.2 suggests many checks never get record() |
| **totalOutcomes / totalChecks** | ~1 | << 0.5 suggests skipped record() |
| **actionTypeDistribution** | Mixed types | Single type > 80% suggests mislabeling |
| **blockRate** | 0.05 - 0.25 | 0 suggests no blocking; > 0.8 may mean over-blocking |
| **healthScore** | > 70 | < 50 suggests significant integration gaps |

## Integration Verification

Run `POST /api/verify` to validate that the Governor API and storage are working correctly.

### Success Response

```json
{
  "ok": true,
  "decisionId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Integration verification passed"
}
```

### What It Validates

- Storage (Supabase) is reachable
- Check and record flow completes
- decisionId linking works (check and record are correctly associated)

### When to Run

- After initial integration
- After deployment changes
- Periodically (e.g. in CI) to catch configuration drift

## Reports

Use `GET /api/report` and `GET /api/report/audit` for admin/ops and compliance reporting.

### Admin/Ops Report

`GET /api/report?from=2026-02-01T00:00:00Z&to=2026-02-14T23:59:59Z`

Returns historical metrics: totalChecks, totalOutcomes, orphanCount, orphanRate, blocksByReason, outcomesByType, actionTypeDistribution. Omit from/to to use the last 7 days.

### Audit Report

`GET /api/report/audit?from=...&to=...&format=json|csv`

Same data with `generatedAt` for compliance. Use `format=csv` for export.

### blockReason for Accurate Reporting

When recording a blocked outcome (`outcome: "blocked"`), pass `blockReason` from the check response. This enables `blocksByReason` in reports. Example:

```javascript
const decision = await governor.check({ userId, actionType });
if (!decision.allowed) {
  await governor.record({
    decisionId: decision.decisionId,
    userId,
    actionType,
    outcome: "blocked",
    blockReason: decision.reason  // Enables blocksByReason in reports
  });
}
```

## Recommended Practices

1. **Single owner** – Designate one team or person responsible for Governor adoption
2. **Mandate** – Require that all new escalation touchpoints integrate Governor before shipping
3. **Preset ownership** – If using semantic keys, own the preset in your repo; add keys when adding features
4. **CI checks** – Run integration verification in CI; optionally lint that escalation code uses Governor
5. **Monitor health** – Call `/api/health` periodically and alert on low healthScore or high orphanRate

## Version

1.0.0

## References

- Governor API: [governor/README.md](../governor/README.md)
- Implementation: [governor/api/src/handlers.ts](../governor/api/src/handlers.ts)
