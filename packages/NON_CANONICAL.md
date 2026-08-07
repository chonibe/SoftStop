# Archived / non-canonical — do not use for production SoftStop

**Canonical SoftStop runtime:** [`governor/api`](../../governor/api) (Express handlers, rules engine, Memory + Supabase storage).

This package is an experimental extraction / historical residue. It is **not** the production stop boundary. Prefer:

- Self-host: `pnpm dev` → `governor/api`
- Client: [`packages/sdk-js`](../sdk-js) (`softstop`) or [`packages/sdk-python`](../sdk-python)
- Docs: [docs/SELF_HOST.md](../../docs/SELF_HOST.md)

MCP tool-proxy / gateway patterns are **out of SoftStop OSS core** (authorize-only product). See [archive/mcp-gateway](../../archive/mcp-gateway) and [docs/production-runtime.md](../../docs/production-runtime.md) (archived).

## CI note

Root CI (`vitest` / `pnpm test`) intentionally ignores most of `packages/{core,server,storage,gateway,cli}` — they are non-canonical. Full archive or removal is a follow-up; do not treat green CI as coverage of those packages.
