# Default policy pack

SoftStop v0.1 ships a deterministic **pressure** policy pack (no ML). Configuration lives in [`governor/api/src/rules/config.ts`](../governor/api/src/rules/config.ts).

## Escalation types

| Type | Default cooldown | Cap per window |
|------|------------------|----------------|
| `urgency` | 24h | 1 |
| `discount` | 24h | 1 |
| `interruption` | 12h | 2 |
| `reminder` | 6h | 2 |

## Global rules

| Rule | Default | Effect |
|------|---------|--------|
| Window | 24 hours | Rolling counts for type and global caps |
| Global cap | 4 | Max escalations of any type in the window |
| Stacking window | 10 minutes | Blocks back-to-back pressure across types |

## Decision reasons

Common `reason` values when denied:

- `cooldown_active` — type still in cooldown
- `type_cap_reached` — per-type cap hit
- `global_cap_reached` — global cap hit
- `stacking_protection` — too soon after another escalation

When urgency or interruption is blocked, the engine may suggest `reminder` as a softer alternative (`suggestedActionType`).

## What this pack is not

- Not a notification composer
- Not a discount engine
- Not an ML optimizer
- Not MCP tool authorization (see [archive/mcp-gateway](../archive/mcp-gateway))

SoftStop authorizes. Your app executes.
