# SoftStop policy pack

SoftStop ships a deterministic **pressure** policy pack (no ML). Tune it via JSON — no TypeScript required.

## How to load a pack

Precedence:

1. `SOFTSTOP_POLICY_FILE` or `GOVERNOR_POLICY_FILE` — path to any JSON file  
2. `SOFTSTOP_POLICY` or `GOVERNOR_POLICY` — preset name (`default` | `strict` | `lenient` | `anon-aggressive`)  
3. Built-in defaults (same as `policies/default.json`)

```bash
SOFTSTOP_POLICY=strict pnpm dev
SOFTSTOP_POLICY=anon-aggressive pnpm dev
SOFTSTOP_POLICY_FILE=./policies/lenient.json pnpm dev
pnpm governor policy validate --file policies/strict.json
curl -s http://localhost:3000/v1/policy
```

Preset files live in [`policies/`](../policies/).

| Preset | Notes |
|--------|--------|
| `default` | Production-ish baseline (`decayPerHour: 8`) |
| `strict` | Tighter caps |
| `lenient` | Looser caps |
| `anon-aggressive` | Same caps as default, `decayPerHour: 16` — good for PostHog anon trial tenants |

## JSON shape

```json
{
  "cooldownHours": {
    "urgency": 24,
    "discount": 24,
    "interruption": 12,
    "reminder": 6
  },
  "typeCap": {
    "urgency": 1,
    "discount": 1,
    "interruption": 2,
    "reminder": 2
  },
  "globalCap": 4,
  "windowHours": 24,
  "stackingWindowMinutes": 10
}
```

Canonical TypeScript type: [`GovernorRulesConfig`](../governor/api/src/rules/config.ts). Loader: [`loadPolicy.ts`](../governor/api/src/rules/loadPolicy.ts).

## Escalation types (default preset)

| Type | Default cooldown | Cap per window |
|------|------------------|----------------|
| `urgency` | 24h | 1 |
| `discount` | 24h | 1 |
| `interruption` | 12h | 2 |
| `reminder` | 6h | 2 |

## Global rules (default preset)

| Rule | Default | Effect |
|------|---------|--------|
| Window | 24 hours | Rolling counts for type and global caps |
| Global cap | 4 | Max escalations of any type in the window |
| Stacking window | 10 minutes | Blocks back-to-back hard pressure |

## Presets

| Preset | Global cap | Notes |
|--------|------------|-------|
| `default` | 4 | Production starter |
| `strict` | 2 | Longer cooldowns, lower caps |
| `lenient` | 10 | Demos / staging |

## Decision reasons

- `cooldown_active` — type still in cooldown  
- `type_cap_reached` — per-type cap hit  
- `global_cap_reached` — global cap hit  
- `recent_escalation` — stacking window (hard types)

When urgency or interruption is blocked, SoftStop may suggest `reminder` (`suggestedActionType`).

## What this pack is not

- Not a notification composer  
- Not a discount engine  
- Not an ML optimizer  
- Not MCP tool authorization (see [archive/mcp-gateway](../archive/mcp-gateway))

SoftStop authorizes. Your app executes.
