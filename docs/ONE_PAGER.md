# SoftStop 1-Pager (Clarity)

## Problem (WHY)
Modern products have many systems pushing users: onboarding, marketing automations, pricing rules, experiments, AI assistants, merchant workflows. Each is reasonable alone. Together they over-pressure users. Software knows how to push, not when to stop. This causes fatigue, unnecessary discounts, trust erosion, and churn discovered too late.

## Solution (WHAT)
SoftStop is a small, central system that decides whether automated escalation is allowed. Before any system increases pressure, it asks SoftStop and gets a Yes/No. SoftStop does not design UX, generate copy, or optimize conversion. It only permits or blocks escalation.

## Why this matters for agents (second layer)
Your agents are individually smart. Collectively, they can still overwhelm a human — a sales follow-up, a support escalation, a retention discount, and a marketing urgency email each make sense alone; the user experiences all of them. SoftStop is the shared deterministic permit they consult before raising pressure. It doesn’t make AI smarter; it makes autonomous systems stop when they should. Not MCP permissions, guardrails, CRM, or an agent framework — a different layer.

## Escalation (very concrete)
Escalation includes urgency messages, discounts, interruptions, repeated reminders after hesitation, or narrowing options with time pressure. It applies across UI, email, notifications, pricing, and AI-driven actions.

## How it works (HOW)
SoftStop stores a tiny per-user state: what pressure was applied, how often, how recently, and whether the user hesitated. Each escalation attempt calls:
`propose_action(user, actionType) -> SoftStop.check -> allow/deny`

If allowed, the action runs. If blocked, the action is skipped or downgraded. SoftStop is a gate, not a recommendation engine.

## Why platforms care
Multi-agent platforms run their own automations and enable merchant-run agents that act on the same end user. Agents collide, pressure stacks, users blame the platform, and merchants don't realize they're over-pushing. Platforms already govern spam, abuse, payments, and rate limits. Escalation itself is ungoverned. SoftStop fills that gap.

## v1 scope
- Per-user pressure state store (no ML)
- Simple rules engine
- Permission check API
- 3-4 escalation types (urgency, discount, interruption, reminder)
- Integration with one surface (e.g., upgrade prompts)

## Why infrastructure-shaped
This is platform infrastructure, not a growth tool. Most companies build it late, after damage. It is opinionated, upstream, and hard to retrofit.

## References
- Implementation: [governor/api/src/server.ts](../governor/api/src/server.ts)
- Tests: [governor/tests/rules.test.ts](../governor/tests/rules.test.ts)
- Killer line: SoftStop doesn’t make software smarter. It makes it stop when it should.
