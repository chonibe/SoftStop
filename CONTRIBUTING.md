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
GOVERNOR_API_URL=http://localhost:3000 pnpm governor verify
```

## Design principles

- **Authorize only.** SoftStop permits or blocks; it does not execute escalations, write copy, or pick offers.
- **Deterministic.** Rules are explicit (cooldowns, caps, stack protection). No ML in the core path.
- **Adoption verifiable.** Prefer changes that improve `verify`, `health`, and the [adoption contract](docs/ADOPTION_CONTRACT.md).
- **Storage behind interfaces.** Keep HTTP and Supabase adapters at the edges.
- **Pressure is the product.** MCP / tool-call adapters under `archive/mcp-gateway/` are experimental; do not expand them as the primary API without an explicit decision.

## Pull requests

Before opening a pull request:

- Add or update tests under `governor/tests/` for rule or API behavior.
- Document new decision reasons or config fields in `docs/default-policy-pack.md` when relevant.
- Keep examples runnable against `http://localhost:3000` with minimal setup.
- Avoid coupling the rules engine to email/SMS/UI SDKs.

## Language

Prefer: SoftStop, escalation permit, pressure gate, check/record, cooldown, frequency cap, adoption contract.

Avoid framing SoftStop as an AI safety, alignment, or model-evaluation framework. Avoid leading with “MCP firewall” unless documenting experimental adapters.
