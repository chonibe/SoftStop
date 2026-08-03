# SoftStop Roadmap

## v0.1 (shipped)

**Product:** SoftStop — shared pressure / escalation permit.

- Deterministic `check` / `record` API
- Default pressure policy pack (urgency, discount, interruption, reminder)
- Self-host (local + Docker); optional hosted demo
- Adoption contract (`verify`, `health`)
- Node / Python / browser examples + agent-touchpoint

## v0.1.x (active / shipping)

- JSON policy packs + presets (`policies/default|strict|lenient.json`)
- `SOFTSTOP_POLICY` / `SOFTSTOP_POLICY_FILE` env loading
- CLI `policy show` / `policy validate`
- SoftStop-branded before/after demo at `/demo`
- **Sample shop** (`examples/sample-shop`) + [BEFORE_AFTER.md](BEFORE_AFTER.md)
- Tightened “add SoftStop” checklist (workflow + Cursor rule) with orphanRate gate

## Explicitly not v0.1

- MCP tool-call gateway as the homepage product
- ML personalization / send-time optimization
- Paid multi-tenant control plane / hosted policy UI

## Later (optional)

- Publish `softstop` to the public npm registry (tarball + GitHub path install work today)
- Thin agent adapters that call SoftStop before **user-facing** escalations
- Commercial control plane (SSO, SIEM, distributed caps, policy UI) — pull-triggered; see [commercial-strategy.md](commercial-strategy.md)
- Experimental MCP extraction remains under [archive/mcp-gateway](../archive/mcp-gateway)
