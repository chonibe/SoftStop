# Getting started

## 1. Run SoftStop locally

```bash
pnpm install
pnpm dev
```

API: `http://localhost:3000` (in-memory storage by default).

**See pressure live:** open [http://localhost:3000/demo/console.html](http://localhost:3000/demo/console.html) (local uses `/v1`; hosted demo uses `/api`). Load a `userId`, then simulate urgency / discount / interruption and watch the meter.

Hosted: [https://softstop.vercel.app/console.html](https://softstop.vercel.app/console.html).

```bash
curl -X POST http://localhost:3000/v1/verify
```
## 2. Install a client

```bash
npm i softstop
```

```bash
pip install softstop
```

JS alternates: `npm i https://softstop.vercel.app/softstop.tgz` or `npm i 'github:chonibe/SoftStop#path:packages/sdk-js'`.

Python from checkout: `pip install -e ./packages/sdk-python`. Docs: [JS SDK](/integrate/sdk-js) · [Python SDK](/integrate/sdk-python).

Self-host the SoftStop API for production (`pnpm dev` / Docker). The hosted site is demo + CDN, not a production SoftStop host.
## 3. Check, then record

```js
import { SoftStop } from 'softstop'

const ss = new SoftStop({
  url: process.env.SOFTSTOP_API_URL || 'http://localhost:3000'
})

const decision = await ss.check({
  userId: 'user_123',
  actionType: 'urgency', // built-ins or policy-defined custom slugs
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

- [How a company uses SoftStop](/start/how-a-company-uses-softstop)
- [Integration workflow](/integrate/workflow)
- [Self-host](/self-host/)
- [API — check](/api/check)
