# Frequency audit checklist

HubSpot sequence caps, Apollo daily limits, and “don’t email them twice” in the agent prompt are not a frequency audit. They are per-system guesses. The person who got paged when a customer said *stop messaging me* already knows this.

**When the list below has more than one row that can hit the same contact, you need a shared journal — not another cap inside one ESP.** SoftStop is that journal: `check` before the send path, `record` after (including when you were blocked).

Live proof (60 seconds): [chaos vs SoftStop canvas](https://softstop.vercel.app) · [Pressure Console](https://softstop.vercel.app/console.html) · repo example [`examples/agent-email-collision`](../examples/agent-email-collision) (sales agent email, then marketing SMS, prints pressure).

## 1. List every system that can hit a contact

Walk the org, not the CRM. For each row: **who fires it, which identity it uses, whether it shares a cap with anyone else.**

| # | System | Typical owner | Hits contact via | Shares a cap with…? |
|---|--------|---------------|------------------|---------------------|
| 1 | Outreach / Salesloft / Apollo sequences | AE / SDR / RevOps | Email, call tasks, LinkedIn | Usually only itself |
| 2 | HubSpot / Marketo / Pardot journeys | Lifecycle / demand gen | Email, ads audiences | Usually only itself |
| 3 | Mailchimp / Klaviyo / Braze / Customer.io | Marketing ops | Email, SMS, push | Usually only itself |
| 4 | AI SDR / sales agent (Clay, custom LangChain, Vercel AI SDK, in-house) | GTM eng | Email, SMS, LinkedIn | **Prompt text. That is not a cap.** |
| 5 | Support / CS bot, billing dunning, product in-app | Support / product / finance | In-app, email, SMS | Almost never sales+marketing |
| 6 | Win-back, NPS, webinar, event follow-up | RevOps / events | Email | Often a fifth sequence on the same person |
| 7 | Retry / failover jobs | Platform / GTM eng | Same channel, same person | Retry loops burn domains |

If you cannot fill “shares a cap with,” write **none**. That is the finding.

## 2. Ask the questions RevOps already uses

- **Frequency audit:** How many distinct actors can email or text this person in 24 hours without seeing each other?
- **Sales + marketing collision:** Can an Apollo sequence and a Klaviyo flow land the same morning as the AI SDR follow-up?
- **SDR blackout:** When sales puts a domain or person on blackout, does marketing SMS still fire? Does the agent?
- **Pressure Index:** Do you have one number per person, or a spreadsheet of “we think we’re fine”?
- **Caps in the prompt don’t work:** If the model retries the tool, does the prompt cooldown still hold?

## 3. Ask the questions GTM eng already uses

- **Guardrails on the send path** — not in the prompt, not in a Slack warning after the fact.
- **Domain burn** — retries and stacked urgency after a soft bounce.
- **Retry loops** — blocked urgency that the agent immediately retries as urgency again.

Platform eng already has words for the fix: **shared permit**, **orphan rate** (`check` without `record`), **self-host**.

## 4. What to do when the list is >1

Do not invent a new SoftStop category. Wire the send path:

```js
const decision = await ss.check({ userId, actionType: 'urgency', surface: 'email' })
if (!decision.allowed) {
  await ss.record({
    decisionId: decision.decisionId, userId, actionType: 'urgency',
    outcome: 'blocked', blockReason: decision.reason
  })
  return // do not send; do not retry the same actionType
}
await send()
await ss.record({
  decisionId: decision.decisionId, userId, actionType: 'urgency', outcome: 'executed'
})
```

~15 lines. Same pattern for SMS, in-app, agent tools (`withSoftStop` / `wrapUserFacingTool`). Policy lives on the server — not a new rule per tool.

Then prove it: `POST …/verify`, `GET …/health`. **orphanRate must stay low** (< 0.05). A green health score on one path is not an audit of every row in the table.

## 5. Design-partner offer (not a pitch deck)

If you run **Outreach or Apollo + Mailchimp or Klaviyo + an agent**, we help wire `check`/`record`. You get a public before/after you can stand behind: orphan rate, blocked urgency, complaint volume. Logos beat posts.

Warm DMs: [press/DESIGN_PARTNER_DMS.md](press/DESIGN_PARTNER_DMS.md). Distribution: [DISTRIBUTION.md](DISTRIBUTION.md).
