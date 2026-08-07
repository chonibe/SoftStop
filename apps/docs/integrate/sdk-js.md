# JS SDK

Tiny JS/TS client for SoftStop.

## Install

```bash
npm i softstop
```

Alternates:

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

Non-2xx responses throw `SoftStopHttpError` (`status`, `body`, message includes API `error` text) — e.g. unknown `actionType` is a clear 400, not a soft block.

### Fail-safe options

```js
import { SoftStop, SoftStopUnavailableError } from 'softstop'

const ss = new SoftStop({
  url: process.env.SOFTSTOP_API_URL || 'http://localhost:3000',
  timeoutMs: 400,              // default 500
  onUnavailable: 'fail_closed' // default — throw SoftStopUnavailableError on network/timeout
})

// Critical path only
const critical = new SoftStop({
  url: process.env.SOFTSTOP_API_URL,
  onUnavailable: 'fail_open',  // { allowed: true, reason: 'softstop_unavailable' } — no decisionId; skip record
  timeoutMs: 300
})
```

See [Errors — unreachable SoftStop](/api/errors#client-guidance-unreachable-softstop).

## Agent adapters

```js
import { SoftStop, wrapUserFacingTool, withSoftStop, formatBlockedForLlm } from 'softstop'

const ss = new SoftStop({ url: process.env.SOFTSTOP_API_URL || 'http://localhost:3000' })

// Inline: check → act → record
await ss.beforeContact(
  { userId, actionType: 'urgency', surface: 'email', actor: 'sales-agent' },
  () => sendEmail()
)

// Wrap a user-facing tool (OpenAI tools / LangChain / plain handlers)
const sendFollowUp = wrapUserFacingTool(
  ss,
  {
    userId: (args) => args.userId,
    actionType: 'urgency',
    surface: 'email',
    actor: 'sales-agent'
  },
  async (args) => { /* send */ }
)

const result = await sendFollowUp({ userId, subject: '…' })
if (!result.ok) {
  // result.reason, result.suggestedActionType — or format for the model:
  return formatBlockedForLlm(result.decision)
}

// Vercel AI SDK tool({ execute }) — zero-boilerplate
const execute = withSoftStop(
  async (args) => { /* send */ },
  {
    client: ss,
    userId: (args) => args.userId,
    actionType: 'urgency',
    surface: 'email',
    actor: 'sales-agent'
  }
)
```

Full patterns: [Governing AI agents](/start/governing-ai-agents).

## Env

- Prefer `SOFTSTOP_API_URL`
- Legacy alias: `GOVERNOR_API_URL`

## Next

- [Governing AI agents](/start/governing-ai-agents)
- [Python SDK](/integrate/sdk-python)
- [Examples](/integrate/examples)
- [API — check](/api/check)
- [Getting started](/start/getting-started)
