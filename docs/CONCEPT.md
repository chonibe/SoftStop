# SoftStop Concept (Developer-Friendly)

## Overview
SoftStop is a tiny control layer that answers a single question before any system escalates pressure on a user: **is escalation allowed right now?** It stores a small per-user state (what pressure was applied, how often, and how recently) and applies deterministic rules (no ML).

## API contract (v1)
**POST `/v1/check` (local) / `/api/check` (hosted)**  
Request:
```
{ "userId": "user_123", "actionType": "urgency" }
```
Response:
```
{ "allowed": false, "reason": "cooldown_active", "decisionId": "..." }
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

## Storage model
- `governor_events`: append-only event log (check, executed, blocked, downgraded).
- `governor_user_state`: compact JSON with cooldowns, counts, and recency data.

## Rules (example)
- Per-type cooldown after hesitation
- Per-type frequency caps in a rolling window
- Global cap across all escalation types
- Stack protection (avoid back-to-back pressure)

## Integration pattern
Any escalation engine calls `check` before acting. If denied, it skips or downgrades. After an action resolves, it calls `record` with outcome and signals (dismissed, ignored, hesitated).

## Demo behavior
The demo shows the "before" scenario (no gate) vs "after" (SoftStop gate), using upgrade prompts, reminders, and urgency messages for a single user.

## References
- Implementation: [governor/api/src/server.ts](../governor/api/src/server.ts)
- Tests: [governor/tests/rules.test.ts](../governor/tests/rules.test.ts)
- Adoption: [ADOPTION_CONTRACT.md](ADOPTION_CONTRACT.md)
- Press: [press/SOFTSTOP_PRESS_RELEASE.md](press/SOFTSTOP_PRESS_RELEASE.md)

## Version
1.0.0 — SoftStop product naming; API paths unchanged.
