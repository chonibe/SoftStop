# Action types

Every `check` / `record` sends an `actionType` slug. SoftStop ships **four built-ins** that every policy must define. You may add **custom types** in a policy file — they are not free-form at the API without policy keys.

## Built-ins

| actionType | Use for |
|---|---|
| `urgency` | Time pressure — “only 2 left”, “ends tonight” |
| `discount` | Promo / price incentives |
| `interruption` | Modal, popup, overlay, forced attention |
| `reminder` | Gentle nudge / soft CTA |

## Custom types (policy-defined)

Add the same key to `costs`, `cooldownHours`, and `typeCap` in your JSON pack (`SOFTSTOP_POLICY_FILE`). Slug: `^[a-z][a-z0-9_]{0,63}$` (e.g. `legal_notice`, `reengagement`).

```json
{
  "cooldownHours": {
    "urgency": 24,
    "discount": 24,
    "interruption": 12,
    "reminder": 6,
    "legal_notice": 168
  },
  "typeCap": {
    "urgency": 1,
    "discount": 1,
    "interruption": 2,
    "reminder": 2,
    "legal_notice": 1
  },
  "costs": {
    "urgency": 40,
    "discount": 30,
    "interruption": 25,
    "reminder": 15,
    "legal_notice": 10
  },
  "globalCap": 4,
  "windowHours": 24,
  "stackingWindowMinutes": 10,
  "threshold": 100,
  "decayPerHour": 8
}
```

Then:

```js
await ss.check({ userId, actionType: 'legal_notice', surface: 'email' })
```

Types **not** listed in the loaded policy return HTTP 400 (not a soft block). The JS SDK throws `SoftStopHttpError` with the API message — a typo like `urgnecy` fails loudly at the boundary, not as an obscure `reason` on an allowed check.

`ActionType` in the SDK is `BuiltinActionType | (string & {})`: builtins autocomplete; customs are allowed; typos still type-check, so prefer builtin literals in app code when you can.

## Mapping tips

| Content | Prefer |
|---|---|
| Sale ends tonight email | `urgency` |
| 20% off SMS | `discount` |
| Checkout exit-intent modal | `interruption` |
| “You left items in cart” soft email | `reminder` |
| Re-engagement / win-back | `reminder`, `discount`, or a custom `reengagement` in policy |
| Cross-sell / upsell | built-in that fits, or custom `cross_sell` |
| Legal / compliance notice | custom `legal_notice` if it should share pressure; omit SoftStop if it must always send |
| Security alert | usually **out of SoftStop** (must deliver) |

Do **not** label everything `reminder` to dodge caps — that breaks the [adoption contract](/start/adoption-contract) and shows up as a skewed `actionTypeDistribution` in [health](/api/health).

## Surfaces

Optional `surface` on `check`:

`email` | `sms` | `push` | `in-app`

Surface is metadata for analysis; policy keys off `actionType` + per-user state.

## Next

- [Default pack](/policies/default-pack)
- [Integration workflow](/integrate/workflow)
