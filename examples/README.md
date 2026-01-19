# Governor Integration Examples

This directory contains complete integration examples for Governor in different languages and environments.

## Quick Links

- [Node.js Example](nodejs/) - Server-side integration
- [Python Example](python/) - Python application integration
- [Browser Example](browser/) - Client-side JavaScript integration

## Overview

Governor is a control layer that prevents automated systems from over-pushing users. Before showing any escalation (urgency message, discount, popup, etc.), you ask Governor: "Is this allowed right now?"

Governor checks:
- ✅ User pressure history
- ✅ Cooldown periods
- ✅ Frequency caps
- ✅ Stacking protection

## Integration Pattern

All integrations follow the same two-step pattern:

### Step 1: Check Before Acting

```javascript
const decision = await governor.check({
  userId: 'user_123',
  actionType: 'urgency',  // urgency | discount | interruption | reminder
  surface: 'email'        // email | sms | push | in-app
});

if (decision.allowed) {
  // Proceed with your action
} else {
  // Respect the limit
}
```

### Step 2: Record the Outcome

```javascript
await governor.record({
  decisionId: decision.decisionId,
  userId: 'user_123',
  actionType: 'urgency',
  outcome: 'executed',  // executed | downgraded | blocked
  signals: {
    dismissed: false,   // Did user dismiss it?
    ignored: false,     // Did user ignore it?
    hesitated: false    // Did user hesitate?
  }
});
```

## Action Types

Governor recognizes four escalation types:

| Type | Description | Example Use Cases |
|------|-------------|-------------------|
| `urgency` | Time-sensitive pressure | "Only 2 left!", "Sale ends tonight!" |
| `discount` | Price reduction offers | "Get 20% off now", "Flash sale" |
| `interruption` | Modal popups, forced attention | Upgrade modal, feature announcement |
| `reminder` | Gentle nudges | "You have items in cart", "Check out our blog" |

## Surfaces

Where the escalation appears:

- `email` - Email messages
- `sms` - Text messages
- `push` - Push notifications
- `in-app` - In-app popups, modals, banners

## Examples by Language

### Node.js (Server-Side)

**Best for:** Email campaigns, SMS, server-side logic

```bash
cd examples/nodejs
npm install
node index.js
```

**Use cases:**
- Marketing email campaigns
- SMS campaigns
- Server-side upgrade prompts
- Scheduled notifications

[Full Node.js Example →](nodejs/)

---

### Python (Server-Side)

**Best for:** Python applications, Flask/Django apps, data pipelines

```bash
cd examples/python
pip install -r requirements.txt
python governor_client.py
```

**Use cases:**
- Python web applications
- Background jobs
- Email/SMS campaigns from Python
- Data-driven marketing automation

[Full Python Example →](python/)

---

### Browser (Client-Side)

**Best for:** In-app modals, popups, banners, client-side interactions

```bash
cd examples/browser
# Open index.html in your browser
# Or serve it with a local server:
python -m http.server 8000
# Visit http://localhost:8000
```

**Use cases:**
- Upgrade modals
- Feature announcements
- In-app banners
- Limited-time offers
- Onboarding prompts

[Full Browser Example →](browser/)

---

## Common Integration Patterns

### Pattern 1: Email Marketing Campaign

```javascript
async function sendCampaignEmail(userId) {
  const decision = await governor.check({
    userId,
    actionType: 'urgency',
    surface: 'email',
    context: { campaign: 'black_friday_2026' }
  });

  if (decision.allowed) {
    await sendEmail(userId, 'black_friday_urgent.html');
    await governor.record({
      decisionId: decision.decisionId,
      userId,
      actionType: 'urgency',
      outcome: 'executed'
    });
  } else {
    console.log(`Skipped email for ${userId}: ${decision.reason}`);
  }
}
```

### Pattern 2: In-App Modal

```javascript
async function showUpgradeModal(userId) {
  const decision = await governor.check({
    userId,
    actionType: 'interruption',
    surface: 'in-app'
  });

  if (decision.allowed) {
    const modal = showModal('upgrade-prompt');
    
    modal.onDismiss = async () => {
      await governor.record({
        decisionId: decision.decisionId,
        userId,
        actionType: 'interruption',
        outcome: 'executed',
        signals: { dismissed: true }
      });
    };
  }
}
```

### Pattern 3: SMS Campaign with Downgrade

```javascript
async function sendDiscountSMS(userId, discount) {
  const decision = await governor.check({
    userId,
    actionType: 'discount',
    surface: 'sms'
  });

  if (decision.allowed) {
    await sendSMS(userId, `Get ${discount}% off now!`);
    await governor.record({
      decisionId: decision.decisionId,
      userId,
      actionType: 'discount',
      outcome: 'executed'
    });
  } else if (decision.suggestedActionType === 'reminder') {
    // Downgrade to gentle reminder
    await sendSMS(userId, 'Our sale is still on');
    await governor.record({
      decisionId: decision.decisionId,
      userId,
      actionType: 'discount',
      outcome: 'downgraded'
    });
  }
}
```

## Governor Decision Logic

Governor blocks escalations based on:

### 1. Cooldowns

After certain actions, Governor enforces a waiting period:

```
urgency → 24 hours cooldown
discount → 24 hours cooldown
interruption → 12 hours cooldown
reminder → 6 hours cooldown
```

### 2. Type Caps (per 24 hours)

Maximum allowed of each type within a rolling 24-hour window:

```
urgency → max 1
discount → max 1
interruption → max 2
reminder → max 2
```

### 3. Global Cap

Maximum total escalations across all types: **4 per 24 hours**

### 4. Stacking Protection

If an escalation happened in the last 10 minutes, `urgency` and `interruption` are blocked.

## Testing Your Integration

### 1. Check API is Working

```bash
curl -X POST https://governer.vercel.app/api/check \
  -H "Content-Type: application/json" \
  -d '{"userId":"test_user","actionType":"urgency"}'
```

Expected response:
```json
{
  "allowed": true,
  "reason": "allowed",
  "decisionId": "..."
}
```

### 2. Verify in Supabase

After running your integration:
1. Go to Supabase Dashboard → Table Editor
2. Check `governor_events` for logged checks and records
3. Check `governor_user_state` for user state

### 3. Test Blocking Behavior

Run the same action twice quickly - the second should be blocked:

```bash
# First call - should be allowed
curl -X POST https://governer.vercel.app/api/check \
  -d '{"userId":"test","actionType":"urgency"}'

# Record it as executed
curl -X POST https://governer.vercel.app/api/record \
  -d '{"userId":"test","actionType":"urgency","outcome":"executed","decisionId":"..."}'

# Second call immediately - should be blocked
curl -X POST https://governer.vercel.app/api/check \
  -d '{"userId":"test","actionType":"urgency"}'
```

## Troubleshooting

### Issue: All checks return `allowed: false` immediately

**Cause:** User already hit a limit

**Fix:** Check `governor_user_state` in Supabase to see user's current state. Wait for cooldowns to expire, or test with a different `userId`.

### Issue: Checks return 500 error

**Cause:** API not configured correctly

**Fix:** 
1. Verify environment variables are set in Vercel
2. Confirm database migration was run
3. Check [SETUP.md](../SETUP.md) for configuration steps

### Issue: Records not appearing in database

**Cause:** Wrong `decisionId` or missing required fields

**Fix:** 
- Use the exact `decisionId` returned from `check()`
- Ensure `userId`, `actionType`, and `outcome` are all provided

## Next Steps

1. **Run an example:** Pick your language and run the example
2. **Integrate into your app:** Copy the client code and adapt to your use case
3. **Monitor usage:** Check Supabase dashboard to see logged events
4. **Adjust rules:** Modify `governor/api/src/rules/config.ts` if needed

## Configuration

Default rules can be customized in [`governor/api/src/rules/config.ts`](../governor/api/src/rules/config.ts):

```typescript
export const defaultRulesConfig = {
  cooldownHours: {
    urgency: 24,
    discount: 24,
    interruption: 12,
    reminder: 6
  },
  typeCap: {
    urgency: 1,
    discount: 1,
    interruption: 2,
    reminder: 2
  },
  globalCap: 4,
  windowHours: 24,
  stackingWindowMinutes: 10
};
```

## Support

- **Technical Details:** [governor/README.md](../governor/README.md)
- **Setup Guide:** [SETUP.md](../SETUP.md)
- **Concept:** [docs/CONCEPT.md](../docs/CONCEPT.md)
- **One-Pager:** [docs/ONE_PAGER.md](../docs/ONE_PAGER.md)

## License

Governor is designed for easy integration. Adapt these examples to your needs.
