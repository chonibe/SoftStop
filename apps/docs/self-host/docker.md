# Docker

```bash
docker compose up --build
```

Service name: `softstop` on port `3000`.

```bash
curl -X POST http://localhost:3000/v1/verify
```

Compose file lives at the repo root (`docker-compose.yml`). For persistence, set Supabase env vars — see [Storage](/self-host/storage).

## Next

- [Environment](/self-host/env)
- [Self-host overview](/self-host/)
