# SoftStop self-host

Self-host is the primary way to run SoftStop. The hosted demo is optional evaluation only.

## Local (fastest)

```bash
pnpm install
pnpm dev
```

Listens on `http://localhost:3000` with in-memory storage.

```bash
curl -X POST http://localhost:3000/v1/verify
GOVERNOR_API_URL=http://localhost:3000 pnpm governor verify
GOVERNOR_API_URL=http://localhost:3000 pnpm governor health
```

## Docker

```bash
docker compose up --build
```

Service name: `softstop` (port 3000).

## Persistence

Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, then apply migrations under `governor/api/db/migrations` (or `migrations/supabase/` if present).

Force memory storage: `GOVERNOR_STORAGE=memory`.

## Env

See [.env.example](../.env.example). Prefer `SOFTSTOP_API_URL`; `GOVERNOR_API_URL` remains supported.

## Optional hosted demo

https://softstop.vercel.app — not for production.

## Adoption

After wiring touchpoints, keep orphan rate low — [ADOPTION_CONTRACT.md](ADOPTION_CONTRACT.md).
