---
layout: home
title: SoftStop Docs
description: Shared permit on the send path. Frequency audit when HubSpot caps miss the sequence.
hero:
  name: SoftStop
  text: Stop when it should
  tagline: Guardrails on the send path. Shared journal when sales, marketing, and agents hit the same person. Authorize only.
  actions:
    - theme: brand
      text: Get started
      link: /start/getting-started
    - theme: alt
      text: Self-host
      link: /self-host/
    - theme: alt
      text: Live demo
      link: https://softstop.vercel.app
    - theme: alt
      text: See pressure live
      link: https://softstop.vercel.app/console.html
---

<p class="ss-kicker">Browse docs</p>

<HubCards />

## Quickstart

Self-host locally, then ask SoftStop before every escalation:

```bash
pnpm install
pnpm dev   # http://localhost:3000
```

```js
import { SoftStop } from 'softstop'

const ss = new SoftStop({ url: process.env.SOFTSTOP_API_URL || 'http://localhost:3000' })
const decision = await ss.check({
  userId: 'user_123',
  actionType: 'urgency',
  surface: 'email'
})

if (!decision.allowed) {
  await ss.record({
    decisionId: decision.decisionId,
    userId: 'user_123',
    actionType: 'urgency',
    outcome: 'blocked',
    blockReason: decision.reason
  })
  return // do not escalate
}

// escalate, then:
await ss.record({
  decisionId: decision.decisionId,
  userId: 'user_123',
  actionType: 'urgency',
  outcome: 'executed'
})
```

When blocked, still call `record` with `outcome: "blocked"`. Skipping record creates orphans and false confidence.

## Start here

<ul class="ss-start-list">
  <li>
    <a href="/start/getting-started">
      Getting started
      <span>Install, first check/record, verify.</span>
    </a>
  </li>
  <li>
    <a href="/start/frequency-audit">
      Frequency audit
      <span>List every system that can hit a contact. Shared journal when the list is &gt;1.</span>
    </a>
  </li>
  <li>
    <a href="/start/governing-ai-agents">
      Governing AI agents
      <span>Send-path guardrails, deterministic state, suggestedActionType.</span>
    </a>
  </li>
  <li>
    <a href="/api/check">
      API — check
      <span>Request body, allow/block responses.</span>
    </a>
  </li>
  <li>
    <a href="/integrate/workflow">
      Integration workflow
      <span>Find touchpoints and wire them all.</span>
    </a>
  </li>
  <li>
    <a href="https://softstop.vercel.app">
      Live demo
      <span>Marketing-chaos story with SoftStop on/off.</span>
    </a>
  </li>
  <li>
    <a href="https://softstop.vercel.app/console.html">
      Pressure Console
      <span>See pressure live — meter, activity, simulate.</span>
    </a>
  </li>
</ul>
