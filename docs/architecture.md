# Architecture

> SoftStop v0.1: the open-source product is the **escalation / pressure permit** (`check` / `record` under `governor/`). MCP tool-call gateway material is experimental — see [archive/mcp-gateway](../archive/mcp-gateway) and [ROADMAP.md](ROADMAP.md).

SoftStop is a runtime pressure gate for end-user escalations.

```text
Escalation systems -> SoftStop -> User
                         |
                         +-> Rules engine (pressure pack)
                         +-> State store
                         +-> Event / audit log
```

## Layers

### SoftStop API (`governor/`)

HTTP service that evaluates `check` requests against deterministic rules (cooldowns, type caps, global caps, stack protection), returns allow/deny, and accepts `record` outcomes. Also exposes `verify` and `health` for the adoption contract.

### Rules engine

Pure decision logic over compact per-user state. No ML. Default pack: urgency, discount, interruption, reminder.

### Storage

Interface with memory (local/dev) and Supabase/Postgres adapters for events and user state.

### SDK / CLI / examples

Thin clients and the pilot CLI (`verify`, `health`, `check`, `test`) so apps and CI can adopt SoftStop without a dashboard.

### Self-host

Primary deployment: local process or Docker beside your escalation code. Optional hosted demo for evaluation only. See [SELF_HOST.md](SELF_HOST.md).

### Experimental (`packages/`, archive)

Separate sketches for tool-call authorization. Not the SoftStop v0.1 homepage product.
