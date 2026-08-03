# SoftStop Integration Workflow

When the user says **"add SoftStop"**, **"add Governor"**, **"integrate SoftStop"**, or **"add SoftStop to this project"**, follow this workflow.

Product name: **SoftStop**. API paths remain `/check` and `/record` (`/v1` local, `/api` hosted).

## 1. Identify Project Type

- **Node.js / TypeScript / JavaScript backend** → Use `examples/nodejs/` (client class)
- **Python** → Use `examples/python/governor_client.py`
- **Browser / React / SPA / in-app** → Use `examples/browser/governor.js`
- **Agent that escalates a user** → Use `examples/agent-touchpoint/`

## 2. Find Escalation Touchpoints

Search the codebase for patterns that represent user pressure:

| Search for | Likely touchpoint | actionType |
|------------|-------------------|------------|
| `sendEmail`, `sendMail`, `resend`, `mailgun`, `sendgrid`, `postmark` | Email | urgency or reminder |
| `sendSMS`, `twilio`, `sendText`, `SMS` | SMS | urgency or discount |
| `showModal`, `openDialog`, `popup`, `toast`, `showNotification` | In-app | interruption or reminder |
| `push\.send`, `sendNotification`, `FCM`, `firebase` | Push | urgency or reminder |
| `createCampaign`, `sendCampaign`, `triggerDrip` | Marketing automation | urgency or discount |
| `fetch.*marketing`, `POST.*notify`, `axios.*email` | API calls | varies |

## 3. Integration Pattern (Every Touchpoint)

For **each** escalation, wrap with:

1. **Check before** – Call `check(userId, actionType, surface)` before executing
2. **Record after** – Call `record(decisionId, userId, actionType, outcome)` after (or when blocked)
3. **When blocked** – Pass `blockReason` from check for accurate audit reports

**Policy:** SoftStop uses the default pack unless the server was started with `SOFTSTOP_POLICY` / `SOFTSTOP_POLICY_FILE` (presets in `policies/*.json`). Integrators usually do not change policy per touchpoint — they pick the right `actionType`. See [default-policy-pack.md](default-policy-pack.md).

## 4. actionType Mapping

| Content type | actionType |
|--------------|------------|
| Urgent / time-limited ("Only 2 left!", "Sale ends tonight!") | `urgency` |
| Discount / promo ("20% off", "Flash sale") | `discount` |
| Modal / popup / overlay / forced attention | `interruption` |
| Gentle nudge / reminder / soft CTA | `reminder` |

## 5. Surface

Where it appears: `email` | `sms` | `push` | `in-app`

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
    return null;
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

Or inline per touchpoint – see `examples/README.md`.

## 7. Client References

- Node: `examples/nodejs/index.js`
- Python: `examples/python/governor_client.py`
- Browser: `examples/browser/governor.js`
- Agent touchpoint: `examples/agent-touchpoint/`
- API: `governor/README.md`

## 8. After Integration

1. Add `SOFTSTOP_API_URL` or `GOVERNOR_API_URL` to `.env` (default local: `http://localhost:3000`)
2. Run verification: `curl -X POST $GOVERNOR_API_URL/v1/verify` (use `/api/verify` on hosted)
3. Check health: `curl "$GOVERNOR_API_URL/v1/health"`

Prefer self-host. Optional hosted demo: https://softstop.vercel.app

## Critical Rules

- **Every check must get a record** – including when blocked
- **Use stable userId** – same identifier across check and record
- **Pass blockReason when blocked** – for accurate reports
