# Commercial Strategy

> **v0.1 note:** Open-source launch leads with **SoftStop** — the **pressure / escalation permit** — not MCP IAM. MCP gateway positioning remains a longer-term commercial option; do not treat it as the current public product thesis. See [ROADMAP.md](ROADMAP.md).

## Decision (locked)

**Posture: standard-first, Cloud-optional.**

Optimize for SoftStop becoming the named shared permit teams call before escalating. Treat paid Cloud as upside, not the survival plan. The core is easy to reproduce; that is accepted. Value is adoption and coordination, not proprietary cooldowns.

### Best case

SoftStop embeds across email, SMS, product UI, and agents. “Call SoftStop before you escalate” becomes habit. Multi-team orgs pull a control plane (policy UI, audit, SSO, distributed caps) because org complexity hurts more than DIY.

### Worst case (accepted)

Nobody pays. Teams use OSS SoftStop, fork it, or rebuild a tiny internal permit. SoftStop still works as an open tool, credibility asset, and optional integration/consulting surface. That outcome is OK.

### Operating rules

| Do | Don’t |
|---|---|
| Keep core MIT, self-host-first, simple `check` / `record` | Gate the hot path on Cloud |
| Win on adoption (examples, `verify` / `health`, orphanRate, agent/Cursor install) | Build SSO/console before real embeds exist |
| Leave seams for Cloud later (tenant id, policy version, audit export hooks) | Bet the company on license fees for a simple gate |
| Measure success as **integrations that stick** first; ARR second | Treat “easy to clone” as failure — it is the distribution tax |

## Model

Dual-layer open-core. Enforcement stays local; management is optional and paid.

```text
Escalation systems --> SoftStop (self-hosted) --> allow / block
                              |
                     async sync / export (optional)
                              |
                       SoftStop Cloud (paid)
```

### Open Source (free forever)

- SoftStop core (deterministic pressure evaluation)
- Default escalation policy pack
- memory and local / Supabase storage adapters
- self-hosted HTTP API
- local development and CI usage (`verify`, `health`)
- examples (Node, Python, browser, agent-touchpoint)

### Commercial (build only when pulled)

- centralized management console / policy UI
- compliance-grade audit ledger
- Slack, PagerDuty, ticketing, and SIEM integrations
- global / cross-team distributed rate limiting
- enterprise SSO and role-based administration
- hosted policy distribution and versioning
- human-in-the-loop approval workflows (optional)

Cloud must not be required for ordinary low-latency checks. Cached / local policy must keep working if Cloud is unreachable.

## Market (their words)

Do not invent a SoftStop category. Show up where people already say **frequency audit**, **SDR blackout**, or **caps in the prompt don’t work**.

| Room | Vocabulary |
|------|------------|
| GTM eng | guardrails on the send path, domain burn, retry loops |
| RevOps | frequency audit, sales+marketing collision, Pressure Index |
| Platform eng | shared permit, orphan rate, self-host |

First adopters: teams with **Outreach/Apollo + Mailchimp/Klaviyo + an agent**. Operator playbook: [DISTRIBUTION.md](DISTRIBUTION.md). Checklist: [FREQUENCY_AUDIT.md](FREQUENCY_AUDIT.md).

## Pitch

Your company already caps messages inside one CRM. It does not share pressure with Klaviyo, the in-app modal, or the AI SDR. SoftStop is the shared journal those systems call before they escalate the same human.

## Launch Blueprint

### Phase 1: Developer Traction (current focus)

- SoftStop open source (pressure permit)
- Node / Python / browser / agent-touchpoint examples
- Integration workflow and adoption contract
- Make embed cheaper than reinventing the wiring

### Phase 2: Infrastructure Grounding

- Dockerized self-host (already in repo)
- Redis / Postgres adapters as needed
- Docs for private VPC deployment
- Light Cloud seams only (tenant, policy version, audit export) — not a full console

### Phase 3: Enterprise Cloud (pull-triggered)

- SoftStop Cloud / control plane
- SIEM streaming, SSO, policy distribution, distributed caps
- Start only when real multi-team embeds ask for it

## Why Not Closed Source

- Latency: every check should stay local / self-hosted when needed
- Data sovereignty: pressure state and user ids stay in the customer's network
- Ecosystem adoption: other tools embed an inspectable authorize-only API

Open source earns trust and distribution. If anyone pays, they pay for coordination, compliance, observability, and multi-team workflow — not for hiding the permit logic.

## Defensibility note

Reproducing cooldowns and caps is easy. Wiring every touchpoint to one gate with `record`, low orphan rate, and one policy story is not. SoftStop competes on being the standard and the cheapest path to that wiring — not on secrecy.

## Longer-term option

MCP / tool-call adapters (see [archive/mcp-gateway](../archive/mcp-gateway)) may become a second policy surface later. They are not the SoftStop v0.1 launch thesis.
