# Contributing

SoftStop is an authorize-only control layer for escalation pressure. Contributions should keep that job sharp: decide whether urgency, discount, interruption, or reminder is allowed for a user right now — then record the outcome.

## Development

```bash
pnpm install
pnpm test:governor
pnpm typecheck
pnpm dev
```

Against a local server:

```bash
pnpm softstop verify
```

## Design principles

- **Authorize only.** SoftStop permits or blocks; it does not execute escalations, write copy, or pick offers.
- **Deterministic.** Rules are explicit (cooldowns, caps, stack protection). No ML in the core path.
- **Adoption verifiable.** Prefer changes that improve `verify`, `health`, and the [adoption contract](docs/ADOPTION_CONTRACT.md).
- **Storage behind interfaces.** Keep HTTP and Supabase adapters at the edges.
- **Pressure is the product.** MCP / tool-call adapters under `archive/mcp-gateway/` are experimental.

Note: the HTTP engine lives under `governor/` for historical reasons; the product name is SoftStop. Prefer SoftStop env names; `GOVERNOR_*` aliases remain for compatibility.

**Repo lint (not SoftStop policy):** root [`tenet-policy.json`](tenet-policy.json) configures Core/ecosystem boundary checks via `scripts/tenet-check.js`. Adopters should ignore it — runtime pressure packs live under [`policies/`](policies/).

## Pull requests

- Add or update tests under `governor/tests/` for rule or API behavior.
- Document new decision reasons in `docs/default-policy-pack.md` when relevant.
- Keep examples runnable against `http://localhost:3000`.
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Language

Prefer: SoftStop, escalation permit, pressure gate, check/record, cooldown, adoption contract.

Avoid framing SoftStop as an AI safety or MCP firewall product on the homepage.
