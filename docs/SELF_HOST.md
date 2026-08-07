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

See [.env.example](../.env.example) and [apps/docs/self-host/env.md](../apps/docs/self-host/env.md). Prefer `SOFTSTOP_API_URL`; `GOVERNOR_API_URL` remains supported.

**Production defaults (when using Supabase):**

- Auth required (`SOFTSTOP_AUTH=required` or storage=supabase) — tenant from API key only
- Check-and-reserve on (`SOFTSTOP_RESERVE_TTL_MS` default 20000) unless `SOFTSTOP_RESERVE=off` / `SOFTSTOP_UNSAFE_LEGACY_CHECK=1`

**Canonical runtime:** [`governor/api`](../governor/api). Apply SQL migrations under `governor/api/db/migrations` (includes Wave 2 decision lifecycle RPCs).

## Optional hosted demo

https://softstop.vercel.app — not for production.

## Adoption

After wiring touchpoints, keep orphan rate low — [ADOPTION_CONTRACT.md](ADOPTION_CONTRACT.md).
