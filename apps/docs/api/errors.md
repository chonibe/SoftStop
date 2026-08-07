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

When blocked, the response includes `explanation` (plain language). For `urgency` or `interruption`, SoftStop may also return:

- `suggestedActionType: "reminder"` (compat alias)
- `suggestedFallback` — `{ strategy: "downgrade", actionType: "reminder", message? }`
- `retryAfterMs` — when a cooldown or stacking window applies

In the JS SDK, pass the decision to `formatBlockedForLlm(decision)` for a stable JSON string suitable as an LLM tool result. `withSoftStop(execute, config)` does this automatically on deny.

## HTTP status codes

Verified against SoftStop API handlers (`governor/api`):

| Status | When |
|---|---|
| `200` | Successful `check`, `record`, `release`, `health`, pressure read, etc. |
| `400` | Invalid body / params (Zod flatten on `check`/`record`/`release`; bad `actionType` slug; `actionType` not in loaded policy; missing `userId` on pressure; `release` when reserve mode is off) |
| `409` | Identity merge conflict (merge endpoint only) |
| `500` | `verify` failed (check not allowed, or check/record link not persisted) |

`check` and `record` themselves return `200` with a decision body or `{ ok: true, … }` — a block is not an HTTP error. The JS SDK throws if `response.ok` is false (network / non-2xx).

There is **no** request rate-limit (`429`) on `check`/`record` in the current API. `check`/`record` take `tenantId` from the request body when provided — they do not require an API key. (Some other routes can resolve tenant from a Bearer / `x-governor-key` when storage supports it.) `401` applies only to the admin key-creation route (`GOVERNOR_ADMIN_SECRET`), not to the permit path.

## Client guidance: unreachable SoftStop

SDKs expose explicit fail-safe knobs (JS + Python). Defaults prefer authorize-only honesty:

| Option | Values | Default | Behavior on network failure / timeout during `check` |
|---|---|---|---|
| `onUnavailable` / `on_unavailable` | `fail_closed` \| `fail_open` | `fail_closed` | **fail_closed** — throw `SoftStopUnavailableError` (never invent `allowed: true`). **fail_open** — return `{ allowed: true, reason: "softstop_unavailable" }` with **no** `decisionId`; skip `record()`. |
| `timeoutMs` / `timeout_ms` | number (ms) | `500` | Abort the HTTP request; treated as unavailable. |

```js
import { SoftStop, SoftStopUnavailableError } from 'softstop'

// Default: fail closed
const ss = new SoftStop({ url: process.env.SOFTSTOP_API_URL, timeoutMs: 400 })

// Critical path only — explicit fail-open
const critical = new SoftStop({
  url: process.env.SOFTSTOP_API_URL,
  onUnavailable: 'fail_open',
  timeoutMs: 300
})
```

```python
from softstop import SoftStop, SoftStopUnavailableError

ss = SoftStop(url="http://localhost:3000", timeout_ms=400)  # fail_closed default
critical = SoftStop(url="http://localhost:3000", on_unavailable="fail_open", timeout_ms=300)
```

Rules:

- Never invent a silent `allowed: true` unless `fail_open` is set explicitly.
- On fail-open, do **not** call `record()` (there is no `decisionId`). `beforeContact` / `before_contact` skip record automatically when `reason === "softstop_unavailable"`.
- Live API errors (`SoftStopHttpError`, e.g. 400 unknown `actionType`) are **not** converted to fail-open allows.
- After a successful server `check`, always `record` (including `outcome: "blocked"`). Crash between the two → queue a retry with the same `decisionId`.

## `decisionId` matching

Always pass the `decisionId` returned by `check` into the matching `record`. Health orphan metrics link check → outcome by that id. The `record` handler does **not** reject unknown or mismatched ids — a wrong id still writes an outcome but breaks pairing (orphans / misleading health).

## Concurrent allows (race)

`check` evaluates current state and logs a check event; by default it does **not** advance pressure. Pressure, caps, and cooldowns update on `record` when `outcome` is `executed` or `downgraded`.

**Legacy (reserve off):** two callers can both receive `allowed: true` before either records. SoftStop does not claim race-safety unless reserve is enabled. Keep send paths short and always record promptly. See [`check`](/api/check).

**With check-and-reserve enabled** (`reserveTtlMs > 0` or `SOFTSTOP_RESERVE_TTL_MS`):

- On allow, SoftStop holds the action cost in `reserves[]` until `record`, [`release`](/api/release), or TTL expiry (default **20s** when enabled via `SOFTSTOP_RESERVE=1`).
- Effective pressure = decayed ledger + active reserve costs; a concurrent check that would exceed the threshold is denied (`pressure_exceeded`).
- Allow responses include `reserveExpiresAt` (and `reserveTtlMs`).
- `record` clears the matching reserve by `decisionId`. Expired reserves are dropped lazily on the next check/record/release.
- **Strict late-record:** if the reserve TTL already expired, `executed` / `downgraded` still accept the outcome for orphan hygiene but **do not** apply pressure cost. Response includes `applied: false` and `reserveExpired: true` — re-`check` before sending again.
- When the reserve was still active, `record` returns `applied: true` (and omits `reserveExpired`).
- Crash / abort after allow: call [`POST …/release`](/api/release) to free the lease without charging pressure.
- Health exposes `expiredReserveRate` (and `expiredReserveCount`) for checks past TTL with no closing outcome — see [orphan rate](/ops/orphan-rate).
- User state uses `stateVersion` optimistic concurrency (memory + Supabase) so concurrent allows retry rather than both writing.

Enable:

```bash
# Prefer explicit TTL (15–20s is typical)
SOFTSTOP_RESERVE_TTL_MS=20000

# Or flag → 20000ms default
SOFTSTOP_RESERVE=1
```

Or set `"reserveTtlMs": 20000` in a policy JSON file. Default remains `0` (legacy read-only check).

## Env aliases

Prefer SoftStop names; legacy Governor names still work where documented:

- `SOFTSTOP_API_URL` / `GOVERNOR_API_URL`
- `SOFTSTOP_POLICY` / `GOVERNOR_POLICY`
- `SOFTSTOP_POLICY_FILE` / `GOVERNOR_POLICY_FILE`
- `SOFTSTOP_RESERVE_TTL_MS` / `SOFTSTOP_RESERVE` (opt-in check-and-reserve; see [Concurrent allows](#concurrent-allows-race))

## Next

- [check](/api/check)
- [record](/api/record)
- [release](/api/release)
- [Default pack](/policies/default-pack)
- [Troubleshooting](/ops/troubleshooting)
