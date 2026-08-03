# Commercial Strategy

> **v0.1 note:** Open-source launch leads with **SoftStop** — the **pressure / escalation permit** — not MCP IAM. MCP gateway positioning remains a longer-term commercial option; do not treat it as the current public product thesis. See [ROADMAP.md](ROADMAP.md).

SoftStop should launch as credibility-first commercial open source software.

The authorize-only pressure engine should be open source so engineers can inspect it, run it locally, self-host it, and embed it under email, SMS, in-app, pricing, and agent workflows.

The business is the enterprise control plane around that core (multi-tenant console, SSO, SIEM, distributed rate limits) — not a closed black-box gate for every check.

## Model

SoftStop should use a dual-layer open-core model.

### Open Source

Free forever:

- SoftStop core (deterministic pressure evaluation)
- Default escalation policy pack
- memory and local / Supabase storage adapters
- self-hosted HTTP API
- local development and CI usage (`verify`, `health`)
- examples (Node, Python, browser, agent-touchpoint)

### Commercial

Paid cloud and enterprise:

- centralized management console
- compliance-grade audit ledger
- human-in-the-loop approval workflows (optional)
- Slack, PagerDuty, ticketing, and SIEM integrations
- global distributed rate limiting
- enterprise SSO
- role-based administration
- hosted policy distribution and versioning

## Market Category

SoftStop should be positioned as a **shared pressure permit** / escalation gate for end users.

Do not market primarily as MCP IAM or agent tool firewall (crowded). First buyers are:

- platform engineers on multi-agent / multi-automation products
- product and lifecycle teams hitting cross-channel fatigue
- marketplace / multi-tenant platforms where merchant agents collide with platform automations

## Pitch

Your company already caps messages inside one CRM. It does not share pressure state with pricing rules, in-app modals, or AI agents. SoftStop is the shared permit those systems call before they escalate the same human.

## Launch Blueprint

### Phase 1: Developer Traction

- Launch SoftStop open source (pressure permit)
- Ship Node / Python / browser examples
- Publish SoftStop integration workflow and adoption contract

### Phase 2: Infrastructure Grounding

- Dockerized self-host (already in repo)
- Redis / Postgres adapters as needed
- Docs for private VPC deployment

### Phase 3: Enterprise Cloud

- SoftStop Cloud / Enterprise control plane
- SIEM streaming, SSO, policy distribution

## Why Not Closed Source

- Latency: every check should stay local / self-hosted when needed
- Data sovereignty: pressure state and user ids stay in the customer's network
- Ecosystem adoption: other tools embed an inspectable authorize-only API

Open source earns trust and distribution. The enterprise business monetizes coordination, compliance, observability, and workflow.

## Longer-term option

MCP / tool-call adapters (see [archive/mcp-gateway](../archive/mcp-gateway)) may become a second policy surface later. They are not the SoftStop v0.1 launch thesis.
