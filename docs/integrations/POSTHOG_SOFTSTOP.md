# SoftStop × PostHog — Design & Street Collector Trial

**Status:** Phase 1–3 implemented (week-1 + ops/identity + expanded actors)  
**Date:** 2026-08-04  
**Product lock:** SoftStop owns the **user pressure** journal and the permit (`check` / `record` / `merge`). PostHog **observes** and/or **consults** SoftStop. Do **not** put the permit inside PostHog.

### Locked / confirmed

| Decision | Value |
|----------|--------|
| Approach | **B** — app-side SoftStop + PostHog observe |
| PostHog region | **EU** — project `138294`, host `eu.posthog.com` / ingest `https://eu.i.posthog.com` |
| Identity | `ph:` → merge to `sc:` (sum decayed pressure, capped); tombstone anon |
| Fail mode (shop) | Fail-open |
| Browser auth | Next.js BFF (`/api/softstop/*`) |

### Implementation notes / deviations

- SoftStop-core: `POST /v1/users/merge` (also `/api/users/merge`), memory + Supabase state JSON (no schema migration; `merged` event_type is free-form text).
- Policy preset: `anon-aggressive` (`decayPerHour: 16`).
- SDK: `toSoftStopUserId`, `merge()`, `emitSoftStopDecisionToPostHog`, `emitSoftStopUnavailableToPostHog`.
- SC (`coa-service-main`): BFF (check/record/merge/**health**/**verify**) + identify merge (pre-identify) + guest email merge + **silent** gates on watchlist email, welcome incentive, URL-param modal. **No SoftStop-branded customer UI.** **Does not claim full adoption.**
- SC PostHog host default is now **EU** (`https://eu.i.posthog.com`) when unset; `.env.example` / Vercel prod already EU.
- **Visualization is SoftStop-internal only:** Pressure Console (`demo/console.html`) + PostHog `softstop_*` events — never SoftStop chrome in SC shop.
- SoftStop trial modal / SoftStopPostHogSurvey UI were removed from SC providers (week-1 demo actors only; not product UX).
- PostHog **API survey draft** (ops): [SoftStop trial — finding art](https://eu.posthog.com/project/138294/surveys/019fccf6-ee13-0000-8bb2-cef7d4b97557) — if SC later renders a native survey, gate via `softstopGatePostHogSurvey()` with **no SoftStop branding**.

---

## Intent (refined)

Enable Street Collector (brand/commerce) to try SoftStop with their existing PostHog setup so that:

1. Site-side pressure (interruptive SC UX, emails) asks SoftStop **silently** before reaching a human — SoftStop is not visible in SC customer UI.
2. Anonymous PostHog visitors get a SoftStop journal bootstrapped from `distinct_id`.
3. On login / identify, that anon journal **merges** into the known user so email/CRM actors see prior site pressure.
4. PostHog remains analytics + (optionally) an **actor** — never the pressure authority.
5. **Ops visualization** lives in SoftStop Pressure Console + PostHog `softstop_*` events — not in Street Collector product chrome.

**Non-goals for this trial:** SoftStop-branded modals/surveys/console links on SC customer-facing pages (**SoftStop UI must never appear in SC**); gating pageviews/autocapture; replacing Klaviyo/Braze frequency caps globally; putting SoftStop logic in a PostHog Destination as the permit path.

---

## Approaches considered

| Approach | Idea | Pros | Cons |
|----------|------|------|------|
| **A. PostHog Destination as permit** | Destination/webhook calls SoftStop when survey/flag fires | Less app code | Destinations are usually *after* the event; cannot reliably *block* display; puts control plane near PostHog; fails product lock spirit |
| **B. App-side SoftStop + PostHog observe** *(recommended)* | SC (and PostHog JS survey render hooks) call SoftStop `check`/`record`; emit SoftStop outcomes as PostHog events; SoftStop `merge` on identify | SoftStop owns journal; works with SC’s existing `lib/posthog.ts`; trialable this week; correct fail-open story | Needs SoftStop merge API (missing today); small SC wiring |
| **C. Observe-only sync** | Mirror pressure into PostHog person props; no gating | Fast analytics demo | Delivers **false confidence** — pressure without a permit. Reject for trial |

**Recommendation: B.** SoftStop is the permit; PostHog is actor + observer.

---

## What exists vs missing

### SoftStop repo (`governer-main`)

| Exists (Phase 1–3) | Still open / later |
|--------|------------------------------|
| `POST /check`, `POST /record`, `POST /users/merge` | Publishable SoftStop browser keys (no BFF) |
| `GET /users/:userId/pressure`, `/activity` | Multi-device anon linking without login |
| Health/verify, orphan rate | SoftStop→PostHog emission inside API (rejected — keep app-side) |
| JS SDK identity + observe helpers (incl. unavailable) | |
| `policies/anon-aggressive.json` | |
| Pressure Console with `ph:` / `sc:` / `email:` lookup hints | |
| Tenants via API key (`x-governor-key` / Bearer) | SC staging SoftStop self-host |

### Street Collector / PostHog code found

| Path | Role | SoftStop? |
|------|------|-----------|
| [`coa-service-main`](../../../coa-service-main) (`Documents/Cursor Projects/coa-service-main`) | **Primary SC shop** — Next.js storefront, Resend email, Supabase auth | **Partial** — BFF + silent gates (watchlist, welcome, URL modal) + identity merge; **no SoftStop UI** |
| `coa-service-main/lib/posthog.ts` | Client funnel events, `identifyCheckoutPurchaser(email)`, traits | Guest `ph:`→`email:` merge |
| `coa-service-main/app/providers.tsx` | PostHog init; `PostHogIdentify` → identify + SoftStop merge (pre-identify) | SoftStop merge |
| `coa-service-main/lib/posthog-server.ts` | Server capture (e.g. purchase) | No SoftStop |
| `coa-service-main/lib/shop/edition-watchlist-notifications.ts` | Stage-change **emails** to watchers (clear pressure actor) | SoftStop gated |
| `coa-service-main/app/(store)/shop/experience-v2/.../IntroQuiz.tsx` | Onboarding quiz (product UX, not marketing spam) | Out of slice by default |
| `sharetrack/` | Separate GiftDesk product + its own PostHog | Out of scope |
| Finance PDFs / Claude HTML under `Documents/Street Collector` | Not app code | N/A |

### PostHog project (MCP, org **Street Collector**)

- Org: [Street Collector](https://eu.posthog.com/project/138294/) — project **Default project** (`138294`), host **eu.posthog.com**, events ingested.
- Surveys: draft API survey **SoftStop trial — finding art** created (not launched). SoftStop-branded in-app survey/modal UI was **removed** from SC; do not reintroduce SoftStop chrome on customer paths.
- Feature flags: **0** listed in this project — do not depend on flags UX for week-1.
- SC code defaults `NEXT_PUBLIC_POSTHOG_HOST` to **`eu.i.posthog.com`** if unset (Phase 2). Keep env explicit in staging/prod.

---

## A. Identity model

### SoftStop `userId` conventions (recommended)

| State | SoftStop `userId` | Notes |
|-------|-------------------|--------|
| Anonymous web visitor | `ph:<posthog.get_distinct_id()>` | Prefix avoids collision with CRM emails/UUIDs |
| Logged-in shop user | `sc:<supabase_user_id>` | Matches `PostHogIdentify`’s `user.id` |
| Guest checkout (email known, not logged in) | `email:<normalized_email>` | Aligns with `identifyCheckoutPurchaser` |

**Do not** store raw PostHog `distinct_id` without the `ph:` prefix. Raw UUIDs look like Supabase IDs and will corrupt merges.

Helper (conceptual):

```ts
function softstopUserIdFromPostHog(ph: { get_distinct_id(): string }, known?: { kind: 'sc' | 'email'; id: string }) {
  if (known?.kind === 'sc') return `sc:${known.id}`
  if (known?.kind === 'email') return `email:${known.id.toLowerCase().trim()}`
  return `ph:${ph.get_distinct_id()}`
}
```

### Anonymous vs identified

1. **Anon:** SoftStop journal keyed by `ph:<distinct_id>`. Aggressive decay (see policy).
2. **Identify (login):** PostHog `identify(user.id)` **and** SoftStop `merge({ fromUserId: ph:…, toUserId: sc:… })`.
3. **Guest email identify:** PostHog identify(email) **and** SoftStop merge `ph:…` → `email:…`. If they later create an account, merge `email:…` → `sc:…` once.

### Merge semantics (recommended v1)

SoftStop has **no merge API today** — add one. Recommended behavior:

| Field | Rule |
|-------|------|
| Pressure | `min(threshold, decayed(from) + decayed(to))` at merge time |
| Per-type cooldown | `max(from, to)` timestamps |
| Window counts | `min(typeCap, fromCount + toCount)` (and global similarly) |
| Events | Keep historical rows on `fromUserId`; insert a single `eventType: "merged"` (or context on both) with `{ from, to }`. Do **not** rewrite all history in v1 |
| After merge | `fromUserId` state tombstoned / empty; all future checks use `toUserId` only |

**Reject for v1:** “max pressure only” (under-counts stacking) and “full event rewrite” (expensive, error-prone).

### Multi-device / multi-anon

- Two devices before login → two `ph:` journals. Only the device that identifies merges that device’s pressure. **Accepted limitation** for week-1 (same as PostHog’s pre-identify reality).
- After login, always use `sc:` on that browser; call merge whenever `ph:` ≠ current and user is known (idempotent merge).
- If `from` already merged into `to`, second merge is no-op (200 + `alreadyMerged: true`).

### Consent / cookieless / GDPR

- SoftStop `userId` derived from PostHog `distinct_id` is **pseudonymous**, not contact PII — still process under same analytics consent as PostHog cookies.
- **If PostHog is blocked / cookieless / not initialized:** do not invent a SoftStop id from IP; **skip SoftStop client calls** (or use only server-side `sc:` / `email:` when known). Never gate core browsing.
- SoftStop should not receive email/name in `context` beyond what actors already need for delivery; prefer opaque ids.
- Document SoftStop as a processor in SC privacy policy when trial leaves localhost (open question — default: trial on staging + internal users only).

---

## B. Event & actor contract

### Surfaces that call SoftStop (actors)

| Actor | Surface | `actionType` | When |
|-------|---------|--------------|------|
| `posthog-survey` | `in-app` | `interruption` | Before rendering a PostHog survey (`softstopGatePostHogSurvey`) — silent gate; **no SoftStop UI in SC** |
| `posthog-banner` (future) | `in-app` | `interruption` | Before sitewide announcement / banner |
| `edition-watchlist` | `email` | `urgency` if scarcity/stage copy; else `reminder` | Before `sendEmail` in watchlist notifications |
| `sc-welcome-incentive` | `in-app` | `discount` | Before welcome promo strip reveal (SC promo copy only) |
| `sc-url-param-modal` | `in-app` | `interruption` | Before URL-param marketing modal (SC modal; silent SoftStop) |

**Removed from SC display:** `SoftStopTrialModal` (`sc-promo-modal`) and `SoftStopPostHogSurvey` — SoftStop-branded week-1 trial chrome. Viz for those interrupts belongs in SoftStop Pressure Console / PostHog events, not SC product UI.

Feature-flag **evaluation** does **not** call SoftStop. Only **interruptive UX** that a flag unlocks (modal/banner) does.

### What never calls SoftStop

- `$pageview`, pageleave, autocapture, heatmaps, session replay
- Pure analytics `captureFunnelEvent` / commerce funnel mirrors
- Feature flag *reads* (`getFeatureFlag`)
- Transactional must-send mail (order confirmation, shipping, password reset) — **out of SoftStop** unless product later defines a separate lane

### PostHog events (observe SoftStop)

Apps (or a tiny SoftStop↔PostHog helper) emit:

| Event | Properties |
|-------|------------|
| `softstop_allowed` | `softstop_user_id`, `action_type`, `surface`, `actor`, `decision_id`, `pressure`, `cost`, `projected_pressure`, `threshold` |
| `softstop_blocked` | same + `block_reason`, `explanation` (optional) |
| `softstop_merged` | `from_user_id`, `to_user_id`, `pressure_after` |

Optional person props (low frequency, on allow/block/merge): `softstop_pressure`, `softstop_updated_at`.

SoftStop API itself does **not** call PostHog in v1 (keeps core free of PH dependency). Emission is **SC-app / SDK helper** responsibility.

---

## C. Runtime architecture

```text
                    ┌─────────────────────┐
   actors ─────────►│ SoftStop (journal)  │◄── Pressure Console (ops only)
   (SC silent gates,│ check / record /    │
    watchlist email)│ merge / pressure    │
                    └─────────┬───────────┘
                              │ observe only
                              ▼
                    ┌─────────────────────┐
                    │ PostHog (analytics) │
                    │ softstop_* events   │
                    └─────────────────────┘
```

SC customer UI never shows SoftStop branding, trial modals, or Console links.
### Where `check` runs

| Path | Where | Why |
|------|-------|-----|
| PostHog survey / in-app interrupt | **Browser** via SoftStop JS SDK, before render | Must block UI; SC already has client PostHog |
| Edition watchlist email | **Server** in `edition-watchlist-notifications.ts` before `sendEmail` | Email is server-side |
| Merge | **Browser** on `PostHogIdentify` + **server** when guest email identify is server-driven | Keep identity with identify |

**Not** recommended for permit: PostHog Destination, reverse proxy on all analytics, or SoftStop inside `posthog.init`.

### Fail-open vs fail-closed

| Context | Mode | Rationale |
|---------|------|-----------|
| Marketing site / shop UI | **Fail-open** | SoftStop outage must not break browse/checkout (match `examples/browser/governor.js`) |
| Watchlist marketing email | **Fail-open** with metric alert | Same; log `governor_unavailable` |
| Future: high-stakes compliance hold | Fail-closed only behind explicit flag | Out of scope |

On fail-open: do **not** invent a `decisionId`; skip `record` (or record is impossible). Track client-side `softstop_unavailable` PostHog event so orphan metrics aren’t confused with true orphans.

### API keys / tenant

- Tenant id: `street-collector` (recommended).
- Auth: SoftStop API key via `Authorization: Bearer` or `x-governor-key` (existing `keys.ts`).
- Browser: **do not** ship the service-role key. Options (pick one for trial):
  1. **Recommended:** Next.js BFF routes `app/api/softstop/check|record|merge` that hold the key server-side and forward to SoftStop.
  2. Publishable SoftStop key with tenant-scoped rate limits (not built yet — open question).

### SoftStop URL

| Env | URL |
|-----|-----|
| Local trial | `http://localhost:3000` (`/v1/...`), `pnpm dev` in SoftStop repo |
| Hosted demo only | `https://softstop.vercel.app` (`/api/...`) — **eval only** |
| SC staging/prod | Self-host SoftStop (Fly/Render/Vercel API) + Supabase storage — required before any real traffic |

SC env: `SOFTSTOP_API_URL` (server), optional `NEXT_PUBLIC_SOFTSTOP_ENABLED=true` for silent client gates (welcome strip / URL modal / merge). Enabling SoftStop must **not** mount SoftStop-branded UI in the shop.

---

## D. Street Collector trial (concrete)

### Prerequisites

1. SoftStop running locally or staging with persistence (memory OK for solo demo; Supabase for multi-day).
2. Access to `coa-service-main` + PostHog project `138294` (or confirmed prod project).
3. Use **existing SC pressure actors** (welcome strip, URL-param modal, watchlist email) — **not** SoftStop-branded trial modals on the shop.
4. Internal test accounts **not** filtered by `NEXT_PUBLIC_POSTHOG_FILTER_EMAILS` (or temporarily allowlist).

### Smallest vertical slice (this week)

**Slice S1 — silent SC actors + identity + ops viz:**

1. **In-app actor (silent):** SC welcome incentive and/or URL-param modal → SoftStop `discount` / `interruption` before show (SC product copy only).
2. **Email actor:** `processEditionWatchlistStageChange` → SoftStop `urgency`/`reminder` before Resend.
3. **Identity:** `PostHogIdentify` → SoftStop merge `ph:` → `sc:`.
4. **Observe:** emit `softstop_allowed` / `softstop_blocked` / `softstop_merged` to PostHog.
5. **Verify (ops only):** SoftStop health + Pressure Console on `sc:<id>` and pre-merge `ph:<id>` — never via SoftStop UI in SC.

Out of slice: IntroQuiz, transactional email, sharetrack, flag UX, cookieless mode, multi-device merge.

### Success metrics

| Metric | Target (week-1) | Source |
|--------|-----------------|--------|
| SoftStop `orphanRate` | **&lt; 0.05** | `GET /health` |
| SoftStop `blockRate` | **0.05–0.25** under load test / repeated interrupts | health |
| `softstop_unavailable` rate | near 0 when SoftStop up | PostHog |
| Survey shown vs blocked | N/A for SoftStop chrome (removed); use welcome/URL blocks + email | PostHog funnel / SoftStop health |
| Qualitative | Console shows pressure rising across email + in-app gates for same `sc:` user | Pressure Console (SoftStop ops) |

Do **not** claim “SoftStop protects all SC users” until more touchpoints are wired ([ADOPTION_CONTRACT.md](../ADOPTION_CONTRACT.md)).

### Manual test script

1. Clear site cookies / use clean profile. Note PostHog `distinct_id` (PH debugger or `posthog.get_distinct_id()`).
2. SoftStop Console (ops): load `ph:<distinct_id>` — pressure ~0. Confirm SC shop shows **no** SoftStop branding.
3. Trigger SC in-app pressure twice quickly (welcome strip and/or URL-param modal) → second should block (stacking / pressure) if policy default; confirm `softstop_blocked` in PostHog.
4. Log in as test collector → confirm merge event; Console on `sc:<uuid>` shows transferred pressure; `ph:` tombstoned/empty.
5. Trigger watchlist stage email for that user (or call notification path in staging) → SoftStop check uses `sc:`; if pressure high, email skipped + `record` blocked.
6. `POST /verify` + `GET /health?periodHours=1` — orphanRate low.
7. Fail SoftStop (stop process) → site still loads; interrupt fail-opens; `softstop_unavailable` captured.

### Pressure Console verification (SoftStop-internal)

Week-1 “trial” visualization is **SoftStop ops**, not Street Collector UX.

- Local: `http://localhost:3000/demo/console.html` (SoftStop repo / self-host — **not** linked from SC customer UI)
- Look up: `ph:<anon>`, then after login `sc:<supabase_uuid>`, and `email:<addr>` if guest path used.
- Simulate contacts only on staging users — avoid polluting production journals.
- Analytics: PostHog `softstop_allowed` / `softstop_blocked` / `softstop_merged` / `softstop_unavailable`.

---

## E. Implementation plan

Using **writing-plans** structure: bite-sized tasks. SoftStop-core vs SC-app-specific called out.

### SoftStop-core

#### Task 1: Merge API + storage semantics

**Files:**
- Modify: `governor/api/src/schemas.ts`, `handlers.ts`, `app.ts`
- Modify: `governor/api/src/storage/storage.ts`, `memoryStorage.ts`, `supabaseStorage.ts`
- Test: `governor/tests/api.test.ts` (new merge cases)
- Docs: `apps/docs/api/` (merge page)

**Produces:** `POST /v1/users/merge` `{ fromUserId, toUserId, tenantId? }` → pressure sum / cooldown max / tombstone from.

- [x] Failing tests for merge pressure sum + idempotent second merge
- [x] Implement handler + memory storage
- [x] Supabase path (state JSON + free-text `event_type`; no migration required for trial)
- [x] Wire route

#### Task 2: Anon / PostHog policy preset

**Files:**
- Create: `policies/anon-aggressive.json` (higher `decayPerHour`, lower caps for demo tenants — or document using `strict` + note)
- Docs: this file + `docs/default-policy-pack.md` pointer

**Recommended defaults for anon trial tenant:** `decayPerHour: 16` (2× default), keep threshold 100.

- [x] Add preset or document SoftStop env for SC staging

#### Task 3: SDK helpers (identity + PostHog observe)

**Files:**
- Modify: `packages/sdk-js/src/` — `toSoftStopUserId`, `merge()`, optional `emitToPostHogCapture(captureFn, decision)`
- Modify: `packages/sdk-js/README.md`
- Create: `examples/posthog/` minimal HTML or MD snippet

- [x] Unit tests for id helpers
- [x] `merge` client method
- [x] Example: check survey → record → capture PH event

#### Task 4: Docs site link

**Files:** `apps/docs/` index/nav → link to integrations doc (or copy summary under `apps/docs/integrations/`)

- [x] Docs nav + merge API page + integrations/posthog

### Street Collector–specific (`coa-service-main`)

#### Task 5: SoftStop BFF routes

**Files (SC):**
- Create: `app/api/softstop/check/route.ts`, `record/route.ts`, `merge/route.ts`
- Env: `SOFTSTOP_API_URL`, `SOFTSTOP_API_KEY`, `SOFTSTOP_TENANT=street-collector`

- [x] Forward body; attach API key; fail-open JSON on upstream errors for check

#### Task 6: Client identity + silent gates

**Files (SC):**
- Create: `lib/softstop.ts` (client helper calling BFF)
- Modify: `app/providers.tsx` `PostHogIdentify` — after `identify`, call merge
- Gate SC product surfaces only (welcome / URL modal) — **no SoftStop-branded trial UI**

- [x] Resolve `ph:` / `sc:` / `email:` ids
- [x] Silent gates + `softstop_*` PostHog capture; SoftStop trial modal / SoftStopPostHogSurvey **removed** from SC display

#### Task 7: Watchlist email actor

**Files (SC):**
- Modify: `lib/shop/edition-watchlist-notifications.ts` — SoftStop check/record around `sendEmail`
- Use `sc:<user_id>` (already have `row.user_id`) or `email:<email>` consistently with client

- [x] Map stage copy → `urgency` vs `reminder` (mallet/lock → urgency)
- [x] Record blocked/executed; capture server PostHog event

#### Task 8: Trial checklist run

- [ ] Manual script in §D (human)
- [ ] Health orphanRate &lt; 0.05 (human after traffic) — use SC `GET /api/softstop/health?periodHours=1`
- [x] Note partial adoption explicitly in trial writeup (this doc header)

### Phase 2 — Trial ops + identity completeness

- [x] SoftStop SDK: `emitSoftStopUnavailableToPostHog` (no invented `decision_id`)
- [x] Pressure Console: SC id prefixes in placeholder + empty hint
- [x] SC BFF: `GET /api/softstop/health`, `POST|GET /api/softstop/verify`
- [x] Fail-open hardening: fetch timeout (3s), skip `record` without `decisionId`, strip unavailable decisions
- [x] Fix identify merge: capture SoftStop from-id **before** `posthog.identify`
- [x] Guest checkout: `identifyCheckoutPurchaser` → SoftStop `ph:` → `email:` merge
- [x] Login: also merge `email:` → `sc:` when user has email
- [x] Default PostHog ingest host to EU in SC layout / providers / posthog-server

### Phase 3 — Expand actor coverage

- [x] Gate `WelcomeIncentiveStrip` (`sc-welcome-incentive`, `discount`) — silent SoftStop
- [x] Gate `URLParamModal` (`sc-url-param-modal`, `interruption`) — silent SoftStop
- [x] Client helpers: `softstopGateAction` / `softstopGateDiscount` / `softstopGatePostHogSurvey`
- [x] Create draft PostHog API survey (EU) — **not launched**; ops reference only
- [x] **Remove SoftStop-branded SC UI:** `SoftStopTrialModal` + `SoftStopPostHogSurvey` unmounted/deleted; viz = SoftStop Console + PostHog events
- [ ] Optional: gate a **native** PostHog survey (no SoftStop chrome) via `softstopGatePostHogSurvey` if product wants one
- [ ] Human run of §D manual script after SoftStop + SC staging traffic

### Out of scope

- SoftStop-branded / trial UI, Console links, or SoftStop messaging on Street Collector customer-facing pages
- SoftStop inside PostHog product code / Destination-as-permit
- Gating pageviews, autocapture, replay
- sharetrack / GiftDesk
- IntroQuiz / transactional email
- Multi-device anon linking without login
- Publishing SoftStop browser API keys without BFF
- Editing `/Users/streetcollector/.cursor/plans/pressure_visual_console_5c29f64a.plan.md`

---

## F. Open questions (with recommended defaults)

| # | Question | Recommended default |
|---|----------|---------------------|
| 1 | SoftStop userId prefix scheme? | `ph:` / `sc:` / `email:` as above |
| 2 | Merge pressure: sum vs max? | **Sum** (capped at threshold) |
| 3 | Week-1 in-app actor if surveys stay at 0? | Silent SoftStop on SC welcome / URL modal; **no SoftStop chrome** in SC; viz = Console + PostHog |
| 4 | Browser SoftStop auth? | **BFF routes** in Next.js |
| 5 | Fail mode on shop? | **Fail-open** |
| 6 | Which PostHog project/host is production SC? | **Confirmed EU** project `138294` / `eu.posthog.com`; set `NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com` |
| 7 | Include watchlist email in week-1? | **Yes** — best cross-actor proof |
| 8 | Gate IntroQuiz? | **No** — onboarding ≠ marketing pressure |
| 9 | SoftStop deployment for SC trial? | Local/`pnpm dev` for engineer demo; self-host before shared staging |
| 10 | Consent gating SoftStop calls? | Same gate as PostHog init; if PH not loaded, skip SoftStop client |

---

## Approval gate

Approve or amend:

1. Approach **B** (app-side permit, PostHog observe/actor)
2. Identity prefixes + merge = **sum pressure**
3. Vertical slice S1 (survey/modal + watchlist email + identify merge)
4. BFF + fail-open
5. SoftStop-core merge API before SC wiring

After approval: implement Task 1→8 in order (TDD on SoftStop merge). **Do not claim full SC protection** until more actors are wired and orphanRate stays healthy.
