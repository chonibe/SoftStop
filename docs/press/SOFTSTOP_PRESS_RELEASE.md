# SoftStop Press Release

**FOR IMMEDIATE RELEASE**

**SoftStop Open Sources the Gate AI Agents Must Pass Before Interrupting a Human**

*A shared contact budget for agents, automations, and messaging systems. Rate-limits software that reaches people, not the people themselves.*

**[City, Date]** — SoftStop today open-sourced SoftStop, a tiny authorize-only control layer every AI agent and customer-facing system can call before emailing, texting, notifying, or otherwise interrupting a user.

Companies are shipping support bots, sales agents, marketing journeys, billing alerts, and product copilots at the same time. Each system optimizes alone. None of them share a stop signal. The result is familiar: duplicate follow-ups, conflicting offers, burned domains, and customers who feel hunted by software that never gets tired.

SoftStop does not rate-limit humans. It rate-limits the actors that want to reach them.

Before an agent or automation contacts someone, it asks SoftStop one question:

**Is this person allowed to take another contact right now?**

Two calls:

- **check** — allow or block the contact
- **record** — log whether it executed, blocked, or downgraded

```ts
const decision = await softstop.check({
  userId: customer.id,
  actionType: "urgency",
  surface: "email"
})

if (!decision.allowed) return
```

Every contact adds **user pressure** (server-owned costs). SoftStop decays that score over time and blocks the next hit when pressure plus cost would exceed your threshold.

SoftStop does not write copy, pick offers, fix deliverability, or replace human approval for dangerous tools. It only answers whether another interruption is allowed, using deterministic rules: pressure threshold and decay, plus cooldowns, per-type caps, global caps, and stack protection. No machine learning.

“Every AI agent should ask permission before interrupting a human,” said the SoftStop maintainers. “A frequency cap inside one ESP cannot see your support bot, your checkout modal, or your sales agent. SoftStop is the shared gate those systems call before they spend the same person’s attention.”

**Why this matters now**

Industry teams are already living the failure mode. Autonomous outreach burns sender reputation. Buyers recognize AI spray. Agent retries send the same email twice. Marketing, support, and AI collide on one customer record. Tools exist for spam filters, human-in-the-loop approvals, and idempotent sends. What has been missing is a shared, per-person budget for contact pressure across every actor that can reach that person.

**What’s in the open-source release**

- Numeric user pressure with threshold, decay, and server-owned costs
- Deterministic rules for urgency, discount, interruption, and reminder
- HTTP `check` / `record` / `GET .../users/:id/pressure` API with self-hostable storage
- Integration verification and health metrics so teams know the gate is actually adopted, not silently bypassed
- Examples for Node.js, Python, browser, agent touchpoints, and agent–email collision
- Interactive demo: multi-channel chaos, then SoftStop on

SoftStop is MIT-licensed. It sits under email, SMS, in-app UI, CRM automations, and agent workflows without replacing them.

**Availability**

GitHub: **https://github.com/chonibe/SoftStop**  
Live demo: **https://softstop.vercel.app**  
Self-host locally or with Docker.

**Boilerplate**

> SoftStop — every AI agent should ask permission before interrupting a human. Shared contact pressure across agents and every other system that can reach the same person.

**Media contact**  
[Name]  
[email]  
[URL]
