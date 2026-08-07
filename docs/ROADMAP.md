# SoftStop Roadmap

## v0.2 (shipped)

**Product:** SoftStop — shared user pressure / escalation permit.

- Numeric pressure engine (`threshold`, `decayPerHour`, `costs`) + `pressure_exceeded`
- `GET /users/:userId/pressure`
- AI-wedge positioning as first-class: circuit breaker for agents + outreach; channel collision remains in scope + agent–email collision golden path

## v0.1 (shipped)

**Product:** SoftStop — shared pressure / escalation permit.

- Deterministic `check` / `record` API
- Default pressure policy pack (urgency, discount, interruption, reminder)
- Self-host (local + Docker); optional hosted demo
- Adoption contract (`verify`, `health`)
- Node / Python / browser examples + agent-touchpoint

## v0.2.x (active / shipping)

- Publish `softstop` to the public npm registry (**done** — `softstop@0.2.1`)
- Thin agent adapters: `beforeContact` + `wrapUserFacingTool` (shipped in 0.2.1)
- Docs: [Governing AI agents](../apps/docs/start/governing-ai-agents.md) — circuit breaker, deterministic state, `suggestedActionType`, multi-agent collision

## Explicitly not v0.1 / v0.2

- MCP tool-call gateway as the homepage product
- ML personalization / send-time optimization
- Paid multi-tenant control plane / hosted policy UI

## Later (optional)

- Commercial control plane (SSO, SIEM, distributed caps, policy UI) — pull-triggered; see [commercial-strategy.md](commercial-strategy.md)
- Experimental MCP extraction remains under [archive/mcp-gateway](../archive/mcp-gateway)

### AI agent control layer (prioritized Later)

Design: [superpowers/specs/2026-08-07-ai-agent-governor-control-layer-design.md](superpowers/specs/2026-08-07-ai-agent-governor-control-layer-design.md). Pressure decay + action costs **already ship**; do not re-list them here. SoftStop does **not** claim Redis locks or race-safety on plain `check` today.

1. **P0 — Check-and-reserve / race prevention** — opt-in atomic reserve + TTL lease (10–30s), OCC on user state; compatible with existing `check` / `record`. Documented gap: [errors.md](../apps/docs/api/errors.md).
2. **P1 — Richer blocked schema + LLM helpers** — additive `retryAfterMs` / `suggestedFallback`; SDK `formatBlockedForLlm` (keep `suggestedActionType`).
3. **P2 — Latency / throughput** — instrument check P95; aspirational &lt;15–30ms local/memory; do not claim token-bucket until designed separately.
4. **P3 — Framework middlewares** — first-party Vercel AI SDK / LangChain-style adapters beyond `beforeContact` / `wrapUserFacingTool`.
5. **P4 — Hierarchical pressure scopes** — optional channel / org / thread budgets atop `tenantId` + `userId` + merge.

## Shipped after feedback (2026-08)

- **Policy-defined custom action types** — built-ins required; extras via matching keys in `costs` / `cooldownHours` / `typeCap`. See [apps/docs/policies/action-types.md](../apps/docs/policies/action-types.md) and [design spec](superpowers/specs/2026-08-06-extensible-action-types-design.md).
