---
title: Frequency audit
description: List every system that can hit a contact. When that list is more than one, you need a shared journal — not another ESP cap.
---

# Frequency audit

HubSpot sequence caps, Apollo daily limits, and “don’t email them twice” in the agent prompt are not a frequency audit. They are per-system guesses.

**If more than one system can hit the same contact, you need a shared journal.** SoftStop is that journal: `check` before the send path, `record` after (including blocks).

- 60-second demo: [chaos vs SoftStop](https://softstop.vercel.app) · [Pressure Console](https://softstop.vercel.app/console.html)
- Repo: [sales agent email, then marketing SMS](https://github.com/chonibe/SoftStop/tree/main/examples/agent-email-collision) (prints pressure)
- Full checklist in the repo: [docs/FREQUENCY_AUDIT.md](https://github.com/chonibe/SoftStop/blob/main/docs/FREQUENCY_AUDIT.md)

## List every actor

| System | Typical owner | Shares a cap with…? |
|--------|---------------|---------------------|
| Outreach / Salesloft / Apollo | AE / SDR / RevOps | Usually only itself |
| HubSpot / Marketo journeys | Lifecycle | Usually only itself |
| Mailchimp / Klaviyo / Braze | Marketing ops | Usually only itself |
| AI SDR / sales agent | GTM eng | Prompt text — **not a cap** |
| Support bot, dunning, in-app | CS / product / finance | Almost never sales+marketing |
| Retry / failover jobs | Platform / GTM eng | Retry loops burn domains |

If “shares a cap with” is blank, write **none**. That is the finding. RevOps already calls this a frequency audit, sales+marketing collision, SDR blackout, Pressure Index. GTM eng already says guardrails on the send path, domain burn, retry loops. Platform eng: shared permit, orphan rate, self-host.

## 15-line fix on the send path

Do not put the cap in the prompt.

```js
const decision = await ss.check({ userId, actionType: 'urgency', surface: 'email' })
if (!decision.allowed) {
  await ss.record({
    decisionId: decision.decisionId, userId, actionType: 'urgency',
    outcome: 'blocked', blockReason: decision.reason
  })
  return
}
await send()
await ss.record({
  decisionId: decision.decisionId, userId, actionType: 'urgency', outcome: 'executed'
})
```

Agent tools: `withSoftStop` / `wrapUserFacingTool`. Then `POST …/verify` and `GET …/health` — **orphanRate** must stay low (&lt; 0.05). Health on one path is not an audit of every row.

## Design partners

Outreach or Apollo + Mailchimp or Klaviyo + an agent: we help wire `check`/`record`; you get a public before/after (orphan rate, blocked urgency, complaints). [Adopters](https://github.com/chonibe/SoftStop/blob/main/ADOPTERS.md).
