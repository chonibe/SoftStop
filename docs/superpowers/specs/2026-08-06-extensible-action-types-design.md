# Extensible action types (policy-defined)

**Date:** 2026-08-06  
**Status:** Shipped (policy-defined custom action types)

## Problem

`actionType` was a closed Zod enum of four values. Orgs with legal notice, re-engagement, etc. had to force a bad mapping or skip SoftStop.

## Design (chosen)

**Policy-defined extension** — not free-form strings alone.

1. **Built-ins remain required:** `urgency`, `discount`, `interruption`, `reminder` must always be present in `costs`, `cooldownHours`, and `typeCap`.
2. **Extra types** may be added as additional keys in those three maps. All three maps must share the **same key set**.
3. **Slug rules:** `^[a-z][a-z0-9_]{0,63}$` (e.g. `legal_notice`, `reengagement`).
4. **API:** `actionType` is a string matching the slug. After schema parse, handlers reject types **not in the loaded policy** with HTTP 400.
5. **SDK:** `ActionType` widens to `string` (document built-ins + policy extras).
6. **Presets:** unchanged (four types only). Custom types live in `SOFTSTOP_POLICY_FILE` packs.

## Non-goals

- Runtime registration without policy reload
- Namespaces like `org:foo` (underscore slugs only for v1)
- Changing default preset JSON

## Tests

- Policy with `legal_notice` in all three maps loads; engine enforces its cap/cost
- Policy with extra key only in `costs` rejected
- `check` with unknown type (not in policy) → 400
- `check` with policy-defined custom type → allowed path works
