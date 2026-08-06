# SoftStop × PostHog

SoftStop owns the **permit** (`check` / `record` / `merge`). PostHog **observes** outcomes and may act (surveys) — never the pressure authority.

Full design + Street Collector trial: [docs/integrations/POSTHOG_SOFTSTOP.md](https://github.com/chonibe/SoftStop/blob/main/docs/integrations/POSTHOG_SOFTSTOP.md) in the SoftStop repo.

## Identity

| State | SoftStop `userId` |
|---|---|
| Anonymous visitor | `ph:<posthog distinct_id>` |
| Logged-in shop user | `sc:<supabase uuid>` |
| Guest email | `email:<normalized>` |

On identify / login: capture SoftStop from-id **before** PostHog `identify`, then `POST /users/merge` (`ph:` or `email:` → `sc:`). Guest checkout: `ph:` → `email:`.

## Observe events (app-emitted)

| Event | When |
|---|---|
| `softstop_allowed` | check allowed |
| `softstop_blocked` | check denied |
| `softstop_merged` | identity merge |
| `softstop_unavailable` | SoftStop outage (fail-open; **no** `decision_id`) |

SDK helpers: `toSoftStopUserId`, `emitSoftStopDecisionToPostHog`, `emitSoftStopMergedToPostHog`, `emitSoftStopUnavailableToPostHog`, `SoftStop.merge`.

## Pressure Console (SoftStop-internal viz)

**Not Street Collector customer UI.** SoftStop gates in SC stay silent (check/record/merge only). Visualization is SoftStop ops:

Local: `http://localhost:3000/demo/console.html`

Look up:

- `ph:<posthog.get_distinct_id()>`
- `sc:<supabase_user_id>` after login
- `email:<normalized>` after guest identify

Optional tenant: `street-collector`. Pair with PostHog `softstop_*` events for analytics.

## Street Collector BFF

| Route | SoftStop upstream |
|---|---|
| `POST /api/softstop/check` | `POST …/check` (fail-open) |
| `POST /api/softstop/record` | `POST …/record` |
| `POST /api/softstop/merge` | `POST …/users/merge` |
| `GET /api/softstop/health` | `GET …/health` (orphan monitoring) |
| `POST /api/softstop/verify` | `POST …/verify` |

## PostHog region (Street Collector trial)

Use **EU**: `https://eu.posthog.com` / ingest `https://eu.i.posthog.com`. SC defaults to EU when `NEXT_PUBLIC_POSTHOG_HOST` is unset.

Optional draft API survey (ops / SoftStop trial only — **do not** mount SoftStop-branded survey chrome in SC shop UI): [SoftStop trial — finding art](https://eu.posthog.com/project/138294/surveys/019fccf6-ee13-0000-8bb2-cef7d4b97557). If SC later shows a native PostHog survey, call `softstopGatePostHogSurvey` silently before render.
