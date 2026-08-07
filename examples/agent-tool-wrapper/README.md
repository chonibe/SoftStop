# Agent tool wrapper

Thin SoftStop **circuit breaker** for agent tools that contact humans — the pattern to drop into an OpenAI-style / LangChain-style **function-calling loop**.

Uses shipped APIs only: `SoftStop`, `wrapUserFacingTool`, and (inline) `beforeContact`. No framework dependency required.

## Why

LLMs don’t keep reliable cooldowns. SoftStop does:

1. `check()` before the side effect (circuit breaker)  
2. `record()` after — `outcome: 'executed' | 'blocked'` (never skip on deny)  
3. Optional `suggestedActionType` so a blocked urgency/interruption can downgrade to a reminder instead of looping

## Wrap a tool

```js
const { SoftStop, wrapUserFacingTool } = require('softstop')

const sendEmail = wrapUserFacingTool(
  new SoftStop({ url: process.env.SOFTSTOP_API_URL }),
  { userId: (args) => args.userId, actionType: 'urgency', surface: 'email', actor: 'my-agent' },
  async (args) => { /* Resend / SMTP / … */ }
)
```

## In a tool / function-calling loop

```js
const { SoftStop, wrapUserFacingTool } = require('softstop')

const ss = new SoftStop({ url: process.env.SOFTSTOP_API_URL || 'http://localhost:3000' })

const tools = {
  send_follow_up_email: wrapUserFacingTool(
    ss,
    {
      userId: (args) => String(args.userId),
      actionType: 'urgency',
      surface: 'email',
      actor: 'openai-style-agent'
    },
    async ({ userId, subject }) => {
      // real send here
      return { messageId: `msg_${Date.now()}`, userId, subject }
    }
  )
}

/** Plug this into your model’s tool dispatcher */
async function handleToolCall(name, args) {
  const tool = tools[name]
  if (!tool) return { error: `unknown tool: ${name}` }

  const result = await tool(args)
  if (!result.ok) {
    // SoftStop blocked — steer the model; don’t crash or retry urgency
    return {
      blocked: true,
      reason: result.reason,
      suggestedActionType: result.suggestedActionType // e.g. 'reminder'
    }
  }
  return { ok: true, ...result.result }
}

// Example turns:
// await handleToolCall('send_follow_up_email', { userId: 'u_1', subject: 'Quick follow-up' })
// second call may return { blocked: true, suggestedActionType: 'reminder', … }
```

Inline alternative without wrapping:

```js
const gated = await ss.beforeContact(
  { userId, actionType: 'discount', surface: 'sms', actor: 'support-agent' },
  () => sendSms(userId, body)
)
if (!gated.allowed) {
  // gated.suggestedActionType
}
```

## Run

```bash
# terminal 1
pnpm --filter softstop build
pnpm dev

# terminal 2
cd examples/agent-tool-wrapper
node index.js
```

Also see:

- [Governing AI agents](../../apps/docs/start/governing-ai-agents.md) — circuit-breaker framing + optional Vercel AI SDK `tool()` sketch
- [agent-touchpoint](../agent-touchpoint) — `beforeContact` only
- [agent-email-collision](../agent-email-collision) — multi-actor pressure on one user
