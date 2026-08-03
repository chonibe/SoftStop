# SoftStop Integration Workflow

When the user says **"add SoftStop"**, **"add Governor"**, **"integrate SoftStop"**, or **"add SoftStop to this project"**, follow this workflow **in order**. Do not skip verify.

Product: **SoftStop** — shared permit before raising pressure on a user.  
API: `POST …/check`, `POST …/record` (`/v1` on localhost, `/api` on hosted).

## Checklist (agent must complete)

- [ ] SoftStop reachable (`pnpm dev` or `SOFTSTOP_API_URL`)
- [ ] Touchpoints searched and listed
- [ ] Every touchpoint: `check` → act or soft-stop → `record`
- [ ] Blocked paths call `record` with `outcome: "blocked"` + `blockReason`
- [ ] `actionType` mapped correctly (not everything as `reminder`)
- [ ] `POST …/verify` passes
- [ ] `GET …/health` orphanRate &lt; 0.05 (or explain remaining orphans)

## 1. Identify Project Type

| Stack | Copy from |
|-------|-----------|
| Node / TS backend | `examples/nodejs/` or `examples/sample-shop/` |
| Python | `examples/python/governor_client.py` |
| Browser / SPA | `examples/browser/governor.js` |
| Agent that escalates a **user** | `examples/agent-touchpoint/` |

Reference write-up: [BEFORE_AFTER.md](BEFORE_AFTER.md).

## 2. Find Escalation Touchpoints

Search the codebase:

| Search for | Likely touchpoint | actionType |
|------------|-------------------|------------|
| `sendEmail`, `sendMail`, `resend`, `mailgun`, `sendgrid`, `postmark` | Email | urgency or reminder |
| `sendSMS`, `twilio`, `sendText`, `SMS` | SMS | urgency or discount |
| `showModal`, `openDialog`, `popup`, `toast`, `showNotification` | In-app | interruption or reminder |
| `push\.send`, `sendNotification`, `FCM`, `firebase` | Push | urgency or reminder |
| `createCampaign`, `sendCampaign`, `triggerDrip` | Marketing automation | urgency or discount |
| `fetch.*marketing`, `POST.*notify`, `axios.*email` | API calls | varies |

List every hit before editing. Partial wiring = false confidence.

## 3. Integration Pattern (Every Touchpoint)

1. **Check before** — `check(userId, actionType, surface)`  
2. **Record after** — `record(...)` with `executed` / `blocked` / `downgraded`  
3. **When blocked** — still `record` with `blockReason` from check  

**Policy:** Do not invent per-touchpoint rules. Server uses `policies/*.json` via `SOFTSTOP_POLICY` or `SOFTSTOP_POLICY_FILE`. Integrators only choose `actionType`. See [default-policy-pack.md](default-policy-pack.md).

## 4. actionType Mapping

| Content type | actionType |
|--------------|------------|
| Urgent / time-limited ("Only 2 left!", "Sale ends tonight!") | `urgency` |
| Discount / promo ("20% off", "Flash sale") | `discount` |
| Modal / popup / overlay / forced attention | `interruption` |
| Gentle nudge / reminder / soft CTA | `reminder` |

## 5. Surface

`email` | `sms` | `push` | `in-app`

## 6. Code Pattern (Node/JS)

```javascript
const API =
  process.env.SOFTSTOP_API_URL ||
  process.env.GOVERNOR_API_URL ||
  'http://localhost:3000';
const prefix = /localhost|127\.0\.0\.1/.test(new URL(API).hostname) ? '/v1' : '/api';

async function withSoftStop(userId, actionType, surface, fn) {
  const res = await fetch(`${API}${prefix}/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, actionType, surface })
  });
  const decision = await res.json();

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
    });
    return null; // soft stop
  }

  const result = await fn();
  await fetch(`${API}${prefix}/record`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      decisionId: decision.decisionId,
      userId,
      actionType,
      outcome: 'executed'
    })
  });
  return result;
}
```

Runnable demo of stacking: `examples/sample-shop` (`node index.js --mode=compare`).

## 7. After Integration (required)

```bash
# 1. Env
# SOFTSTOP_API_URL=http://localhost:3000

# 2. Verify API + storage
curl -X POST http://localhost:3000/v1/verify

# 3. Health — watch orphanRate
curl -s 'http://localhost:3000/v1/health?periodHours=24'
```

Or: `pnpm governor verify` and `pnpm governor health`.

Prefer self-host. Optional hosted demo: https://softstop.vercel.app

## Critical Rules

- **Every check must get a record** — including when blocked  
- **Stable userId** across check and record  
- **Pass blockReason when blocked**  
- **Never label everything `reminder`** to dodge caps  
- **If orphanRate is high**, find missing `record` calls before claiming SoftStop is live  
