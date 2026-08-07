# Governing AI Agents

SoftStop is the **circuit breaker** for autonomous agents and customer outreach — and for every other system that can reach the same human. Agents are the sharp wedge: LLMs guess; SoftStop trips the breaker. Email, SMS, push, and UI stay in scope as **collision partners**, not afterthoughts.

Authorize only. SoftStop does not send messages, pick offers, store journeys (not a CDP), or replace tool IAM / HITL.

## Why SoftStop for agents

1. **Agent circuit breaking** — a safety layer in tool-calling loops, not just frequency capping. Gate the side effect with `check()`; always `record()` (`executed` or `blocked`).
2. **Deterministic state for non-deterministic LLMs** — offload time/count cooldowns from the prompt. Policy and pressure live on the SoftStop server.
3. **Graceful degradation via `suggestedFallback`** — blocked tools get steering (`suggestedActionType` remains a compat alias), plus `retryAfterMs` when a cooldown/stacking window applies — not crash or retry loops.
4. **Multi-agent collision prevention** — shared per-user permit across Onboarding / Sales / Support on separate runtimes (and channels that hit the same person).

## Pillar details

### 1. Circuit breaker in the tool loop

Rogue agents, growth loops, and background jobs can spam without a shared stop signal. SoftStop sits **before** the user-facing tool:

```js
import { SoftStop, wrapUserFacingTool, formatBlockedForLlm } from 'softstop'

const ss = new SoftStop({ url: process.env.SOFTSTOP_API_URL || 'http://localhost:3000' })

const sendEmail = wrapUserFacingTool(
  ss,
  {
    userId: (args) => args.userId,
    actionType: 'urgency',
    surface: 'email',
    actor: 'sales-agent'
  },
  async (args) => {
    /* Resend / SMTP / … */
    return { messageId: '…' }
  }
)

async function runTool(name, args) {
  if (name !== 'send_follow_up_email') return { error: 'unknown tool' }
  const result = await sendEmail(args)
  if (!result.ok) {
    // SoftStop already recorded outcome: 'blocked'
    return formatBlockedForLlm(result.decision)
  }
  // SoftStop already recorded outcome: 'executed'
  return result.result
}
```

`wrapUserFacingTool` / `beforeContact` run check → handler → record. Outcomes are **`executed` | `blocked`** — never invent alternate outcome names.

### 2. Deterministic state off the prompt

Prompt memory is a bad cooldown store. Models forget, rephrase, and retry.

```js
const decision = await ss.check({
  userId,
  actionType: 'urgency',
  surface: 'email',
  actor: 'sales-agent'
})

if (!decision.allowed) {
  await ss.record({
    decisionId: decision.decisionId,
    userId,
    actionType: 'urgency',
    outcome: 'blocked',
    blockReason: decision.reason
  })
  // Prefer decision.suggestedActionType / suggestedFallback over retrying the same tool
  return
}
```

### 3. Graceful degradation

A blocked tool should not crash the loop or hammer `check` again with the same `actionType`.

When SoftStop blocks urgency or interruption, the decision may include:

- `suggestedActionType` (compat, often `reminder`)
- `suggestedFallback` — `{ strategy: "downgrade", actionType: "reminder", message? }`
- `retryAfterMs` — when a cooldown or stacking window applies

Use these to steer — then still `record` the blocked attempt if you called `check` yourself. Prefer `formatBlockedForLlm(decision)` when returning a tool result to the model.

```js
if (!decision.allowed) {
  await ss.record({
    decisionId: decision.decisionId,
    userId,
    actionType: 'urgency',
    outcome: 'blocked',
    blockReason: decision.reason
  })
  if (decision.suggestedFallback?.actionType === 'reminder') {
    // softer path, or tell the model to soft-nudge
  }
  return formatBlockedForLlm(decision)
}
```

### 4. Multi-agent collision

Onboarding, Sales, and Support often run on **separate runtimes**. Lifecycle email and product modals hit the same person with no shared stop signal.

SoftStop is one per-user permit. Golden path: [agent-email-collision](https://github.com/chonibe/SoftStop/tree/main/examples/agent-email-collision).

## Adapters

| Helper | Use when |
|---|---|
| `SoftStop#beforeContact` | Inline gate around one escalation |
| `wrapUserFacingTool` | OpenAI / LangChain / plain tools that contact humans |
| `withSoftStop` | Vercel AI SDK `tool({ execute })` (same shape for LangChain JS) |
| `formatBlockedForLlm` | Stable JSON string for LLM tool results on deny |

```js
const gated = await ss.beforeContact(
  { userId, actionType: 'discount', surface: 'sms', actor: 'support-agent' },
  () => sendSms(userId, body)
)

if (!gated.allowed) {
  console.log(gated.decision.reason, gated.suggestedActionType)
}
```

### Vercel AI SDK `tool()` (no hard dependency)

SoftStop does not depend on the AI SDK. Wrap `execute` with `withSoftStop`:

```js
import { tool } from 'ai' // your app's dependency — not SoftStop's
import { SoftStop, withSoftStop } from 'softstop'
import { z } from 'zod'

const ss = new SoftStop({ url: process.env.SOFTSTOP_API_URL })

export const sendFollowUp = tool({
  description: 'Email the user a follow-up',
  parameters: z.object({
    userId: z.string(),
    subject: z.string()
  }),
  execute: withSoftStop(
    async ({ userId, subject }) => sendEmail(userId, subject),
    {
      client: ss,
      userId: (args) => String(args.userId),
      actionType: 'urgency',
      surface: 'email',
      actor: 'vercel-ai-agent'
    }
  )
})
```

Allowed → your send result. Blocked → `formatBlockedForLlm` JSON string (record already done).

Runnable copies without framework deps: [agent-tool-wrapper](https://github.com/chonibe/SoftStop/tree/main/examples/agent-tool-wrapper), [agent-touchpoint](https://github.com/chonibe/SoftStop/tree/main/examples/agent-touchpoint).

## Orphan / record discipline

Every `check` needs a matching `record` — including blocks. Skipping `record` creates orphans and false confidence in `/health`.

- Blocked → `outcome: "blocked"` + `blockReason` from the decision  
- Executed → `outcome: "executed"` after the side effect  
- Verify with `POST …/verify`, then watch `orphanRate` on `GET …/health` (keep it low, &lt; 0.05 on observed traffic)

Systems that never call SoftStop never appear in health — wire every escalation path that can touch a human (agents **and** channels).

See [Adoption contract](/start/adoption-contract) and [Orphan rate](/ops/orphan-rate).

## Examples

| Example | What it shows |
|---|---|
| [agent-email-collision](https://github.com/chonibe/SoftStop/tree/main/examples/agent-email-collision) | Multi-actor pressure on one user |
| [agent-tool-wrapper](https://github.com/chonibe/SoftStop/tree/main/examples/agent-tool-wrapper) | `wrapUserFacingTool` + `withSoftStop` in a tool-style loop |
| [agent-touchpoint](https://github.com/chonibe/SoftStop/tree/main/examples/agent-touchpoint) | `beforeContact` before escalating a human |

## Fail-safe when SoftStop is unreachable

Agent loops need a short timeout and an explicit policy when the permit API is down:

```js
const ss = new SoftStop({
  url: process.env.SOFTSTOP_API_URL || 'http://localhost:3000',
  timeoutMs: 400,                 // default 500
  onUnavailable: 'fail_closed'    // default — throws SoftStopUnavailableError
})

// Critical path only — never silent; reason is always softstop_unavailable
const critical = new SoftStop({
  url: process.env.SOFTSTOP_API_URL,
  onUnavailable: 'fail_open',
  timeoutMs: 300
})
```

- **fail_closed** (default) — do not escalate; catch `SoftStopUnavailableError`
- **fail_open** — returns `{ allowed: true, reason: "softstop_unavailable" }` with **no** `decisionId`; skip `record()` (adapters do this for you)
- Details: [Errors — unreachable SoftStop](/api/errors#client-guidance-unreachable-softstop)

## Roadmap (not shipped)

SoftStop already gates agents with deterministic permits, structured deny fields (`suggestedFallback` / `retryAfterMs`), `formatBlockedForLlm`, `withSoftStop`, and SDK fail-safe modes. These remain **design priorities**, not product claims — see [agent control-layer design](https://github.com/chonibe/SoftStop/blob/main/docs/superpowers/specs/2026-08-07-ai-agent-governor-control-layer-design.md):

- **Atomic reserve** — check-and-reserve / short lease so concurrent agents cannot both spend the same pressure budget (today `check` is read-only; [concurrent allows](/api/errors#concurrent-allows-race))
- **Hierarchical scopes** — optional channel / thread pressure on top of today’s `tenantId` + `userId` journal (`surface` is audit metadata only)

## Python

```bash
pip install softstop
```

```python
from softstop import SoftStop, wrap_user_facing_tool

ss = SoftStop(url="http://localhost:3000")

send_email = wrap_user_facing_tool(
    ss,
    {
        "user_id": lambda args: args["user_id"],
        "action_type": "urgency",
        "surface": "email",
        "actor": "sales-agent",
    },
    lambda args: {"message_id": "…"},
)
```

See [Python SDK](/integrate/sdk-python) and [`examples/langchain-agent`](https://github.com/chonibe/SoftStop/tree/main/examples/langchain-agent).

## Next

- [Getting started](/start/getting-started)
- [JS SDK](/integrate/sdk-js)
- [Python SDK](/integrate/sdk-python)
- [Integration workflow](/integrate/workflow)
- [API — check](/api/check)
- [API — record](/api/record)
