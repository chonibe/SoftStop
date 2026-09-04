# SoftStop launch blurbs

Post **Show HN only after** README install lines are true (npm `softstop` is published; Python is git/checkout until PyPI exists). Do not lead with “circuit breaker for outreach.”

## Show HN

**Title:** Show HN: SoftStop – shared permit when HubSpot caps miss the sequence (and the agent)

**Body:**

We kept getting the same page: customer said stop messaging me, and three systems had all “capped” them — HubSpot, Apollo, and an AI SDR whose cooldown lived in the prompt.

SoftStop is check/record on the send path. One journal per person. Not a messenger, not a CDP, not an agent firewall.

60s: chaos vs SoftStop canvas + Pressure Console — https://softstop.vercel.app  
Frequency audit checklist (list every system that can hit a contact): https://github.com/chonibe/SoftStop/blob/main/docs/FREQUENCY_AUDIT.md  
Sales agent email then marketing SMS (prints pressure): https://github.com/chonibe/SoftStop/tree/main/examples/agent-email-collision  
Repo: https://github.com/chonibe/SoftStop

## LangChain / Vercel AI SDK Discord (snippet, not manifesto)

Caps in the prompt don’t work. Gate the tool:

```js
import { SoftStop, withSoftStop } from 'softstop'
const ss = new SoftStop({ url: process.env.SOFTSTOP_API_URL })
export const execute = withSoftStop(
  async ({ userId, subject }) => sendEmail(userId, subject),
  { client: ss, userId: (a) => a.userId, actionType: 'urgency', surface: 'email', actor: 'sdr-agent' }
)
```

Blocked paths record `blocked` and return JSON (`suggestedFallback` / `retryAfterMs`) instead of retrying urgency. Collision example in the repo.

## Product Hunt (low priority vs design partners)

**Tagline:** SoftStop — shared journal when more than one system can hit a contact.

**Description:** Open-source check/record before urgency, discount, interruption, or reminder. Self-host. Live canvas + Pressure Console. Authorize only.

https://github.com/chonibe/SoftStop

## Short reply (AI SDR guardrails / over-messaging threads)

Frequency audit = list every system that can hit the contact. If that list is >1 you need a shared journal, not another sequence setting. Demo then the 15-line check/record — not a pitch deck. https://softstop.vercel.app
