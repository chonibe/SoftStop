# Storage

## Memory (default)

Local `pnpm dev` uses in-memory storage unless Supabase vars are set. Fine for development and CI.

Force memory:

```bash
GOVERNOR_STORAGE=memory pnpm dev
```

## Supabase / Postgres

1. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`  
2. Apply migrations under `migrations/supabase/` (and/or `governor/api/db/migrations` if present)  
3. Restart the server  

SoftStop keeps:

- an append-only event log  
- compact per-user pressure state (cooldowns, counts, recency)  

Do not store raw message bodies or secrets in SoftStop context.

## Next

- [Environment](/self-host/env)
- [Security](/ops/security)
