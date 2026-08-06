# SoftStop Roadmap

## v0.2 (shipped)

**Product:** SoftStop — shared user pressure / escalation permit.

- Numeric pressure engine (`threshold`, `decayPerHour`, `costs`) + `pressure_exceeded`
- `GET /users/:userId/pressure`
- AI-wedge positioning + agent–email collision golden path

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

## Explicitly not v0.1 / v0.2

- MCP tool-call gateway as the homepage product
- ML personalization / send-time optimization
- Paid multi-tenant control plane / hosted policy UI

## Later (optional)

- Commercial control plane (SSO, SIEM, distributed caps, policy UI) — pull-triggered; see [commercial-strategy.md](commercial-strategy.md)
- Experimental MCP extraction remains under [archive/mcp-gateway](../archive/mcp-gateway)
- **Concurrent-allows hardening** — today `check` is read-only for pressure; state advances on `record`, so two simultaneous allows can both pass. Possible later: reserve-on-check or optimistic concurrency (design-partner demand only). Documented limitation: [apps/docs/api/errors.md](../apps/docs/api/errors.md)

## Shipped after feedback (2026-08)

- **Policy-defined custom action types** — built-ins required; extras via matching keys in `costs` / `cooldownHours` / `typeCap`. See [apps/docs/policies/action-types.md](../apps/docs/policies/action-types.md) and [design spec](superpowers/specs/2026-08-06-extensible-action-types-design.md).
