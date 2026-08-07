# Environment

See `.env.example` in the repo. SoftStop names first; Governor aliases remain supported.

## Core

| Variable | Purpose |
|---|---|
| `SOFTSTOP_API_URL` / `GOVERNOR_API_URL` | Client → API base (default `http://localhost:3000`) |
| `PORT` | Server listen port (default `3000`) |
| `GOVERNOR_STORAGE=memory` | Force in-memory even if Supabase vars exist |

## Auth & tenancy

| Variable | Purpose |
|---|---|
| `SOFTSTOP_AUTH=required` | Require API key; tenant **only** from key (default when `GOVERNOR_STORAGE=supabase`) |
| `SOFTSTOP_AUTH=off` | Private single-tenant; fixed namespace (`SOFTSTOP_TENANT_ID` or `default`) |
| `SOFTSTOP_TENANT_ID` | Fixed tenant when auth is off |

Invalid or missing keys return **401**. Body/query `tenantId` is never trusted.

## Reserve (check-and-reserve)

| Variable | Purpose |
|---|---|
| (default on Supabase) | `reserveTtlMs=20000` unless turned off |
| `SOFTSTOP_RESERVE=off` | Legacy read-only check (unsafe under concurrency) |
| `SOFTSTOP_RESERVE=on` | Enable 20s reserve on memory/dev |
| `SOFTSTOP_RESERVE_TTL_MS` | Explicit TTL (wins over flags) |
| `SOFTSTOP_UNSAFE_LEGACY_CHECK=1` | Explicit unsafe legacy read-only mode |

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
