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
- **[Slot Game Demo (Governor Gaming Pilot)](../demo/game/)** - Full CrownCoins slot with 5 Governor touchpoints (bonus offer, deposit nudge, win streak upsell, session reminder, free-spin purchase). See [demo/game/README.md](../demo/game/README.md) for integration patterns.

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
  "tenantId": "pilot_acme",         // Optional: Pilot/tenant ID for multi-pilot isolation (default: "default")
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
  "reason": "cooldown_active",
  "explanation": "User recently dismissed or ignored this type. Cooldown expires at 2026-01-20T10:30:00Z.",
  "cooldownUntil": "2026-01-20T10:30:00Z",
  "suggestedActionType": "reminder"
}
```

### POST `/api/record`

Record the outcome of an escalation attempt.

**Request:**
```json
{
  "decisionId": "550e8400...",       // Required: Decision ID from check()
  "userId": "user_123",              // Required: User identifier
  "tenantId": "pilot_acme",          // Optional: Must match check() for multi-pilot isolation
  "actionType": "urgency",           // Required: Same as check()
  "outcome": "executed",             // Required: executed | downgraded | blocked
  "signals": {                       // Optional: User response signals
    "dismissed": true,               // User dismissed the message
    "ignored": false,                // User ignored the message
    "hesitated": false               // User hesitated before acting
  },
  "blockReason": "cooldown_active",  // Optional: When outcome is "blocked", pass the reason from check() for audit
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

### Block Reasons (Plain Language)

| `reason` | Plain Language |
|----------|----------------|
| `cooldown_active` | User recently dismissed or ignored this type. Try again after cooldown. |
| `type_cap_reached` | Maximum allowed for this type in the last 24 hours. |
| `global_cap_reached` | Maximum total escalations (4) in the last 24 hours. |
| `recent_escalation` | Another escalation occurred in the last 10 minutes. |

### Multi-tenancy (Pilots)

Pass `tenantId` in request body (check/record) or query (`?tenantId=pilot_acme`) to isolate data per pilot. Default is `"default"`. Reports, health, decisions, and insights are scoped by tenant.

### API keys (secure report access)

For report endpoints, use a **scoped API key** instead of `tenantId` to ensure only that tenant's data is visible. Keys are derived from the key; others cannot see your data.

- **Header:** `Authorization: Bearer <key>` or `X-Governor-Key: <key>`
- **Create key:** `POST /v1/admin/keys` with `Authorization: Bearer <GOVERNOR_ADMIN_SECRET>` and body `{ "tenantId": "pilot_acme", "name": "optional" }`. Returns `{ key }` — store it; it cannot be retrieved again.
- **Env:** Set `GOVERNOR_ADMIN_SECRET` to enable the admin endpoint.
- **Pilot access:** Send pilots `https://your-domain/reports.html?key=gov_xxx` or `...#key=gov_xxx`. The key is saved in their browser; they can bookmark the page and just open it next time. Use **Forget** to clear on shared devices.

### GET `/api/report`

Admin/ops report with historical metrics.

**Query:** `?from=2026-02-01T00:00:00Z&to=2026-02-14T23:59:59Z&tenantId=pilot_acme` (optional; defaults to last 7 days, default tenant)

**Response:**
```json
{
  "ok": true,
  "report": {
    "period": { "from": "...", "to": "..." },
    "totalChecks": 1250,
    "totalOutcomes": 1180,
    "orphanCount": 70,
    "orphanRate": 0.056,
    "blocksByReason": { "cooldown_active": 45, "recent_escalation": 30 },
    "outcomesByType": { "executed": 900, "blocked": 200, "downgraded": 80 },
    "actionTypeDistribution": { "urgency": 200, "reminder": 450 }
  }
}
```

### GET `/api/report/audit`

Compliance/audit report. Same data as report, with `generatedAt` and optional CSV export.

**Query:** `?from=...&to=...&format=json|csv&tenantId=...` (format defaults to json)

### GET `/api/report/decisions`

Decision log — individual outcomes (executed, blocked, downgraded) with plain-language block reasons.

**Query:** `?from=...&to=...&limit=200&tenantId=...` (defaults to last 7 days, max 200)

**Response:** `{ ok, period, decisions: [{ createdAt, userId, actionType, eventType, blockReason?, explanationPlain? }] }`

### GET `/api/report/insights`

Adoption & integration insights — tenet-aligned recommendations (no growth/optimization). Interprets orphan rate, health score, record coverage, and block reasons.

**Query:** `?from=...&to=...&periodHours=24&tenantId=...`

**Response:** `{ ok, period, insights: [{ severity: "good"|"warning"|"critical", title, message, action? }] }`

### Common Patterns

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
- Single tenet scope (global end user only)
- Simple rule configuration (v1)

## Future improvements
- Tenet scoping (merchant_id + user_id)
- Configurable policies per surface
- Admin dashboard for policy monitoring

## Risk and Adoption

Governor protects users only when all escalation touchpoints call `check` before acting and `record` after. **Partial adoption or incorrect usage causes false confidence**: you may believe users are protected when they are not.

- **[Adoption Contract](../docs/ADOPTION_CONTRACT.md)** – When Governor protects users, what breaks when misused, and how to verify integration health
- **GET `/api/health`** – Health metrics (orphan rate, block rate, actionType distribution) to surface integration gaps
- **POST `/api/verify`** – Integration verification endpoint to validate check/record flow

## References
- Implementation: [governor/api/src/server.ts](api/src/server.ts)
- Tests: [governor/tests/rules.test.ts](tests/rules.test.ts)
- Performance tracking: [docs/perf/PERFORMANCE.md](../docs/perf/PERFORMANCE.md)
- Adoption contract: [docs/ADOPTION_CONTRACT.md](../docs/ADOPTION_CONTRACT.md)

## Version
1.0.0

## Change Log
- 1.0.0: Initial feature README.
