# Governor Feature

## Feature overview and purpose
Governor is a gate that decides if automated escalation toward an end user is allowed. It prevents pressure stacking across systems by enforcing cooldowns and caps.

## Technical implementation details
- Node.js + TypeScript HTTP service (`/v1/check`, `/v1/record`)
- Supabase Postgres for event logging and compact per-user state
- Deterministic rules engine (no ML)

## API endpoints and usage
**POST `/v1/check` (local) / `/api/check` (Vercel)**
```
{ "userId": "user_123", "actionType": "urgency" }
```
**POST `/v1/record` (local) / `/api/record` (Vercel)**
```
{ "decisionId": "...", "userId": "user_123", "actionType": "urgency", "outcome": "executed", "signals": { "dismissed": true } }
```

## Database schema changes
- `governor_events`: append-only log of checks and outcomes
- `governor_user_state`: compact per-user JSON state

## UI/UX considerations
Governor does not design UX. It blocks or allows escalation attempts. Any UI system should check Governor before showing interruptions, urgency, or discounts.

## Testing requirements
- Unit tests for rules engine
- API contract tests for `/v1/check` and `/v1/record`

## Deployment considerations
- Requires Supabase URL and service role key
- Stateless API process; scale horizontally

## Data fetching logic (Supabase)
- `/v1/check` reads `governor_user_state` by `user_id` and writes a `check` event to `governor_events`
- `/v1/record` appends an outcome event to `governor_events` and upserts `governor_user_state`

## Known limitations
- No ML or behavioral prediction
- Single tenant scope (global end user only)
- Simple rule configuration (v1)

## Future improvements
- Tenant scoping (merchant_id + user_id)
- Configurable policies per surface
- Admin dashboard for policy monitoring

## References
- Implementation: [governor/api/src/server.ts](api/src/server.ts)
- Tests: [governor/tests/rules.test.ts](tests/rules.test.ts)
- Performance tracking: [docs/perf/PERFORMANCE.md](../docs/perf/PERFORMANCE.md)

## Version
1.0.0

## Change Log
- 1.0.0: Initial feature README.
