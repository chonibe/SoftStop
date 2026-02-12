# Governor 1-Pager (Clarity)

## Problem (WHY)
Modern products have many systems pushing users: onboarding, marketing automations, pricing rules, experiments, AI assistants, merchant workflows. Each is reasonable alone. Together they over-pressure users. Software knows how to push, not when to stop. This causes fatigue, unnecessary discounts, trust erosion, and churn discovered too late.

## Solution (WHAT)
Governor is a small, central system that decides whether automated escalation is allowed. Before any system increases pressure, it asks Governor and gets a Yes/No. Governor does not design UX, generate copy, or optimize conversion. It only permits or blocks escalation.

## Escalation (very concrete)
Escalation includes urgency messages, discounts, interruptions, repeated reminders after hesitation, or narrowing options with time pressure. It applies across UI, email, notifications, pricing, and AI-driven actions.

## How it works (HOW)
Governor stores a tiny per-user state: what pressure was applied, how often, how recently, and whether the user hesitated. Each escalation attempt calls:
`propose_action(user, actionType) -> Governor.check -> allow/deny`

If allowed, the action runs. If blocked, the action is skipped or downgraded. Governor is a gate, not a recommendation engine.

## Why Wix (the customer)
Wix is becoming a multi-agent platform. Wix runs its own automations and enables merchant-run agents that act on the same end user. This creates a new platform risk: agents collide, pressure stacks, users blame Wix, and merchants don't realize they're over-pushing. Wix already governs spam, abuse, payments, and rate limits. Escalation itself is ungoverned. Governor fills that gap.

## v1 scope
- Per-user pressure state store (no ML)
- Simple rules engine
- Permission check API
- 3-4 escalation types (urgency, discount, interruption, reminder)
- Integration with one surface (e.g., upgrade prompts)

## Why acquisition-shaped
This is platform infrastructure, not a growth tool. Most companies build it late, after damage. It is opinionated, upstream, and hard to retrofit, which makes it ideal to acquire rather than rebuild.

## References
- Implementation: [governor/api/src/server.ts](../governor/api/src/server.ts)
- Tests: [governor/tests/rules.test.ts](../governor/tests/rules.test.ts)
- Performance tracking: [docs/perf/PERFORMANCE.md](perf/PERFORMANCE.md)

## Version
1.0.0

## Change Log
- 1.0.0: Initial clarity 1-pager.
