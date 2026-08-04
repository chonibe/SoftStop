# SoftStop Integration Examples

Complete integration examples for SoftStop in different languages and environments.

## Quick Links

- [**Agent + email collision**](agent-email-collision/) — golden path with pressure readout (start here)
- [**Sample shop**](sample-shop/) — chaos vs SoftStop + `/health`
- [Node.js](nodejs/) — server-side integration
- [Python](python/) — Python application integration
- [Browser](browser/) — client-side JavaScript integration
- [Agent touchpoint](agent-touchpoint/) — agent calls SoftStop before escalating a user

**Local first:** set `SOFTSTOP_API_URL` or `GOVERNOR_API_URL` to `http://localhost:3000` after `pnpm dev` from the repo root. Hosted demo `https://softstop.vercel.app` is optional.

## Overview

SoftStop is a control layer that prevents automated systems from over-pushing users. Before showing any escalation (urgency message, discount, popup, etc.), ask SoftStop: "Is this allowed right now?"

SoftStop checks:

- User pressure history
- Cooldown periods
- Frequency caps
- Stacking protection

## SoftStop SDK

```bash
npm i https://softstop.vercel.app/softstop.tgz
# or: npm i 'github:chonibe/SoftStop#path:packages/sdk-js'
```

```js
import { SoftStop } from 'softstop'
const softstop = new SoftStop({ url: process.env.SOFTSTOP_API_URL || 'http://localhost:3000' })
```

Browser: `import { SoftStop } from 'https://softstop.vercel.app/sdk.js'`

## Integration Pattern

### Step 1: Check Before Acting

```javascript
const decision = await softstop.check({
  userId: 'user_123',
  actionType: 'urgency',  // urgency | discount | interruption | reminder
  surface: 'email'        // email | sms | push | in-app
});

if (decision.allowed) {
  // Proceed with your action
} else {
  // Respect the limit — still record as blocked
}
```

### Step 2: Record the Outcome

```javascript
await softstop.record({
  decisionId: decision.decisionId,
  userId: 'user_123',
  actionType: 'urgency',
  outcome: 'executed',  // executed | downgraded | blocked
  signals: {
    dismissed: false,
    ignored: false,
    hesitated: false
  }
});
```

## Action Types

| actionType | Use when |
|---|---|
| `urgency` | Time pressure |
| `discount` | Price / promo pressure |
| `interruption` | Modal / popup / forced attention |
| `reminder` | Soft nudge |

## Verify after integrating

```bash
GOVERNOR_API_URL=http://localhost:3000 pnpm governor verify
curl -X POST http://localhost:3000/v1/verify
```

See [ADOPTION_CONTRACT.md](../docs/ADOPTION_CONTRACT.md).

## Experimental MCP adapters

MCP proxy / server-wrapper READMEs under this tree are **not** SoftStop v0.1. See [archive/mcp-gateway](../archive/mcp-gateway).
