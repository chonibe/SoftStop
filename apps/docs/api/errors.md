# Errors & block reasons

## Block reasons from `check`

| `reason` | Meaning |
|---|---|
| `pressure_exceeded` | `pressure + cost` would exceed the policy threshold |
| `cooldown_active` | This action type is still in cooldown for the user |
| `type_cap_reached` | Per-type cap hit in the rolling window |
| `global_cap_reached` | Global cap across all types hit |
| `recent_escalation` | Stacking window — another hard escalation was too recent |
| `allowed` | Not a block — escalation may proceed |

When blocked, the response includes `explanation` (plain language). For `urgency` or `interruption`, SoftStop may also return `suggestedActionType: "reminder"`.

## HTTP status codes

Verified against SoftStop API handlers (`governor/api`):

| Status | When |
|---|---|
| `200` | Successful `check`, `record`, `health`, pressure read, etc. |
| `400` | Invalid body / params (Zod flatten on `check`/`record`; bad `actionType` slug; `actionType` not in loaded policy; missing `userId` on pressure) |
| `409` | Identity merge conflict (merge endpoint only) |
| `500` | `verify` failed (check not allowed, or check/record link not persisted) |

`check` and `record` themselves return `200` with a decision body or `{ ok: true, … }` — a block is not an HTTP error. The JS SDK throws if `response.ok` is false (network / non-2xx).

There is **no** request rate-limit (`429`) on `check`/`record` in the current API. `check`/`record` take `tenantId` from the request body when provided — they do not require an API key. (Some other routes can resolve tenant from a Bearer / `x-governor-key` when storage supports it.) `401` applies only to the admin key-creation route (`GOVERNOR_ADMIN_SECRET`), not to the permit path.

## Client guidance: unreachable SoftStop

SoftStop does not prescribe a built-in client policy. Recommended:

- **Fail closed or queue** — do not silently escalate without a decision.
- **Retry** transient network / 5xx with backoff; do not invent an `allowed` decision locally.
- After a successful `check`, always `record` (including `outcome: "blocked"`). Crash between the two → queue a retry with the same `decisionId`.

## `decisionId` matching

Always pass the `decisionId` returned by `check` into the matching `record`. Health orphan metrics link check → outcome by that id. The `record` handler does **not** reject unknown or mismatched ids — a wrong id still writes an outcome but breaks pairing (orphans / misleading health).

## Concurrent allows (race)

`check` evaluates current state and logs a check event; it does **not** advance pressure. Pressure, caps, and cooldowns update on `record` when `outcome` is `executed` or `downgraded`. Two callers can both receive `allowed: true` before either records. SoftStop does not claim race-safety or locking across concurrent permits — keep send paths short, and always record promptly. See [`check`](/api/check).

## Env aliases

Prefer SoftStop names; legacy Governor names still work where documented:

- `SOFTSTOP_API_URL` / `GOVERNOR_API_URL`
- `SOFTSTOP_POLICY` / `GOVERNOR_POLICY`
- `SOFTSTOP_POLICY_FILE` / `GOVERNOR_POLICY_FILE`

## Next

- [check](/api/check)
- [record](/api/record)
- [Default pack](/policies/default-pack)
- [Troubleshooting](/ops/troubleshooting)
