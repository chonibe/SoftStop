# SoftStop agent touchpoint

Example pattern: an AI agent (or tool runner) is about to escalate pressure on a **human** (send urgency email, show discount, open modal). SoftStop must run **before** that user-facing action.

This is not MCP tool IAM. SoftStop gates pressure on the end user.

## Flow

```text
Agent wants to escalate user
  → SoftStop check(userId, actionType, surface)
  → if denied: record blocked; skip or downgrade
  → if allowed: perform escalation; record executed
```

## Minimal Node example

```js
const base =
  process.env.SOFTSTOP_API_URL ||
  process.env.GOVERNOR_API_URL ||
  "http://localhost:3000";
const prefix = /localhost|127\.0\.0\.1/.test(new URL(base).hostname) ? "/v1" : "/api";

async function agentEscalateUser({ userId, actionType, surface, escalate }) {
  const check = await fetch(`${base}${prefix}/check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, actionType, surface })
  }).then((r) => r.json());

  if (!check.allowed) {
    await fetch(`${base}${prefix}/record`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        decisionId: check.decisionId,
        userId,
        actionType,
        outcome: "blocked",
        blockReason: check.reason
      })
    });
    return { ok: false, reason: check.reason, suggested: check.suggestedActionType };
  }

  await escalate();

  await fetch(`${base}${prefix}/record`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      decisionId: check.decisionId,
      userId,
      actionType,
      outcome: "executed"
    })
  });

  return { ok: true };
}

// Example: agent plans a flash-sale SMS
await agentEscalateUser({
  userId: "user_123",
  actionType: "discount",
  surface: "sms",
  escalate: async () => {
    console.log("send SMS promo…");
  }
});
```

Run SoftStop locally first: `pnpm dev` from the repo root.

See also: [examples/nodejs](../nodejs), [integration workflow](../../docs/GOVERNOR_INTEGRATION_WORKFLOW.md).
