# softstop

Tiny JS/TS client for [SoftStop](https://softstop.vercel.app) — every AI agent should ask permission before interrupting a human.

## Install

```bash
npm i softstop
```

Browser (no install):

```html
<script type="module">
  import { SoftStop } from 'https://softstop.vercel.app/sdk.js'
</script>
```

Alternates: `github:chonibe/SoftStop#path:packages/sdk-js` or `https://softstop.vercel.app/softstop.tgz`.

## Usage

```js
import { SoftStop } from 'softstop'

const ss = new SoftStop({
  url: process.env.SOFTSTOP_API_URL || 'http://localhost:3000',
  // timeoutMs: 500 (default), onUnavailable: 'fail_closed' (default)
  // onUnavailable: 'fail_open' → { allowed: true, reason: 'softstop_unavailable' }; skip record
})

const decision = await ss.check({
  userId: 'user_123',
  actionType: 'urgency', // builtins + policy-defined custom slugs
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

### Identity helpers (PostHog)

```js
import {
  SoftStop,
  toSoftStopUserId,
  emitSoftStopDecisionToPostHog,
  emitSoftStopMergedToPostHog,
  emitSoftStopUnavailableToPostHog
} from 'softstop'

const anonId = toSoftStopUserId(posthog) // ph:<distinct_id>
const knownId = toSoftStopUserId(posthog, { kind: 'sc', id: user.id })

await ss.merge({ fromUserId: anonId, toUserId: knownId })
emitSoftStopMergedToPostHog(posthog.capture.bind(posthog), {
  fromUserId: anonId,
  toUserId: knownId,
  pressureAfter: 40
})

emitSoftStopDecisionToPostHog(posthog.capture.bind(posthog), {
  softstopUserId: knownId,
  actionType: 'interruption',
  surface: 'in-app',
  actor: 'posthog-survey',
  decision
})

// Fail-open: SoftStop down — never invent decisionId; skip record()
emitSoftStopUnavailableToPostHog(posthog.capture.bind(posthog), {
  actor: 'sc-promo-modal',
  actionType: 'interruption',
  softstopUserId: anonId
})
```

See [PostHog × SoftStop](../../docs/integrations/POSTHOG_SOFTSTOP.md).

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
import { wrapUserFacingTool, withSoftStop, formatBlockedForLlm } from 'softstop'
const sendFollowUp = wrapUserFacingTool(
  ss,
  { userId: (args) => args.userId, actionType: 'urgency', surface: 'email', actor: 'agent' },
  async (args) => { /* send */ }
)

// Vercel AI SDK: tool({ execute: withSoftStop(fn, { client: ss, … }) })
// On deny, withSoftStop returns formatBlockedForLlm(decision)
```
