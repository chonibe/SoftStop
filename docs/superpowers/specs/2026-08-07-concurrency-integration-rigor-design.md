# SoftStop Concurrency & Integration Rigor

**Date:** 2026-08-07  
**Status:** Wave A **shipped** (release + strict late-record + `expiredReserveRate`). Waves B/C and out-of-scope items unchanged.  
**Skills:** Superpowers brainstorming → writing-plans.  
**Grounding:** `governor/api` (handlers, engine, storage), `docs/ROADMAP.md`, `docs/superpowers/specs/2026-08-07-ai-agent-governor-control-layer-design.md`, Sprint 2 gateway revert history.

---

## Product posture (non-negotiable)

SoftStop is an **authorize-only** escalation / pressure permit:

- `check` → decide; caller sends; `record` → advance journal
- Self-host first; memory + Supabase today; Redis is optional hardening, not the default story
- Does **not** send Twilio/SendGrid/Firebase messages, own journeys, or replace tool IAM

Historical constraint: Sprint 2 messaging gateway (Resend inside SoftStop) was **reverted** as a tenet violation. Any “gateway” work must stay an **adapter / separate service**, never core send.

---

## Approaches considered

| Approach | Idea | Pros | Cons |
|----------|------|------|------|
| **A — Extend reserve/OCC (recommended)** | Finish opt-in check-and-reserve gaps; Redis Lua/CAS as storage adapter Phase C; orphan metrics + optional sweeper; lint/SDK hygiene as adapters | Matches shipped spine; YAGNI; preserves authorize-only; lowest ops for OSS | Not multi-region-hard until Phase C; does not stop shadow traffic by itself |
| **B — Per-user Redis mutex as primary** | `lock:user:{id}` around check→send→record | Serializes entire pipeline | Throughput cliff; hold-time includes send latency; Redis required; duplicates what reserve+OCC already solve for pressure correctness |
| **C — SoftStop as outbound notification proxy** | All providers route through SoftStop | Bypass-proof for wired paths | Contradicts authorize-only + Sprint 2 revert; product becomes ESP/gateway; OSS scope explosion |

**Recommendation:** Approach A. Treat mutex and outbound gateway as **explicit non-goals for OSS core**. Provider webhook auditing and AST linters are **optional adapters** after Wave A metrics prove need.

---

## Gap analysis (user proposal → status)

### 1. Concurrency & race conditions

| User ask | Status | Evidence | Gap |
|----------|--------|----------|-----|
| **Atomic Reservation Leases (`checkAndReserve`)** | **Partial / shipped opt-in** | `reserveTtlMs` / `SOFTSTOP_RESERVE` / `SOFTSTOP_RESERVE_TTL_MS`; `appendReserve` + TTL; allow returns `reserveExpiresAt`; tests in `governor/tests/reserve.test.ts`; docs `apps/docs/api/errors.md` | Default still `0` (legacy read-only check). No Redis Lua. No explicit `release()` API (only TTL prune + record clear). No `extend-reserve`. Not marketed as default-on. |
| **Per-User Distributed Mutex** | **Not started** | No `lock:user:*`, no Redis client in `governor/api` | Deliberately deferred — reserve+OCC is the chosen race fix; mutex stacks poorly with send latency |
| **Optimistic Concurrency Tokens** | **Partial (server-internal)** | `stateVersion` on `GovernorUserState`; `tryUpsertUserState` CAS (memory + Supabase); check/record retry loops when reserve on | Token **not** returned on check response; record does **not** reject client-supplied stale versions (clients never send them). OCC is storage CAS, not client OCC protocol |

### 2. Integration rigor / state drift

| User ask | Status | Evidence | Gap |
|----------|--------|----------|-----|
| **Outbound Notification Gateway** | **Not started (and historically rejected in core)** | ROADMAP: MCP/tool gateway not homepage; Sprint 2 Resend gateway reverted; `tenet-policy.json` forbids ESP imports in apps | Do **not** build in OSS core. Optional commercial/out-of-tree adapter only after explicit product flip |
| **Orphan Sweeper / Auto-Reconciliation** | **Partial (observe-only)** | `orphanRate` / `getOrphanedDecisionIds` on health/report; pull alert recipe `apps/docs/ops/orphan-rate.md`; lazy reserve prune on check/record | No background worker. Spec mentioned `expiredReserveRate` — **not shipped**. No auto-record of expired reserves |
| **Provider Webhook Auditing** | **Not started** | Decision-export webhooks listed as Later in ROADMAP; no Twilio/SendGrid ingest | Out of authorize-only core; optional adapter |
| **AST / ESLint rules for check→record** | **Not started (for SoftStop consumers)** | Repo has tenet/ESLint for **internal** boundary enforcement (`apps/.eslintrc` history, `scripts/tenet-check.js`); SDK `beforeContact` / `withSoftStop` already encapsulate try/finally-equivalent flow | Publishable `eslint-plugin-softstop` not started — good Wave B adapter, not API change |

### Storage backends (context)

| Backend | Role today |
|---------|------------|
| **Memory** | Default local/CI; full OCC + reserves |
| **Supabase / Postgres** | Production self-host; OCC via JSON `stateVersion` filter |
| **Redis** | **Not implemented** — ROADMAP Later / reserve Phase C |

Related prior design: [2026-08-07-ai-agent-governor-control-layer-design.md](./2026-08-07-ai-agent-governor-control-layer-design.md) (P0 Phases A/B shipped opt-in; Phase C Redis still open).

---

## Design conflicts (call these out before coding)

1. **Per-user mutex vs throughput** — Holding a lock across Twilio/LLM send serializes all escalations for that user and couples SoftStop latency to provider RTTs. Reserve leases already hold **budget**, not the send path. Prefer reserve; mutex only if partners need total order of side effects beyond pressure accounting.

2. **Outbound gateway vs SDK-first OSS** — Gateway makes SoftStop the sender (tenet break). SDK + `withSoftStop` keep authorize-only. Bypass proof requires **org process** (wire every touchpoint) + optional webhook reconcile, not core send.

3. **Fail-closed SDK vs lease semantics** — SDK default `fail_closed` on SoftStop outage. Lease expiry without record frees budget (fail-open for capacity). These are different layers: network unavailability ≠ lease timeout. Document both; do not conflate.

4. **Client OCC tokens vs server CAS** — Returning `stateVersion` and rejecting record on mismatch adds client complexity and false rejects under legitimate concurrent actors. Server-side CAS + reserve contention already prevents lost updates. Client OCC is optional and lower leverage than `expiredReserveRate` + `release`.

5. **Core vs adapters**

| In core (`governor/api`) | Adapter / optional package |
|--------------------------|----------------------------|
| Reserve TTL, OCC CAS, metrics, optional Redis storage | `eslint-plugin-softstop` |
| `POST …/release` (clear reserve without charging) | Provider webhook auditor |
| `expiredReserveRate` on health | Outbound send proxy (if ever — separate service) |
| `extend-reserve` (partner demand) | Per-user Redis mutex helper (if ever) |

---

## Chosen architecture (Wave sequence)

### Wave A — Finish reserve Phase B (high leverage, low scope)

**Why first:** Closes honesty gaps on the already-shipped race fix without new infrastructure.

1. Ship **`expiredReserveRate`** (and optionally `expiredReserveCount`) on `/health` / report — checks (or reserves) that expired without matching `record`.
2. Add **`POST …/release`** (or `record` outcome `released`) to drop a reserve early without applying pressure cost — crash/abort path complementary to TTL.
3. Document **strict late-record** policy: if reserve expired and capacity was reused, `executed` does not double-apply blindly — return `ok: true` with `reserveExpired: true` / `applied: false` (exact shape in implementation plan) so agents re-check.
4. Optional: return **`stateVersion` on check** for observability only (no record rejection yet).
5. Soak criterion for later default-on: document when `SOFTSTOP_RESERVE` may become default `20000` (after partner soak).

**Acceptance:**

- Tests: concurrent allows with reserve on cannot both spend same budget; release frees budget; expired reserve metric moves; late executed after expiry does not silently double-charge.
- Docs: `errors.md`, `check.md`, `record.md`, ROADMAP status line updated.
- Default remains legacy (`reserveTtlMs: 0`) until explicit decision.

### Wave B — Integration hygiene adapters (medium leverage)

**Why second:** Reduces orphans and shadow traffic **without** changing authorize-only core.

1. **`eslint-plugin-softstop`** (or Codemod): flag `check(` without subsequent `record` / prefer `beforeContact` / `withSoftStop`.
2. Orphan **sweeper job** (optional cron script in `scripts/` or docs recipe): list orphan IDs → emit alert / optional `record(outcome: "blocked", blockReason: "orphan_timeout")` behind flag — default **alert-only** to avoid inventing outcomes.
3. HTTP middleware sketch remains ROADMAP Later (Express/Fastify) — not required for Wave B if ESLint + SDK wrappers cover agent paths.

**Acceptance:**

- Plugin catches a golden bad example and passes `beforeContact` good example.
- Sweeper docs: pull health → alert; auto-record off by default.

### Wave C — Distributed hardening (partner demand only)

**Why last:** Ops cost and positioning shift.

1. **Redis storage adapter** with Lua or `WATCH`/`MULTI` CAS equivalent to `tryUpsertUserState` + reserves (same API; no parallel “checkAndReserve” product).
2. **`POST …/extend-reserve`** for long tool latency.
3. Metrics: contention denies, reserve path P95, multi-instance soak.

**Explicitly still not in Wave C:** per-user mutex across send; SoftStop-as-Twilio-proxy; making Redis mandatory for OSS.

### Out of scope / do NOT build yet (OSS authorize-only)

- SoftStop outbound notification gateway (Twilio/SendGrid/Firebase/LLM tool proxy in core)
- Per-user distributed mutex as primary race control
- Client-driven OCC reject-on-record as required protocol
- Provider webhook auditing in core API
- Claiming race-safety when `reserveTtlMs === 0`
- **MCP-B/C** tool-call / output-interception proxy as homepage product (see MCP section below)
- Auto-reconciliation that invents `executed` outcomes

---

## SoftStop as MCP? (A / B / C)

“Why not have SoftStop act as an MCP?” conflates several products. Separate them.

### A — MCP **server** exposing SoftStop tools (authorize-only)

Expose `check`, `record`, `release`, `health` (and maybe `pressure`) as MCP tools so an agent runtime calls SoftStop over MCP instead of HTTP/SDK.

| | |
|--|--|
| **Pros** | Native in Cursor/Claude Desktop/agent hosts; zero custom HTTP client; good demo for AI-wedge; still authorize-only |
| **Cons** | Thin wrapper over existing API; overlaps JS/Python SDKs + `withSoftStop`; MCP tool sprawl if agents also have Twilio tools; orphans if model calls `check` and forgets `record` (same as raw HTTP) |
| **Tenet fit** | **Yes** — SoftStop still does not send |
| **Overlap today** | `beforeContact` / `withSoftStop` / Python SDK already wrap check→run→record for in-process tools; MCP-A is a **transport adapter**, not a new control plane |

**Stance:** Optional Later / Wave B–C **adapter** after Wave A reserve honesty. Do not make it the homepage product; do not block concurrency work on it.

### B — MCP **gateway / tool proxy** (enforcement)

SoftStop (or a sidecar) sits in front of Twilio/email/Firebase/LLM tools and refuses execution unless SoftStop allowed the escalation — the archived `archive/mcp-gateway` / `packages/gateway` direction and the old “local MCP proxy intercepts tool calls” sketch in `docs/production-runtime.md`.

| | |
|--|--|
| **Pros** | Harder to bypass for tools that only exit through the proxy; feels like “real” agent governance |
| **Cons** | SoftStop becomes (or owns) a tool firewall in a crowded MCP-gateway market; couples to every provider SDK; Sprint 2–class tenet risk if the proxy also sends; non-MCP channels (cron email, Shopify flows) still bypass; ops and IAM complexity |
| **Tenet fit** | **Weak for OSS core** — authorize-only pressure permit ≠ tool IAM / send proxy. Gateway must stay a **separate service** if ever built |
| **Why ROADMAP says no homepage** | Product thesis is shared **human pressure** across agents *and* channels, not “be the MCP firewall.” Press/`LAUNCH_BLURBS`: “Not an MCP firewall.” Experimental material stays archived |

**Stance:** **No** as SoftStop homepage / core. Commercial or out-of-tree sidecar only after an explicit product flip.

### C — MCP as **output interception** / shadow-traffic bridge (user’s clarified intent)

**Threat model:** Marketing (or any team) starts contacting users via some agent/product/tool **without** calling SoftStop’s HTTP `check`/`record`. SoftStop should still see or block that path.

**What MCP-C means:** Connect SoftStop to agent/product **outputs** — map outbound contact tool calls → `actionType` + `userId`, run `check` before the underlying tool, `record` after. In hosts that *only* allow contact tools through SoftStop-wrapped MCP tools, bypass **inside that host** becomes structurally hard.

| | |
|--|--|
| **Pros** | Real enforcement for Cursor/Claude-style runtimes that must use your MCP mesh; maps “suddenly used a tool in this host” → SoftStop |
| **Cons** | Same coverage ceiling as B: anything outside the mesh is invisible. Cron, Shopify flows, Resend dashboard, Zapier, legacy scripts, another agent runtime that doesn’t use your MCP — all still bypass. “Suddenly uses a product” **outside** the MCP mesh is not solved by MCP |
| **Relation to B** | MCP-C **is** the gateway pattern, MCP-shaped — not a different architecture. Same archive path: `archive/mcp-gateway`, `docs/production-runtime.md` (daemon intercepts MCP JSON-RPC) |
| **Fit for cross-service marketing bypass** | **Incomplete.** MCP alone cannot be the system of record for “marketing used product without API” |

**Better fit for that threat (priority order):**

1. **Outbound Notification Gateway** — single send path across microservices (structural enforcement; keep as separate service / product flip, not SoftStop core send)
2. **Provider webhook auditing** — Twilio/SendGrid/Firebase delivery events without matching SoftStop `decisionId` → detect shadow traffic after the fact
3. **MCP-C wrappers** — optional **adapter** for agent runtimes that live in an MCP host — one surface, not the whole product

### Recommended product line (approve this)

> **MCP output-gating (C): useful adapter for agent hosts, not the fix for cross-product marketing bypass.**  
> **For that bypass threat: prioritize outbound gateway and/or provider webhook audit over MCP-as-core.**  
> **MCP-A (check/record tools): yes later. MCP-B/C as SoftStop homepage: no.**  
> **Honest limit: MCP alone does not solve cross-product bypass.**

Ship order for concurrency waves unchanged. Shadow-traffic work, if scheduled, is gateway + webhook audit (design-partner / commercial or explicit OSS adapter packages) — not “make SoftStop an MCP.”

---

## Data flow (target, Wave A)

```text
Agent/channel
  → check (reserve on): evaluate effective pressure (state + active reserves)
       → CAS append reserve (stateVersion++) → allow + decisionId + reserveExpiresAt
  → send (caller-owned)
  → record(executed|downgraded|blocked): clear reserve by decisionId; apply cost if appropriate
  → OR release(decisionId): clear reserve; no cost
  → OR TTL: pruneExpiredReserves on next touch; count toward expiredReserveRate
```

Fail modes:

| Case | Behavior |
|------|----------|
| CAS conflict on check | Retry evaluate; if still contended after bound, deny `pressure_exceeded` |
| Crash after allow before record | TTL frees budget; orphan/expired metrics rise until record/release |
| Late executed after expiry | `applied: false` + `reserveExpired: true` (Wave A strict); agent re-checks |
| SoftStop unreachable | SDK `fail_closed` / `fail_open` (unchanged) |

---

## Decisions needing user approval before coding

1. **Wave A late-record:** strict (`applied: false`) vs lenient (apply cost if under threshold)? Design recommends **strict**.
2. **Release shape:** new `POST /v1/release` vs new `outcome: "released"` on record?
3. **Default-on reserve:** keep opt-in through Wave A, or schedule default `20000` in a minor version?
4. **Wave C Redis:** wait for design-partner demand (recommended) vs schedule now?
5. **Any product flip** toward outbound gateway / **MCP-B/C** as core? Default **no** — keep authorize-only; gateway/webhook as separate enforcement if the marketing-bypass threat is in scope.
6. **MCP-A** (SoftStop tools over MCP): schedule as Later adapter after Wave A, or skip until partners ask?
7. **Shadow-traffic priority** if pursued: webhook audit first (detect) vs outbound send gateway (block) vs MCP-C agent-host adapter only?

---

## Relation to ROADMAP

Extends [ROADMAP.md](../../ROADMAP.md) “Later → Redis / extend-reserve” and completes honesty items from the agent control-layer P0 Phase B. Does **not** reopen MCP-B/C (output interception / tool proxy) as homepage; MCP-A remains an optional authorize-only adapter. Cross-product bypass → gateway + webhook audit, not MCP-as-core (see MCP section).

Implementation plan: [../plans/2026-08-07-concurrency-integration-rigor.md](../plans/2026-08-07-concurrency-integration-rigor.md).
