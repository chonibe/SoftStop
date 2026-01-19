# Governor

Governor is a control layer that prevents automated systems from over-pushing users. Before any escalation (urgent email, discount offer, popup, etc.), you ask Governor: **"Is this allowed right now?"**

Governor checks per-user pressure history, enforces cooldowns, and blocks excessive escalations—no ML, just deterministic rules.

## Quick Start (5 Minutes)

### 1. Check Before Acting

```javascript
const decision = await fetch('https://governer.vercel.app/api/check', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user_123',
    actionType: 'urgency',  // urgency | discount | interruption | reminder
    surface: 'email'        // email | sms | push | in-app
  })
});

const result = await decision.json();
// { allowed: true, reason: "allowed", decisionId: "..." }

if (result.allowed) {
  // Show your message/modal/email
}
```

### 2. Record the Outcome

```javascript
await fetch('https://governer.vercel.app/api/record', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    decisionId: result.decisionId,
    userId: 'user_123',
    actionType: 'urgency',
    outcome: 'executed',  // executed | downgraded | blocked
    signals: {
      dismissed: false    // Did user dismiss it?
    }
  })
});
```

**That's it.** Governor now tracks this user's pressure and will block future escalations if limits are exceeded.

## Integration Examples

Choose your environment:

- **[Node.js Example](../examples/nodejs/)** - Server-side integration (email, SMS, background jobs)
- **[Python Example](../examples/python/)** - Python applications, Flask/Django
- **[Browser Example](../examples/browser/)** - In-app modals, popups, banners

[Full Integration Guide →](../examples/README.md)

## Feature Overview

Governor is a gate that decides if automated escalation toward an end user is allowed. It prevents pressure stacking across systems by enforcing cooldowns and caps.

## Technical implementation details
- Node.js + TypeScript HTTP service (`/v1/check`, `/v1/record`)
- Supabase Postgres for event logging and compact per-user state
- Deterministic rules engine (no ML)

## API Reference

### POST `/api/check`

Request permission for an escalation.

**Request:**
```json
{
  "userId": "user_123",              // Required: Unique user identifier
  "actionType": "urgency",           // Required: urgency | discount | interruption | reminder
  "surface": "email",                // Optional: email | sms | push | in-app
  "context": {                       // Optional: Additional context
    "campaign": "black_friday",
    "variant": "A"
  }
}
```

**Response (Allowed):**
```json
{
  "allowed": true,
  "reason": "allowed",
  "decisionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (Blocked):**
```json
{
  "allowed": false,
  "reason": "cooldown_active",       // cooldown_active | type_cap_reached | global_cap_reached | recent_escalation
  "cooldownUntil": "2026-01-20T10:30:00Z",
  "suggestedActionType": "reminder"  // Alternative action type that might be allowed
}
```

### POST `/api/record`

Record the outcome of an escalation attempt.

**Request:**
```json
{
  "decisionId": "550e8400...",       // Required: Decision ID from check()
  "userId": "user_123",              // Required: User identifier
  "actionType": "urgency",           // Required: Same as check()
  "outcome": "executed",             // Required: executed | downgraded | blocked
  "signals": {                       // Optional: User response signals
    "dismissed": true,               // User dismissed the message
    "ignored": false,                // User ignored the message
    "hesitated": false               // User hesitated before acting
  },
  "context": {                       // Optional: Additional context
    "emailId": "email_12345",
    "converted": false
  }
}
```

**Response:**
```json
{
  "ok": true
}
```

## Common Patterns

### Pattern 1: Email Campaign with Fallback

```javascript
const decision = await governor.check({
  userId: user.id,
  actionType: 'urgency',
  surface: 'email'
});

if (decision.allowed) {
  await sendEmail(user, 'urgent_sale.html');
  await governor.record({ ...decision, outcome: 'executed' });
} else if (decision.suggestedActionType === 'reminder') {
  // Downgrade to gentle reminder
  await sendEmail(user, 'gentle_reminder.html');
  await governor.record({ ...decision, outcome: 'downgraded' });
}
```

### Pattern 2: In-App Modal with Tracking

```javascript
const decision = await governor.check({
  userId: user.id,
  actionType: 'interruption',
  surface: 'in-app'
});

if (decision.allowed) {
  const modal = showUpgradeModal();
  
  modal.onDismiss = async () => {
    await governor.record({
      decisionId: decision.decisionId,
      userId: user.id,
      actionType: 'interruption',
      outcome: 'executed',
      signals: { dismissed: true }
    });
  };
}
```

### Pattern 3: Fail Open (Graceful Degradation)

```javascript
try {
  const decision = await governor.check({ userId, actionType });
  if (!decision.allowed) return;
} catch (error) {
  // If Governor is down, allow the action (fail open)
  console.error('Governor unavailable:', error);
}

// Proceed with your action
await sendNotification(userId);
```

## How Governor Decides

Governor blocks escalations based on four deterministic rules:

### 1. Cooldowns

After certain signals (dismissed, ignored, hesitated), Governor enforces a waiting period:

```
urgency      → 24 hours
discount     → 24 hours
interruption → 12 hours
reminder     → 6 hours
```

### 2. Type Caps (per 24 hours)

Maximum allowed of each type within a rolling 24-hour window:

```
urgency      → max 1 per 24h
discount     → max 1 per 24h
interruption → max 2 per 24h
reminder     → max 2 per 24h
```

### 3. Global Cap

Maximum total escalations across all types: **4 per 24 hours**

### 4. Stacking Protection

If any escalation happened in the last 10 minutes, `urgency` and `interruption` are blocked (prevents rapid-fire popups).

**Example:**
```
User dismisses upgrade modal  → interruption cooldown (12h)
30 minutes later, try urgency → BLOCKED (cooldown active)
13 hours later, try urgency   → ALLOWED (cooldown expired)
```

## Configuration

Default rules can be customized in `governor/api/src/rules/config.ts`:

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

## Database Schema

- `governor_events`: append-only log of checks and outcomes
- `governor_user_state`: compact per-user JSON state

## UI/UX considerations
Governor does not design UX. It blocks or allows escalation attempts. Any UI system should check Governor before showing interruptions, urgency, or discounts.

## Testing requirements
- Unit tests for rules engine
- API contract tests for `/v1/check` and `/v1/record`

## Deployment considerations
- Requires Supabase URL and service role key
- Stateless API process; scale horizontally

## Data fetching logic (Supabase)
- `/v1/check` reads `governor_user_state` by `user_id` and writes a `check` event to `governor_events`
- `/v1/record` appends an outcome event to `governor_events` and upserts `governor_user_state`

## Known limitations
- No ML or behavioral prediction
- Single tenant scope (global end user only)
- Simple rule configuration (v1)

## Future improvements
- Tenant scoping (merchant_id + user_id)
- Configurable policies per surface
- Admin dashboard for policy monitoring

## References
- Implementation: [governor/api/src/server.ts](api/src/server.ts)
- Tests: [governor/tests/rules.test.ts](tests/rules.test.ts)
- Performance tracking: [docs/perf/PERFORMANCE.md](../docs/perf/PERFORMANCE.md)

## Version
1.0.0

## Change Log
- 1.0.0: Initial feature README.
