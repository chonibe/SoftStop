# Integration workflow

Use this checklist when adding SoftStop to a project. Do not skip verify/health.

## Checklist

1. SoftStop reachable — prefer local `pnpm dev` (`http://localhost:3000`)
2. Search escalation touchpoints
3. Every touchpoint: `check` → act or soft-stop → `record`
4. Blocked paths still `record` with `outcome: "blocked"` + `blockReason`
5. Map `actionType` correctly
6. `POST …/verify` passes
7. `GET …/health` orphanRate &lt; 0.05 (or explain remaining orphans)

## Find touchpoints

| Search for | Likely surface | Typical actionType |
|---|---|---|
| `sendEmail`, `resend`, `mailgun`, `sendgrid` | email | urgency / reminder |
| `sendSMS`, `twilio` | sms | urgency / discount |
| `showModal`, `popup`, `toast` | in-app | interruption / reminder |
| `push.send`, `FCM`, `firebase` | push | urgency / reminder |
| `createCampaign`, drip triggers | automation | urgency / discount |

List every hit before editing. Partial wiring = false confidence.

## Pattern (every touchpoint)

```js
const API =
  process.env.SOFTSTOP_API_URL ||
  process.env.GOVERNOR_API_URL ||
  'http://localhost:3000'
const prefix = /localhost|127\.0\.0\.1/.test(new URL(API).hostname) ? '/v1' : '/api'

async function withSoftStop(userId, actionType, surface, fn) {
  const res = await fetch(`${API}${prefix}/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, actionType, surface })
  })
  const decision = await res.json()

  if (!decision.allowed) {
    await fetch(`${API}${prefix}/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decisionId: decision.decisionId,
        userId,
        actionType,
        outcome: 'blocked',
        blockReason: decision.reason
      })
    })
    return { blocked: true, decision }
  }

  const result = await fn()

  await fetch(`${API}${prefix}/record`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      decisionId: decision.decisionId,
      userId,
      actionType,
      outcome: 'executed'
    })
  })

  return { blocked: false, decision, result }
}
```

## Policy

Do **not** invent per-touchpoint rules in app code. The server loads `policies/*.json` via `SOFTSTOP_POLICY` or `SOFTSTOP_POLICY_FILE`. Integrators only choose `actionType`. See [Policies](/policies/).

## Next

- [JS SDK](/integrate/sdk-js)
- [Examples](/integrate/examples)
- [Action types](/policies/action-types)
