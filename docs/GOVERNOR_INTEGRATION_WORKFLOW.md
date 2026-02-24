# Governor Integration Workflow

When the user says **"add Governor"**, **"integrate Governor"**, or **"add Governor to this project"**, follow this workflow.

## 1. Identify Project Type

- **Node.js / TypeScript / JavaScript backend** → Use `examples/nodejs/` (GovernorClient)
- **Python** → Use `examples/python/governor_client.py`
- **Browser / React / SPA / in-app** → Use `examples/browser/governor.js`

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
const GOVERNOR_API = process.env.GOVERNOR_API_URL || 'https://governer.vercel.app';

async function withGovernor(userId, actionType, surface, fn) {
  const res = await fetch(`${GOVERNOR_API}/api/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, actionType, surface })
  });
  const decision = await res.json();

  if (!decision.allowed) {
    await fetch(`${GOVERNOR_API}/api/record`, {
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
  await fetch(`${GOVERNOR_API}/api/record`, {
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
- API: `governor/README.md`

## 8. After Integration

1. Add `GOVERNOR_API_URL` to `.env` (optional; defaults to https://governer.vercel.app)
2. Run verification: `curl -X POST $GOVERNOR_API_URL/api/verify`
3. Check health: `curl $GOVERNOR_API_URL/api/health`

## Critical Rules

- **Every check must get a record** – including when blocked
- **Use stable userId** – same identifier across check and record
- **Pass blockReason when blocked** – for accurate reports
