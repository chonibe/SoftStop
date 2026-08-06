# Environment

See `.env.example` in the repo. SoftStop names first; Governor aliases remain supported.

## Core

| Variable | Purpose |
|---|---|
| `SOFTSTOP_API_URL` / `GOVERNOR_API_URL` | Client → API base (default `http://localhost:3000`) |
| `PORT` | Server listen port (default `3000`) |
| `GOVERNOR_STORAGE=memory` | Force in-memory even if Supabase vars exist |

## Policy

| Variable | Purpose |
|---|---|
| `SOFTSTOP_POLICY` / `GOVERNOR_POLICY` | Preset: `default` \| `strict` \| `lenient` \| `anon-aggressive` |
| `SOFTSTOP_POLICY_FILE` / `GOVERNOR_POLICY_FILE` | Path to custom JSON (wins over preset) |

```bash
SOFTSTOP_POLICY=strict pnpm dev
SOFTSTOP_POLICY_FILE=./policies/lenient.json pnpm dev
```

## Storage

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Postgres backend |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side key |

## Admin (optional)

| Variable | Purpose |
|---|---|
| `GOVERNOR_ADMIN_SECRET` | Enables scoped API key admin endpoint |

## Next

- [Storage](/self-host/storage)
- [Policies](/policies/)
