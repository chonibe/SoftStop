# Concept

SoftStop answers one question before an escalation runs:

> Is it allowed to raise pressure on **this user**, with **this action type**, **right now**?

**Every AI agent should ask permission before interrupting a human.** SoftStop does not rate-limit humans. It rate-limits the actors that want to reach them.

It does **not** send email, write copy, pick offers, or replace Braze / Resend / your agents. Those systems still decide *what* to say. SoftStop decides whether they’re allowed to push.

## What it does

| SoftStop does | SoftStop does not |
|---|---|
| `check` → allow or block | Send messages |
| `record` the outcome | Personalize content |
| Track **user pressure** (server-owned costs, decay, threshold) | Optimize conversion |
| Enforce cooldowns & caps across systems | MCP tool IAM / HITL approvals |

## User pressure

Every executed contact adds a **cost** (urgency 40, discount 30, interruption 25, reminder 15 by default). SoftStop decays pressure over time. If `pressure + cost > threshold` (default 100), the check returns `pressure_exceeded`.

Callers never send a cost. Costs live in the policy pack.

```bash
GET /v1/users/:userId/pressure
```

## Why it exists

Lifecycle email, pricing SMS, checkout modal, and a support agent can all hit the **same person** with no shared stop signal. SoftStop sits in the middle as a tiny authorize-only gate with compact per-user state and deterministic rules (no ML).

## Contract (v1)

1. **`check`** before escalating  
2. **`record`** after — including when blocked  
3. Correct **`actionType`**: `urgency` | `discount` | `interruption` | `reminder`  
4. Stable **`userId`** across check and record  

Local paths use `/v1/*`. Hosted demo paths use `/api/*`. Prefer self-host for production.

## Next

- [Getting started](/start/getting-started)
- [Adoption contract](/start/adoption-contract)
- [Policies](/policies/)
