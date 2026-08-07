# Performance Tracking

Measured SoftStop decision latency and what we do **not** claim yet.

## Measured: local memory (HTTP)

Script: [`scripts/microbench-check.ts`](../../scripts/microbench-check.ts) (`pnpm bench:check`).

Method: in-process Express app + `MemoryStorage`, `POST /v1/check` over loopback HTTP. Warmup then N timed iters. Machine-local — not a hosted SLA.

| Date (UTC) | Host notes | Warmup | N | p50 (ms) | p95 (ms) | p99 (ms) |
|---|---|---|---|---|---|---|
| 2026-08-07 | macOS Darwin 24 / Node 24 / loopback HTTP + MemoryStorage | 50 | 500 | 0.18 | 0.90 | 3.75 |

Numbers are from one local run of `pnpm bench:check`. Expect variation by machine and load; re-run before quoting elsewhere.

```bash
pnpm bench:check
```

## What we do not claim

- Sub-10ms (or any fixed) **hosted** / **Supabase** P95 without a measured run on that path.
- Cross-region or multi-tenant production SLOs — not established.

## What to measure next

- Decision latency for `POST /v1/check` with Supabase storage (same script pointed at a running server, or a storage variant).
- Supabase read/write latency and error rates.
- Rate of blocked escalations vs allowed (product metrics, not latency).

## Historical baseline targets (aspirational)

These are product goals, not guarantees, until measured on the target deploy:

- `check` P95 under 50ms in a typical self-host memory deploy (consistent with local microbench order of magnitude).
- Error rate under 0.5% for API requests.

## Data sources

- `pnpm bench:check` (local memory).
- API logs with response timing.
- Supabase query logs (when enabled).

## References

- Implementation: [governor/api/src/server.ts](../../governor/api/src/server.ts)
- Tests: [governor/tests/rules.test.ts](../../governor/tests/rules.test.ts)

## Version

1.1.0

## Change Log

- 1.1.0: Add local memory microbench + measured table; drop unmeasured hosted latency claims.
- 1.0.0: Initial performance tracking doc.
