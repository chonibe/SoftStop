# SoftStop Concept (Developer-Friendly)

## Overview
SoftStop is a tiny control layer that answers a single question before any system escalates pressure on a user: **is escalation allowed right now?** It stores a small per-user state (pressure score, what was applied, how often, how recently) and applies deterministic rules (no ML).

SoftStop does not rate-limit humans. It rate-limits agents and other systems that want to reach them.

## API contract (v1)
**POST `/v1/check` (local) / `/api/check` (hosted)**  
Request:
```
{ "userId": "user_123", "actionType": "urgency" }
```
Response:
```
{ "allowed": false, "reason": "pressure_exceeded", "pressure": 80, "cost": 40, "threshold": 100, "projectedPressure": 120, "decisionId": "..." }
```

**POST `/v1/record` (local) / `/api/record` (hosted)**  
Request:
```
{ "decisionId": "...", "userId": "user_123", "actionType": "urgency", "outcome": "executed", "signals": { "dismissed": true } }
```
Response:
```
{ "ok": true }
```

**GET `/v1/users/:userId/pressure`**  
Returns decayed pressure, threshold, decay rate, and server-owned costs.

## Storage model
- `governor_events`: append-only event log (check, executed, blocked, downgraded).
- `governor_user_state`: compact JSON with pressure, cooldowns, counts, and recency data.

## Rules (example)
- User pressure: costs + decay + threshold (primary gate)
- Per-type cooldown after hesitation
- Per-type frequency caps in a rolling window
- Global cap across all escalation types
- Stack protection (avoid back-to-back pressure)

## Integration pattern
Any escalation engine calls `check` before acting. If denied, it skips or downgrades. After an action resolves, it calls `record` with outcome and signals (dismissed, ignored, hesitated).

For the enterprise adoption narrative (multi-system diagram, identity, scoped keys, staged rollout), see the docs page [How a company uses SoftStop](../apps/docs/start/how-a-company-uses-softstop.md).

## Demo behavior
See [examples/agent-email-collision](../examples/agent-email-collision) and the live scroll demo.
