# SoftStop → AI Agent Governor / Control Layer

**Date:** 2026-08-07  
**Status:** Design / gap analysis only (no product implementation in this change)  
**Scope:** Evolve SoftStop from a shared human-pressure permit into a reliable **agent control layer** without abandoning authorize-only semantics.  
**Grounding:** `governor/api` (handlers, engine, storage, schemas), `packages/sdk-js`, docs under `apps/docs` and `docs/ROADMAP.md`.

---

## Product spine (what SoftStop already is)

SoftStop authorizes whether an actor may **raise pressure on a human** right now. It does not send messages, pick offers, store journeys (not a CDP), or replace tool IAM / HITL.

Today that spine is:

1. Deterministic policy packs (`threshold`, `decayPerHour`, `costs`, caps, cooldowns)
2. `POST …/check` → decision + `decisionId`
3. `POST …/record` → advance state on `executed` / `downgraded`; audit on `blocked`
4. `verify` / `health` (orphan rate) for adoption honesty

Agent wedge (shipped positioning + thin SDK): `beforeContact`, `wrapUserFacingTool`, `suggestedActionType`, multi-actor collision via shared `userId` journal.

---

## Gap table vs agent-governor requirements

| # | Requirement | Status | Ships today | Partial | Missing |
|---|-------------|--------|-------------|---------|---------|
| 1 | **Atomic multi-agent state / race prevention** | **Missing** | Concurrent-allows documented as a known limitation (`apps/docs/api/errors.md`); check logs event; record advances pressure | — | Distributed locks; check-and-reserve / leasing (10–30s hold); expire reserve if no record; OCC / versioned state |
| 2 | **High-throughput token bucket & pressure decay** | **Partial** | Linear decay on read (`decayedPressure`); static per-type `costs`; threshold + caps + stacking window; perf baseline P95 &lt;50ms (`docs/perf/PERFORMANCE.md`) | Continuous-enough decay at evaluation time (not a background ticker) | Classic token-bucket refill; dynamic/runtime action weights; measured &lt;15–30ms P95; hot-path caching / sharded keys |
| 3 | **Agent-friendly schema & fallback steering** | **Partial** | `allowed`, `reason`, `decisionId`, `cooldownUntil`, `suggestedActionType`, `pressure` / `cost` / `threshold` / `projectedPressure`, `explanation` on deny | Hardcoded urgency/interruption → `reminder` suggestions in `evaluateCheck` | Structured `retryAfterMs`, `suggestedFallback`; client helpers to format blocked payloads for LLM context |
| 4 | **SDK wrappers / native tool middlewares** | **Partial** | `SoftStop#beforeContact`, `wrapUserFacingTool` (framework-agnostic); examples + governing-ai-agents docs | Hand-rolled `withSoftStop` patterns in workflow docs | First-party Vercel AI SDK / LangChain / etc. middlewares named `withSoftStop`; auto tool-result shaping for models |
| 5 | **Multi-tenant identity & hierarchical scoping** | **Partial** | `tenantId` isolation on state/events; scoped API keys; `POST …/users/merge` + tombstones; PostHog helpers (`ph:` / `sc:` / `email:`); optional `surface` / `actor` in context | Identity merge across anonymous→known | Hierarchical pressure scopes (channel / org / thread); pressure aggregation across scope tree; scope keys in check/record schema |

**Legend:** *Ships* = enforceable or callable in current API/SDK. *Partial* = related behavior exists but does not meet the stated requirement. *Missing* = not implemented; do not claim.

---

## Evidence map (current code)

### Check is read-only for pressure

`handleCheck` loads state, calls `evaluateCheck`, inserts a `check` event, returns the decision. It does **not** call `applyOutcome` or `upsertUserState` (`governor/api/src/handlers.ts`).

`handleRecord` applies outcome and upserts state. Pressure / windows / `lastAnyEscalationAt` advance only for `executed` | `downgraded` (`governor/api/src/rules/engine.ts` → `applyOutcome`).

**Race:** two agents can both receive `allowed: true` before either records. Storage upsert is last-write-wins (`SupabaseStorage.upsertUserState` / `MemoryStorage`) with **no** version, lease, or compare-and-set.

### Decay and costs (not a token bucket)

- Decay: linear from `pressureUpdatedAt` at evaluation time (`decayedPressure`).
- Costs: static map from loaded policy (`GovernorRulesConfig.costs`).
- Gates: `pressure + cost > threshold`, per-type cap, global cap, cooldown, stacking window for urgency/interruption.

This is a **pressure ledger + caps**, not a token-bucket rate limiter with continuous refill tokens.

### Blocked / steering payload today

On deny, check response may include:

| Field | Role |
|-------|------|
| `reason` | Machine enum (`pressure_exceeded`, `cooldown_active`, …) |
| `explanation` | Plain language (`formatExplanation`) |
| `suggestedActionType` | Soft downgrade hint (often `reminder`) |
| `cooldownUntil` | ISO when cooldown is the reason |
| `pressure`, `cost`, `threshold`, `projectedPressure` | Numeric context |

No `retryAfterMs`, no structured `suggestedFallback`, no SDK `formatBlockedForLlm` (or similar).

### Agent SDK today

| Helper | What it does |
|--------|----------------|
| `beforeContact` | check → run → record executed, or record blocked and skip |
| `wrapUserFacingTool` | Same pattern around a tool handler; returns `{ ok, reason, suggestedActionType }` |

These are **agnostic wrappers**, not Vercel AI SDK / LangChain plugin packages. Callers still must surface block fields into the model message themselves.

### Identity / tenancy today

| Mechanism | Scope |
|-----------|--------|
| `tenantId` (default `"default"`) | Isolates journals and metrics per pilot/tenant |
| API keys → tenant | Report/health scoping |
| `merge` | Combine two `userId` journals (sum decayed pressure, max cooldowns, sum windows) |
| `toSoftStopUserId` / PostHog emit helpers | Convention for analytics identity |
| `surface`, `actor` | Audit context only — **not** separate pressure buckets |

There is **no** channel/thread/org hierarchical pressure key in `checkSchema` / `GovernorUserState`.

---

## Prioritized technical roadmap

### P0 — Check-and-reserve (atomic multi-agent permits) — **highest product gap**

**Why first:** Multi-agent collision is SoftStop’s primary agent story. Without reservation, two runtimes can both “pass” and both interrupt the same human. Docs already admit this; claiming “governor / control layer” without fixing it overpromises.

**Recommended phased architecture (compat-first):**

#### Phase A — Soft reserve on allow (single-node / memory + Supabase-friendly)

1. Extend user state with optional `reserves: Array<{ decisionId, actionType, cost, expiresAt, actor? }>`.
2. On `check` when `allowed`:
   - Compute **effective pressure** = `decayedPressure(state) + sum(active reserve costs)`.
   - If still under threshold (and caps/cooldowns/stacking pass), **append a reserve** with TTL **10–30s** (policy-configurable; default e.g. 20s), upsert state, then return allow + `decisionId`.
   - If effective pressure would exceed, deny with existing reasons (prefer `pressure_exceeded` or a new `reserve_contention` only if we need distinguishability — default: reuse `pressure_exceeded` / `recent_escalation` for fewer client breaks).
3. On `record`:
   - `executed` / `downgraded`: apply cost as today; **clear matching reserve** by `decisionId`.
   - `blocked`: clear reserve if present (should be rare on allow path).
   - Missing / expired reserve: still accept record for orphan hygiene, but do not double-apply cost if already expired and another actor spent the budget (define idempotency rules carefully).
4. Background / lazy expiry: on every check/record for that user, drop reserves with `expiresAt < now` (no separate sweeper required for correctness).

**Storage:** start with in-document reserves inside `governor_user_state.state` JSON + optimistic concurrency:

- Add `stateVersion` (integer) on the row.
- `upsert` only if version matches; on conflict retry evaluate once (bounded).

This avoids Redis for v1 while preventing lost updates between check and record.

#### Phase B — Lease semantics + client contract

- Check response (allow): add optional `reserveExpiresAt` (ISO) and/or `reserveTtlMs`.
- Clients must `record` before expiry; adapters (`beforeContact`) already record immediately after `run` — keep that path short.
- Document: long-running side effects that exceed TTL must re-check or extend (extension is Phase C).

#### Phase C — Distributed hardening (later; design-partner demand)

- Redis / Postgres advisory locks or lease tables for multi-region.
- Explicit `POST …/extend-reserve` if agents need longer tool latency.
- Metrics: reserve expiry rate, contention denies, check P95 under reserve path.

**Out of scope for P0:** rewriting the product as a distributed lock service; MCP gateway; changing authorize-only semantics.

### P1 — Richer agent fallbacks + LLM formatting helpers

Build on existing fields; do not break current clients.

| Additive field | Purpose |
|----------------|---------|
| `retryAfterMs` | Derived from `cooldownUntil` or stacking window when applicable; else omit |
| `suggestedFallback` | Structured `{ actionType?, strategy: "downgrade"\|"skip"\|"defer", message? }` — generalize today’s `suggestedActionType` |
| SDK `formatBlockedForLlm(decision)` | Stable string/JSON blob for tool error returns |

Keep `suggestedActionType` as a **compat alias** (map from `suggestedFallback.actionType`).

### P2 — Throughput / latency hardening (honest targets)

- Instrument check/record P50/P95 (local memory vs Supabase).
- Optimize hot path: single read+write under reserve; avoid extra round-trips.
- Treat **&lt;15–30ms** as an **aspirational local/memory target**, not a hosted Supabase guarantee until measured.
- Token-bucket: only if partners need per-second rate limiting **in addition to** pressure; do not rename the pressure engine as a token bucket in marketing.

Dynamic action weights: policy-time costs already exist; “dynamic” (context-dependent cost) needs a design (context keys → cost multipliers) — later than reserve.

### P3 — Framework-native middlewares

- Keep `beforeContact` / `wrapUserFacingTool` as the core.
- Add thin packages or export entrypoints: e.g. `withSoftStop` for Vercel AI `tool()` / LangChain tools that auto-inject LLM-friendly deny payloads (`formatBlockedForLlm`).
- Do not claim native framework support until those adapters ship and are tested.

### P4 — Hierarchical scoping

- Keep `tenantId` + `userId` as the primary journal key.
- Additive optional `scopeKey` or structured `{ channelId?, threadId?, orgUnit? }` that maps to **secondary** pressure ledgers or weighted contribution to the user ledger.
- Default: user-level pressure remains the collision signal across agents; thread scope is opt-in for chatty in-thread tools.

---

## Schema evolution (compat with current check / record)

### Principles

1. **Additive JSON fields** preferred; never remove `allowed`, `reason`, `decisionId`, pressure fields, or `suggestedActionType` without a major version.
2. **Default behavior unchanged** until an explicit flag or policy opt-in enables reserve (`SOFTSTOP_RESERVE=1` or policy `reserveTtlMs > 0`).
3. **Orphan contract stays:** every check still needs a record; reserve expiry without record becomes a first-class health signal (new metric: `expiredReserveRate`), complementary to `orphanRate`.
4. **Unknown action types** still HTTP 400 (policy-defined types already shipped).

### Proposed additive shapes (illustrative)

**Check response (allow, when reserve enabled):**

```json
{
  "allowed": true,
  "reason": "allowed",
  "decisionId": "…",
  "pressure": 20,
  "cost": 40,
  "threshold": 100,
  "projectedPressure": 60,
  "reserveExpiresAt": "2026-08-07T12:00:20.000Z",
  "reserveTtlMs": 20000
}
```

**Check response (deny, additive):**

```json
{
  "allowed": false,
  "reason": "pressure_exceeded",
  "decisionId": "…",
  "explanation": "…",
  "suggestedActionType": "reminder",
  "suggestedFallback": {
    "strategy": "downgrade",
    "actionType": "reminder",
    "message": "Prefer a softer reminder path; do not retry urgency immediately."
  },
  "retryAfterMs": 600000,
  "pressure": 90,
  "cost": 40,
  "threshold": 100,
  "projectedPressure": 130
}
```

**Record:** unchanged required fields. Optional: ignore unknown body fields. Matching `decisionId` clears reserve.

**State document (internal):**

```json
{
  "pressure": 60,
  "pressureUpdatedAt": "…",
  "cooldowns": {},
  "windows": {},
  "lastAnyEscalationAt": "…",
  "reserves": [
    {
      "decisionId": "…",
      "actionType": "urgency",
      "cost": 40,
      "expiresAt": "…"
    }
  ]
}
```

### Fail modes to specify in implementation plan

| Case | Behavior |
|------|----------|
| Reserve expires before record | Capacity freed; late `executed` record should either re-check (strict) or apply cost if still under threshold (lenient). **Recommend strict:** reject or no-op cost with `ok: true, reserveExpired: true` so agents re-check — decide in implementation plan, document in errors.md |
| Double record same decisionId | Idempotent: second executed does not double-charge |
| Check without reserve (flag off) | Today’s read-only check behavior |

---

## What NOT to claim yet

Do **not** claim in README, demo, or press until implemented and verified:

- Production **race-safety**, **locking**, or **atomic multi-agent permits**
- **Token-bucket** rate limiting or **&lt;15–30ms** hosted latency guarantees
- Structured **`retryAfterMs` / `suggestedFallback`** or “LLM-native” deny payloads as shipped API
- **Native** Vercel AI SDK / LangChain middlewares (beyond agnostic `beforeContact` / `wrapUserFacingTool`)
- **Hierarchical** channel/org/thread pressure (beyond `tenantId` + per-`userId` + merge)
- SoftStop as MCP tool firewall, CDP, messaging platform, or HITL replacement
- That `verify`/`health` prove every company system is wired (orphan rate is observed-traffic only)

Safe claims today:

- Deterministic shared permit for human-facing escalations
- Agents + channels can share one user journal
- Thin agent helpers exist; callers still own framework integration and model prompting
- Concurrent allows remain a documented limitation until reserve ships

---

## Relation to prior specs

| Spec | Relationship |
|------|----------------|
| [2026-08-06-softstop-feedback-response-and-gaps.md](./2026-08-06-softstop-feedback-response-and-gaps.md) | G19 race product fix was `wont-fix-now`; this doc elevates it to **P0 design** for agent-governor maturity |
| [2026-08-06-extensible-action-types-design.md](./2026-08-06-extensible-action-types-design.md) | Shipped; custom types remain policy-defined — orthogonal to reserve |
| [docs/ROADMAP.md](../../ROADMAP.md) | Later section should point here for agent control-layer priorities |

---

## Suggested next step

Invoke **writing-plans** for P0 only: check-and-reserve with in-state leases + optimistic version, opt-in policy flag, tests for dual concurrent allows → single effective spend, SDK/`beforeContact` unchanged behavior under flag-off, docs honesty updates when flag-on becomes default.
