# Distribution (operator)

Do not invent a SoftStop category. Walk into rooms that already say **frequency audit**, **SDR blackout**, or **caps in the prompt don’t work**, and show the 15-line send-path fix.

## Speak their words, not ours

| Who | Their words | Ours only as follow-up |
|-----|-------------|------------------------|
| GTM eng | guardrails on the send path, domain burn, retry loops | `check` / `record`, `withSoftStop` |
| RevOps | frequency audit, sales+marketing collision, Pressure Index | shared journal, `GET …/pressure` |
| Platform eng | shared permit, orphan rate, self-host | `verify` / `health` |

Drop **“circuit breaker for outreach”** from titles and OG until people search that phrase. It can appear in body copy for search; it is not the headline.

## Where they already gather

- GTM Engineer / AI SDR Discords and Slack (gtmepulse-type), not general marketing Twitter
- HN: Show HN **only after install isn’t embarrassing** + threads where an agent burned a domain
- LangChain / Vercel AI SDK Discord: a `withSoftStop` snippet, not a manifesto (below)
- RevOps / lifecycle LinkedIn: comment on posts that already complain HubSpot caps miss sequences — audit framing, then demo
- One tight guest post or AMA in a GTM-eng newsletter, not TechCrunch

## Lead with proof they can feel in 60 seconds

1. Live demo: chaos vs SoftStop canvas + [Pressure Console](https://softstop.vercel.app/console.html)
2. One repo example: [sales agent email then marketing SMS](../examples/agent-email-collision) that prints pressure
3. One-pager: [Frequency audit checklist](FREQUENCY_AUDIT.md) — list every system that can hit a contact → SoftStop when the list is >1

That matches Pedowitz / SalesHive language (audit, collision, blackout), not a new category.

## Design partners before audience

Find **5 companies** with Outreach/Apollo + Mailchimp/Klaviyo + an agent. Offer: we help wire `check`/`record`; they get a public before/after (orphan rate, blocked urgency, complaints). Logos beat posts. Hunting ground: Clay / Apollo / Outreach. Copy: [DESIGN_PARTNER_DMS.md](press/DESIGN_PARTNER_DMS.md).

## Trust before the push

- **PyPI:** do not tell people `pip install softstop` until the project is on PyPI. Use the git subdirectory or `pip install -e ./packages/sdk-python`. npm `softstop` is published.
- **GitHub topics** (settings → Topics): `ai-agents`, `gtm`, `frequency-capping` (plus existing `softstop` if you want).
- **Discussions:** turn on in repo settings; templates live under `.github/DISCUSSION_TEMPLATE/`.
- Show HN only after the install lines in the README are true.

## Loop that compounds

| When | What |
|------|------|
| Week 1–2 | Trust fixes + [frequency audit](FREQUENCY_AUDIT.md) + Show HN (if install is honest) |
| Week 3–4 | Agent-wrapper posts in AI SDK communities + 20 warm design-partner DMs |
| Ongoing | Reply in every “AI SDR guardrails” / “over-messaging” thread with audit → demo, not a pitch deck |

## What not to do

Ads. ESP comparison charts. CDP positioning. Spray LinkedIn “we’re open source.”

You are selling to the person who got paged when customers said stop messaging me. Find them by that story.

## Discord / AI SDK snippet (`withSoftStop`)

Caps in the prompt don’t work. Gate the tool:

```js
import { SoftStop, withSoftStop } from 'softstop'
const ss = new SoftStop({ url: process.env.SOFTSTOP_API_URL })
export const execute = withSoftStop(
  async ({ userId, subject }) => sendEmail(userId, subject),
  { client: ss, userId: (a) => a.userId, actionType: 'urgency', surface: 'email', actor: 'sdr-agent' }
)
```

Blocked paths record `outcome: 'blocked'` and return JSON the model can use (`suggestedFallback` / `retryAfterMs`) instead of retrying urgency. Self-host: `pnpm dev`. Collision proof: `examples/agent-email-collision`.
