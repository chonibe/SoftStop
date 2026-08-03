# SoftStop Press Release

**FOR IMMEDIATE RELEASE**

**SoftStop Open Sources the Control Layer That Makes Software Stop When It Should**

*A shared permit any automation calls before raising urgency, discounts, interruptions, or reminders on a user.*

**[City, Date]** — Today, SoftStop is open-sourcing **SoftStop**, a tiny authorize-only control layer that stops automated systems from over-pushing people.

Modern products don’t fail because one message is too aggressive. They fail because many systems each push “a little,” with no shared view of how much pressure a user has already taken. Lifecycle email, upgrade modals, promo engines, and AI agents all act alone. Users feel harassed. Trust erodes. Discounts get burned. Churn shows up late.

SoftStop fills that gap. Before any system raises pressure, it asks one question:

**Is escalation allowed for this user right now?**

Via two calls:

- **check** — permit or block the escalation
- **record** — log what happened (executed, blocked, or downgraded)

SoftStop does not write copy, pick offers, or optimize conversion. It only gates escalation — across surfaces — with deterministic rules: cooldowns, per-type caps, global caps, and stack protection. No machine learning.

“Software knows how to push. It doesn’t know when to stop,” said the SoftStop maintainers. “A frequency cap inside one marketing tool can’t see your pricing rules, your in-app modal, or your merchant’s AI agent. SoftStop is the shared permit those systems call before they escalate the same human.”

**Why this matters now**

Companies already govern spam, abuse, payments, and rate limits. Escalation itself is still ungoverned — especially as platforms let many agents act on one end user. When merchant automations and platform automations collide, the brand owns the blame.

**What’s in the open-source release**

- Deterministic pressure engine for urgency, discount, interruption, and reminder
- HTTP `check` / `record` API with self-hostable storage
- Integration verification and health metrics so teams know the gate is actually adopted — not silently bypassed
- Drop-in examples for Node.js, Python, and browser surfaces
- Interactive scroll demo: feel multi-channel pressure, then SoftStop on

SoftStop is MIT-licensed. It sits under existing tools — email, SMS, in-app UI, agent workflows — without replacing them.

**Availability**

SoftStop is available now at **https://github.com/chonibe/SoftStop**.  
Live demo: **https://softstop.vercel.app**. Self-host locally or with Docker.

**Boilerplate one-liner**

> SoftStop — the shared permit before any system raises pressure on a user.
