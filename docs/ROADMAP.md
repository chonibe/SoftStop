# SoftStop Roadmap

## v0.1 (current launch)

**Product:** SoftStop — shared pressure / escalation permit.

- Deterministic `check` / `record` API
- Default pressure policy pack (urgency, discount, interruption, reminder)
- Self-host (local + Docker); optional hosted demo
- Adoption contract (`verify`, `health`)
- Node / Python / browser examples + agent-touchpoint

## Explicitly not v0.1

- MCP tool-call gateway as the homepage product
- ML personalization / send-time optimization
- Paid multi-tenant control plane

## Later (optional)

- Publish `@softstop/*` packages for embed
- Thin agent adapters that call SoftStop before **user-facing** escalations
- Commercial control plane (SSO, SIEM, distributed caps)
- Experimental MCP extraction remains under [archive/mcp-gateway](../archive/mcp-gateway)
