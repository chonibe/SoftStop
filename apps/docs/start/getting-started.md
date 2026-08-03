# Getting started

## 1. Run SoftStop locally

```bash
pnpm install
pnpm dev
```

API: `http://localhost:3000` (in-memory storage by default).

```bash
curl -X POST http://localhost:3000/v1/verify
```

## 2. Install the JS client

```bash
npm i https://softstop.vercel.app/softstop.tgz
# or: npm i 'github:chonibe/SoftStop#path:packages/sdk-js'
```

## 3. Check, then record

```js
import { SoftStop } from 'softstop'

const ss = new SoftStop({
  url: process.env.SOFTSTOP_API_URL || 'http://localhost:3000'
})

const decision = await ss.check({
  userId: 'user_123',
  actionType: 'urgency', // urgency | discount | interruption | reminder
  surface: 'email'       // email | sms | push | in-app
})

if (!decision.allowed) {
  await ss.record({
    decisionId: decision.decisionId,
    userId: 'user_123',
    actionType: 'urgency',
    outcome: 'blocked',
    blockReason: decision.reason
  })
  return
}

// send your email / show your modal / etc.

await ss.record({
  decisionId: decision.decisionId,
  userId: 'user_123',
  actionType: 'urgency',
  outcome: 'executed'
})
```

## 4. Verify adoption

```bash
SOFTSTOP_API_URL=http://localhost:3000 pnpm softstop verify
SOFTSTOP_API_URL=http://localhost:3000 pnpm softstop health
```

Keep **orphan rate &lt; 0.05**. See the [adoption contract](/start/adoption-contract).

## Paths

| Environment | Prefix |
|---|---|
| Local (`localhost`) | `/v1` |
| Hosted demo | `/api` |

Env: prefer `SOFTSTOP_API_URL`; `GOVERNOR_API_URL` still works.

## Next

- [Integration workflow](/integrate/workflow)
- [Self-host](/self-host/)
- [API — check](/api/check)
