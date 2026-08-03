# Node.js example

Local first:

```bash
# terminal 1 — repo root
pnpm install
pnpm dev

# terminal 2
cd examples/nodejs
npm install
GOVERNOR_API_URL=http://localhost:3000 node index.js
```

Optional hosted demo: `GOVERNOR_API_URL=https://softstop.vercel.app`.

See [../README.md](../README.md) for the shared integration pattern.
