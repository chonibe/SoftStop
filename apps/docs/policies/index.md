# Policies

SoftStop enforces a deterministic **pressure** policy pack (no ML). Your app chooses `actionType`; the server applies cooldowns, caps, and stacking rules from JSON.

## Load order

1. `SOFTSTOP_POLICY_FILE` / `GOVERNOR_POLICY_FILE` — path to any JSON file  
2. `SOFTSTOP_POLICY` / `GOVERNOR_POLICY` — preset: `default` | `strict` | `lenient` | `anon-aggressive`  
3. Built-in defaults (same as `policies/default.json`)

```bash
SOFTSTOP_POLICY=strict pnpm dev
SOFTSTOP_POLICY_FILE=./policies/lenient.json pnpm dev
curl -s http://localhost:3000/v1/policy
```

Preset files live in the repo under [`policies/`](https://github.com/chonibe/SoftStop/tree/main/policies).

## Do not invent per-touchpoint rules

Integrators map content → `actionType`. Tuning belongs in the policy JSON, not scattered if-statements in email/SMS/UI code.

## Pages

- [Default pack](/policies/default-pack) — numbers and presets  
- [Action types](/policies/action-types) — how to label escalations  

## Next

- [Integration workflow](/integrate/workflow)
- [Self-host env](/self-host/env)
