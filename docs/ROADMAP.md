# SoftStop Roadmap

## v0.2 (shipped)

**Product:** SoftStop — shared user pressure / escalation permit.

- Numeric pressure engine (`threshold`, `decayPerHour`, `costs`) + `pressure_exceeded`
- `GET /users/:userId/pressure`
- AI-wedge: send-path guardrails for agents + outreach; channel collision + agent–email collision golden path

## v0.1 (shipped)

**Product:** SoftStop — shared pressure / escalation permit.

- Deterministic `check` / `record` API
- Default pressure policy pack (urgency, discount, interruption, reminder)
- Self-host (local + Docker); optional hosted demo
- Adoption contract (`verify`, `health`)
- Node / Python / browser examples + agent-touchpoint

## High + Medium (shipped — Waves 1–2)

Production OSS priorities from the AI / agent control-layer plan:

| Priority | Item | Status |
|----------|------|--------|
| High | JS `withSoftStop` + `formatBlockedForLlm` + deny fields (`retryAfterMs` / `suggestedFallback`) | **Shipped** (0.2.2) |
| High | Python SDK (git/checkout until PyPI) + agent wrappers / examples | **Shipped client; PyPI not published** |
| High | 1-click self-host polish (Docker / Fly / Railway), GH Actions + README badges, measured local latency note | **Shipped** |
| Medium | SDK fail-safe (`onUnavailable` fail_closed / fail_open + `timeoutMs`) | **Shipped** |
| Medium | Opt-in check-and-reserve + OCC (`SOFTSTOP_RESERVE_TTL_MS` / `reserveTtlMs`; default `0` = legacy) | **Shipped** |
| Medium | Reserve Phase B honesty: `POST …/release`, strict late-record (`applied` / `reserveExpired`), `expiredReserveRate` on health | **Shipped** |
| Medium | Wave B adapters: `eslint-plugin-softstop` + alert-only `scripts/orphan-sweeper.js` | **Shipped** |

Also in active 0.2.x:

- Publish `softstop` to the public npm registry (**done** — `softstop@0.2.1`+)
- Thin agent adapters: `beforeContact` + `wrapUserFacingTool` (shipped in 0.2.1)
- Docs: [Governing AI agents](../apps/docs/start/governing-ai-agents.md)

Design detail: [superpowers/specs/2026-08-07-ai-agent-governor-control-layer-design.md](superpowers/specs/2026-08-07-ai-agent-governor-control-layer-design.md). SoftStop does **not** claim Redis locks or race-safety when reserve is off. Concurrency Wave A (release + expired-reserve metrics + strict late-record): [concurrency & integration rigor](superpowers/specs/2026-08-07-concurrency-integration-rigor-design.md).

## Explicitly not v0.1 / v0.2

- MCP tool-call gateway as the homepage product
- ML personalization / send-time optimization
- Paid multi-tenant control plane / hosted policy UI

## Later (optional)

- Commercial control plane (SSO, SIEM, distributed caps, policy UI) — pull-triggered; see [commercial-strategy.md](commercial-strategy.md)
- Experimental MCP extraction remains under [archive/mcp-gateway](../archive/mcp-gateway)
- **HTTP middleware** for webhooks / push triggers (Express / Fastify / Next) — beyond `withSoftStop` tool wrappers
- **OTEL / Datadog / decision webhooks** for decision export
- **Helm chart** for Kubernetes self-host
- **P4 — Hierarchical pressure scopes** — optional channel / org / thread budgets atop `tenantId` + `userId` + merge
- Redis multi-region locks / `extend-reserve` (reserve Phase C) — Wave A + Wave B (ESLint + orphan sweeper) **shipped**; mutex/outbound gateway remain out of OSS core — see [concurrency & integration rigor design](superpowers/specs/2026-08-07-concurrency-integration-rigor-design.md)
- Hosted sub-10–20ms latency guarantees without measured evidence
- P2 aspirational local/memory P95 &lt;15–30ms beyond current measured baseline; classic token-bucket if designed separately
- Additional framework adapters beyond Vercel AI / LangChain JS `withSoftStop` shape

## Shipped after feedback (2026-08)

- **Policy-defined custom action types** — built-ins required; extras via matching keys in `costs` / `cooldownHours` / `typeCap`. See [apps/docs/policies/action-types.md](../apps/docs/policies/action-types.md) and [design spec](superpowers/specs/2026-08-06-extensible-action-types-design.md).
