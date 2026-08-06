# Node.js example

Uses the **softstop** SDK (`packages/sdk-js`).

```bash
# terminal 1 — repo root
pnpm install
pnpm dev

# terminal 2
cd examples/nodejs
npm install
SOFTSTOP_API_URL=http://localhost:3000 node index.js
```

Install the same client outside this monorepo:

```bash
npm i https://softstop.vercel.app/softstop.tgz
# or: npm i 'github:chonibe/SoftStop#path:packages/sdk-js'
```

```js
import { SoftStop } from 'softstop'
const ss = new SoftStop({ url: 'http://localhost:3000' })
```

Optional hosted demo: `SOFTSTOP_API_URL=https://softstop.vercel.app`.

See [../README.md](../README.md) for the shared integration pattern.
