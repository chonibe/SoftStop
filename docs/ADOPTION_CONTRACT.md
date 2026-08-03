# SoftStop Adoption Contract

SoftStop protects users only when it is used correctly. This document describes the contract, failure modes, and how to verify integration health.

## When SoftStop Protects Users

SoftStop protects users **only when**:

1. **All escalation touchpoints** (popups, push notifications, emails, in-app prompts) call `POST /check` before acting (`/v1/check` locally, `/api/check` on hosted)
2. **Every check receives a matching record** via `POST /record` after the escalation runs (or is skipped)
3. **actionType is correct** for each escalation (urgency, discount, interruption, reminder)
4. **userId is consistent** across check and record for the same user

## What Breaks When Misused

| Misuse | Effect |
|--------|--------|
| **Partial adoption** | Some touchpoints skip SoftStop; pressure stacks; you believe users are protected when they are not |
| **Skipped record()** | SoftStop's state diverges from reality; counts and cooldowns are wrong; decisions become incorrect |
| **Wrong actionType** | Rules apply incorrectly; too much or too little pressure gets through |
| **Wrong userId** | Pressure attributed to wrong user; one user over-pushed, another under-pushed |

## Main Risk: False Confidence

The worst outcome is **false confidence**: you believe SoftStop is protecting users when it is not. This happens when:

- Only some systems call SoftStop
- record() is often skipped
- actionType is mislabeled (e.g. everything as "reminder" to avoid limits)

**Worse than no SoftStop:** With no SoftStop, you know pressure is ungoverned. With misused SoftStop, you assume the problem is solved when it is not.

## Health Metrics

Use `GET /v1/health?periodHours=24` (local) or `GET /api/health?periodHours=24` (hosted) to monitor integration health.

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

Run `POST /v1/verify` (local) or `POST /api/verify` (hosted) to validate that the SoftStop API and storage are working correctly.

### Success Response

```json
{
  "ok": true,
  "decisionId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Integration verification passed"
}
```

## CLI

From the repo root:

```bash
GOVERNOR_API_URL=http://localhost:3000 pnpm governor verify
GOVERNOR_API_URL=http://localhost:3000 pnpm governor health
```

## References

- Implementation: [governor/api/src/server.ts](../governor/api/src/server.ts)
- Integration workflow: [GOVERNOR_INTEGRATION_WORKFLOW.md](GOVERNOR_INTEGRATION_WORKFLOW.md)
- Default rules: [default-policy-pack.md](default-policy-pack.md)
