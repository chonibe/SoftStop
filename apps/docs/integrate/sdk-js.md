# JS SDK

Tiny JS/TS client for SoftStop.

## Install

```bash
npm i https://softstop.vercel.app/softstop.tgz
# or from GitHub:
npm i 'github:chonibe/SoftStop#path:packages/sdk-js'
# or path checkout:
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

const ss = new SoftStop({
  url: process.env.SOFTSTOP_API_URL || 'http://localhost:3000'
})

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
  return
}

await ss.record({
  decisionId: decision.decisionId,
  userId: 'user_123',
  actionType: 'urgency',
  outcome: 'executed'
})
```

The client picks `/v1` on localhost and `/api` on hosted hosts.

## Env

- Prefer `SOFTSTOP_API_URL`
- Legacy alias: `GOVERNOR_API_URL`

## Next

- [Examples](/integrate/examples)
- [API — check](/api/check)
- [Getting started](/start/getting-started)
