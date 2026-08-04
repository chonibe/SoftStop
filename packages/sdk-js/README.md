# softstop

Tiny JS/TS client for [SoftStop](https://softstop.vercel.app) — every AI agent should ask permission before interrupting a human.

## Install

```bash
npm i softstop
```

Until the package is on the public registry, use:

```bash
npm i 'github:chonibe/SoftStop#path:packages/sdk-js'
# or: npm i https://softstop.vercel.app/softstop.tgz
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

console.log(decision.pressure, decision.cost, decision.projectedPressure, decision.threshold)

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

const status = await ss.getPressure('user_123')
// { pressure, threshold, decayPerHour, costs, updatedAt }
```

### Publish prep (maintainers)

```bash
pnpm --filter softstop build
cd packages/sdk-js && npm pack --dry-run
# npm publish --access public   # requires npm token
```

Self-host the SoftStop API with `pnpm dev` in the [SoftStop repo](https://github.com/chonibe/SoftStop). Hosted demo: `https://softstop.vercel.app` (paths use `/api` instead of `/v1`).

## Agent adapters

```js
// Inline gate
await ss.beforeContact(
  { userId, actionType: 'urgency', surface: 'email', actor: 'sales-agent' },
  () => sendEmail()
)

// Wrap any user-facing tool (OpenAI / LangChain / plain)
import { wrapUserFacingTool } from 'softstop'
const sendFollowUp = wrapUserFacingTool(
  ss,
  { userId: (args) => args.userId, actionType: 'urgency', surface: 'email', actor: 'agent' },
  async (args) => { /* send */ }
)
```
