# Action types

Every `check` / `record` must use one of:

| actionType | Use for |
|---|---|
| `urgency` | Time pressure — “only 2 left”, “ends tonight” |
| `discount` | Promo / price incentives |
| `interruption` | Modal, popup, overlay, forced attention |
| `reminder` | Gentle nudge / soft CTA |

## Mapping tips

| Content | Prefer |
|---|---|
| Sale ends tonight email | `urgency` |
| 20% off SMS | `discount` |
| Checkout exit-intent modal | `interruption` |
| “You left items in cart” soft email | `reminder` |

Do **not** label everything `reminder` to dodge caps — that breaks the [adoption contract](/start/adoption-contract) and shows up as a skewed `actionTypeDistribution` in [health](/api/health).

## Surfaces

Optional `surface` on `check`:

`email` | `sms` | `push` | `in-app`

Surface is metadata for analysis; policy keys off `actionType` + per-user state.

## Next

- [Default pack](/policies/default-pack)
- [Integration workflow](/integrate/workflow)
