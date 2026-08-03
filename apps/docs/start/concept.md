# Concept

SoftStop answers one question before an escalation runs:

> Is it allowed to raise pressure on **this user**, with **this action type**, **right now**?

It does **not** send email, write copy, pick offers, or replace Braze / Resend / your agents. Those systems still decide *what* to say. SoftStop decides whether they’re allowed to push.

## What it does

| SoftStop does | SoftStop does not |
|---|---|
| `check` → allow or block | Send messages |
| `record` the outcome | Personalize content |
| Enforce cooldowns & caps across systems | Optimize conversion |

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
