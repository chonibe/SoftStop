# SoftStop packages

## Canonical (production)

| Package | Role |
|---|---|
| **[`../governor/api`](../governor/api)** | **Canonical SoftStop runtime** — check / record / release / health |
| [`sdk-js/`](./sdk-js) | Public JS/TS client (`softstop`) |
| [`sdk-python/`](./sdk-python) | Public Python client |
| [`eslint-plugin-softstop/`](./eslint-plugin-softstop) | Optional check→record hygiene lint |

```bash
npm i 'github:chonibe/SoftStop#path:packages/sdk-js'
# or: npm i https://softstop.vercel.app/softstop.tgz
```

Browser CDN: `https://softstop.vercel.app/sdk.js`

## Non-canonical / experimental (do not use for production SoftStop)

`core`, `server`, `storage`, `gateway`, and `cli` are **not** the production safety boundary. See [NON_CANONICAL.md](./NON_CANONICAL.md). SoftStop does **not** ship as an MCP tool firewall — see [archive/mcp-gateway](../archive/mcp-gateway). Root CI intentionally does not run those packages; archive/removal is follow-up work.

The public SoftStop product is the pressure permit in [`governor/`](../governor/). See [Root README](../README.md), [docs/ROADMAP.md](../docs/ROADMAP.md).
