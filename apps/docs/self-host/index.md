# Self-host

Self-host is the primary way to run SoftStop. The hosted demo is optional evaluation only.

## Local (fastest)

```bash
pnpm install
pnpm dev
```

Or: `docker compose up --build` — see [Docker](/self-host/docker).

Listens on `http://localhost:3000` with in-memory storage.

```bash
curl -X POST http://localhost:3000/v1/verify
SOFTSTOP_API_URL=http://localhost:3000 pnpm softstop health
```

## What to configure next

- [Docker](/self-host/docker) — compose one-liner  
- [Environment](/self-host/env) — URL, policy, port  
- [Storage](/self-host/storage) — memory vs Supabase  

## Optional hosted demo

https://softstop.vercel.app — not for production.

## Next

- [Getting started](/start/getting-started)
- [Adoption contract](/start/adoption-contract)
