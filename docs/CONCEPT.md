# Governor Concept (Developer-Friendly)

## Overview
Governor is a tiny control layer that answers a single question before any system escalates pressure on a user: **is escalation allowed right now?** It stores a small per-user state (what pressure was applied, how often, and how recently) and applies deterministic rules (no ML).

## API contract (v1)
**POST `/v1/check`**  
Request:
```
{ "userId": "user_123", "actionType": "urgency" }
```
Response:
```
{ "allowed": false, "reason": "cooldown_active", "decisionId": "..." }
```

**POST `/v1/record`**  
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
Any escalation engine calls `POST /v1/check` before acting. If denied, it skips or downgrades. After an action resolves, it calls `POST /v1/record` with outcome and signals (dismissed, ignored, hesitated).

## Demo behavior
The demo shows the "before" scenario (no gate) vs "after" (Governor gate), using upgrade prompts, reminders, and urgency messages for a single user.

## References
- Implementation: [governor/api/src/server.ts](../governor/api/src/server.ts)
- Tests: [governor/tests/rules.test.ts](../governor/tests/rules.test.ts)
- Performance tracking: [docs/perf/PERFORMANCE.md](perf/PERFORMANCE.md)

## Version
1.0.0

## Change Log
- 1.0.0: Initial developer concept doc.
