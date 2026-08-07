# Docker

One-liner from the repo root (in-memory storage, port `3000`):

```bash
docker compose up --build
```

```bash
curl -X POST http://localhost:3000/v1/verify
```

Service name: `softstop`. Image defaults to `GOVERNOR_STORAGE=memory` — no database required.

Compose file: repo root [`docker-compose.yml`](https://github.com/chonibe/SoftStop/blob/main/docker-compose.yml). Dockerfile comments document `SOFTSTOP_POLICY` / Supabase env. For persistence, see [Storage](/self-host/storage) and [Environment](/self-host/env).

## Cloud one-click / CLI

- **Railway:** deploy from the GitHub repo (root Dockerfile + `railway.toml`).
- **Fly.io:** `fly launch --copy-config` using root `fly.toml`, or the README deploy link.

Both start in memory mode. Add Supabase secrets for durable pressure state.

## Next

- [Environment](/self-host/env)
- [Self-host overview](/self-host/)
- [Performance (measured local P95)](https://github.com/chonibe/SoftStop/blob/main/docs/perf/PERFORMANCE.md)
