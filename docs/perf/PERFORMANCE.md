# Performance Tracking

This document tracks Governor performance considerations and measurement points.

## What to measure
- Decision latency for `POST /v1/check`.
- Supabase read/write latency and error rates.
- Rate of blocked escalations vs allowed.

## Baseline targets (v1)
- `check` P95 latency under 50ms in production.
- Error rate under 0.5% for API requests.

## Data sources
- API logs with response timing.
- Supabase query logs.

## References
- Implementation: [governor/api/src/server.ts](../../governor/api/src/server.ts)
- Tests: [governor/tests/rules.test.ts](../../governor/tests/rules.test.ts)
- Performance tracking: [docs/perf/PERFORMANCE.md](PERFORMANCE.md)

## Version
1.0.0

## Change Log
- 1.0.0: Initial performance tracking doc.
