# softstop

Tiny JS/TS client for [SoftStop](https://softstop.vercel.app) — the authorize-only permit before any system raises pressure on a user.

## Install

Not on the public npm registry yet. Install from GitHub (works today):

```bash
npm i 'github:chonibe/SoftStop#path:packages/sdk-js'
```

Or from a path checkout of this repo:

```bash
npm i ./packages/sdk-js
```

Browser (no install):

```html
<script type="module">
  import { SoftStop } from 'https://softstop.vercel.app/sdk.js'
</script>
```

## Usage

```js
import { SoftStop } from 'softstop'

const ss = new SoftStop({ url: process.env.SOFTSTOP_API_URL || 'http://localhost:3000' })

const decision = await ss.check({
  userId: 'user_123',
  actionType: 'urgency', // urgency | discount | interruption | reminder
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

Self-host the SoftStop API with `pnpm dev` in the [SoftStop repo](https://github.com/chonibe/SoftStop). Hosted demo: `https://softstop.vercel.app` (paths use `/api` instead of `/v1`).
