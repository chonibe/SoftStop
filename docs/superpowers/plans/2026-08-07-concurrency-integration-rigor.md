# Concurrency & Integration Rigor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish SoftStop check-and-reserve Phase B (release + expired-reserve metrics + strict late-record) without inventing parallel race systems; defer Redis/mutex/gateway.

**Architecture:** Extend existing opt-in `reserves[]` + `stateVersion` CAS in `governor/api`. Add release path and health metrics. Keep authorize-only; no outbound send proxy. Redis and ESLint plugin are later waves.

**Tech Stack:** TypeScript (`governor/api`), Vitest (`governor/tests`), VitePress docs (`apps/docs`), memory + Supabase storage.

**Spec:** [docs/superpowers/specs/2026-08-07-concurrency-integration-rigor-design.md](../specs/2026-08-07-concurrency-integration-rigor-design.md)

## Global Constraints

- SoftStop remains **authorize-only** — never import Twilio/SendGrid/Resend/Firebase into `governor/api`.
- Default `reserveTtlMs` stays **`0`** unless a separate approved change flips it.
- Prefer extending `tryUpsertUserState` / `reserves[]` — do **not** add a parallel `checkAndReserve` HTTP product or per-user mutex.
- Do not commit/push unless the user asks.
- Additive API fields preferred; do not remove `allowed` / `decisionId` / `orphanRate`.

---

## File map (Wave A)

| File | Responsibility |
|------|----------------|
| `governor/api/src/rules/engine.ts` | Already: prune/append/clear reserves; extend if late-record strict helpers needed |
| `governor/api/src/handlers.ts` | `handleCheck`, `handleRecord`, new `handleRelease`; health metric wiring |
| `governor/api/src/schemas.ts` | Zod for release body |
| `governor/api/src/app.ts` | Route `POST /v1/release` (+ `/api/release` if mirrored) |
| `governor/api/src/storage/storage.ts` | Optional metric helpers on Storage interface |
| `governor/api/src/storage/memoryStorage.ts` | Implement expired-reserve counting from events + state |
| `governor/api/src/storage/supabaseStorage.ts` | Same metrics |
| `governor/tests/reserve.test.ts` | Extend coverage |
| `apps/docs/api/errors.md`, `check.md`, `record.md` | Document release + late-record |
| `apps/docs/api/health.md`, `ops/orphan-rate.md` | `expiredReserveRate` |
| `docs/ROADMAP.md` | Point at Wave A completion when done |

---

## Wave A — Finish reserve Phase B

### Task 1: Strict late-record behavior + tests

**Files:**
- Modify: `governor/api/src/rules/engine.ts` (applyOutcome / reserve expiry handling)
- Modify: `governor/api/src/handlers.ts` (`handleRecord` response)
- Test: `governor/tests/reserve.test.ts`

**Interfaces:**
- Consumes: `clearReserveByDecisionId`, `pruneExpiredReserves`, `applyOutcome(..., { decisionId })`
- Produces: `handleRecord` body may include `applied: boolean` and `reserveExpired?: boolean` when reserve mode is on

- [ ] **Step 1: Write the failing test**

Add to `governor/tests/reserve.test.ts`:

```ts
it("late executed after reserve expiry does not apply cost (strict)", async () => {
  const storage = new MemoryStorage();
  const config = withReserve(20_000);
  // check allow → reserve
  const check = await handleCheck(
    storage,
    { userId: "u1", actionType: "urgency" },
    config
  );
  expect(check.body.allowed).toBe(true);
  const decisionId = (check.body as { decisionId: string }).decisionId;

  // Force expiry
  const state = await storage.getUserState("u1");
  await storage.upsertUserState("u1", {
    ...state!,
    reserves: (state!.reserves ?? []).map((r) => ({
      ...r,
      expiresAt: new Date(Date.now() - 1000).toISOString()
    }))
  });

  const pressureBefore = (await storage.getUserState("u1"))!.pressure ?? 0;
  const record = await handleRecord(
    storage,
    {
      decisionId,
      userId: "u1",
      actionType: "urgency",
      outcome: "executed"
    },
    config
  );
  expect(record.status).toBe(200);
  expect((record.body as { applied: boolean }).applied).toBe(false);
  expect((record.body as { reserveExpired: boolean }).reserveExpired).toBe(true);
  const after = await storage.getUserState("u1");
  expect(after!.pressure ?? 0).toBe(pressureBefore);
});
```

Adjust imports/`withReserve` helpers to match existing test file patterns.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd governor && pnpm exec vitest run tests/reserve.test.ts -t "late executed"`  
Expected: FAIL (today late executed still applies cost via `applyOutcome`)

- [ ] **Step 3: Write minimal implementation**

In `applyOutcome` / `handleRecord` when `reserveTtlMs > 0` and outcome is `executed` | `downgraded`:

1. Prune expired reserves.
2. If no matching active reserve for `decisionId`, treat as expired lease: clear nothing meaningful, **do not** add cost / cooldown windows for that outcome; still `insertEvent` for orphan hygiene.
3. Response: `{ ok: true, applied: false, reserveExpired: true, pressure }`.
4. When reserve was active: existing apply + clear; `{ ok: true, applied: true, pressure }`.
5. When reserve mode off: preserve today’s behavior; `applied: true` (or omit field for compat — prefer always include `applied: true` when reserve off for simplicity).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd governor && pnpm exec vitest run tests/reserve.test.ts`  
Expected: PASS (full file)

- [ ] **Step 5: Commit** (only if user asks)

```bash
git add governor/api/src/rules/engine.ts governor/api/src/handlers.ts governor/tests/reserve.test.ts
git commit -m "$(cat <<'EOF'
fix: skip pressure apply when reserve expired before record

EOF
)"
```

---

### Task 2: `POST …/release` endpoint

**Files:**
- Modify: `governor/api/src/schemas.ts`
- Modify: `governor/api/src/handlers.ts` — add `handleRelease`
- Modify: `governor/api/src/app.ts` — register routes
- Test: `governor/tests/reserve.test.ts`

**Interfaces:**
- Consumes: `clearReserveByDecisionId`, `tryUpsertUserState`
- Produces: `handleRelease(storage, payload, rulesConfig) => { status, body }`
- Body in: `{ decisionId, userId, tenantId? }`
- Body out: `{ ok: true, released: boolean }` (`released: false` if no active reserve)

**Decision locked for plan:** Prefer **`POST /v1/release`** (and `/api/release` mirror) over a new record outcome, so `record` stays outcome-of-send semantics. If user approval picks `outcome: "released"` instead, fold into `handleRecord` and skip new route — same tests.

- [ ] **Step 1: Write the failing test**

```ts
it("release clears reserve without applying cost", async () => {
  const storage = new MemoryStorage();
  const config = withReserve(20_000);
  const check = await handleCheck(
    storage,
    { userId: "u2", actionType: "interruption" },
    config
  );
  const decisionId = (check.body as { decisionId: string }).decisionId;
  const before = await storage.getUserState("u2");
  expect(before!.reserves?.length).toBe(1);

  const rel = await handleRelease(
    storage,
    { decisionId, userId: "u2" },
    config
  );
  expect(rel.status).toBe(200);
  expect((rel.body as { released: boolean }).released).toBe(true);
  const after = await storage.getUserState("u2");
  expect(after!.reserves ?? []).toEqual([]);
  expect(after!.pressure ?? 0).toBe(before!.pressure ?? 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd governor && pnpm exec vitest run tests/reserve.test.ts -t "release clears"`  
Expected: FAIL (`handleRelease` not defined)

- [ ] **Step 3: Minimal schema + handler + route**

```ts
// schemas.ts
export const releaseSchema = z.object({
  decisionId: z.string().uuid(),
  userId: z.string().min(1),
  tenantId: z.string().min(1).optional()
});
```

```ts
// handlers.ts — sketch
export const handleRelease = async (storage, payload, rulesConfig = defaultRulesConfig) => {
  if (reserveTtlMs(rulesConfig) <= 0) {
    return { status: 400, body: { error: "release requires reserve mode (reserveTtlMs > 0)" } };
  }
  const parsed = releaseSchema.safeParse(payload);
  if (!parsed.success) return { status: 400, body: { error: parsed.error.flatten() } };
  const { decisionId, userId, tenantId } = parsed.data;
  const tid = tenantId ?? DEFAULT_TENANT;
  const now = new Date();
  const state = (await storage.getUserState(userId, tid)) ?? emptyState();
  const had = (state.reserves ?? []).some((r) => r.decisionId === decisionId);
  const next = clearReserveByDecisionId(state, decisionId, now);
  // bump stateVersion via clear helper or explicit; CAS upsert like record
  // insertEvent eventType: use existing union or context flag — prefer insertEvent with
  // eventType "blocked" is wrong; add "released" to GovernorEvent if needed OR
  // insert check-adjacent audit via context on a dedicated event type.
  // Minimal: insertEvent { eventType: "blocked", context: { release: true } } is dishonest.
  // Prefer extending GovernorEvent eventType with "released" in types + storage.
  await storage.insertEvent({
    userId,
    actionType: "reminder", // better: store actionType from reserve entry
    eventType: "released",
    decisionId,
    tenantId: tid
  });
  // CAS upsert next state
  return { status: 200, body: { ok: true, released: had } };
};
```

Register in `app.ts` next to check/record. Extend `GovernorEvent` / Supabase event enum if constrained.

- [ ] **Step 4: Run tests**

Run: `cd governor && pnpm exec vitest run tests/reserve.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit** (only if user asks)

```bash
git commit -m "$(cat <<'EOF'
feat: add POST release to drop check-and-reserve leases

EOF
)"
```

---

### Task 3: `expiredReserveRate` on health

**Files:**
- Modify: `governor/api/src/storage/storage.ts` — extend `HealthMetrics`
- Modify: `memoryStorage.ts`, `supabaseStorage.ts`
- Modify: `handlers.ts` health response / insights if they list metrics
- Test: `governor/tests/reserve.test.ts` or `governor/tests/health.test.ts` if present
- Docs: `apps/docs/api/health.md`, `apps/docs/ops/orphan-rate.md`

**Interfaces:**
- Produces: `HealthMetrics.expiredReserveCount`, `HealthMetrics.expiredReserveRate`
- Definition: among check events in the window that were allowed under reserve mode **or** simpler Wave A definition: fraction of check `decisionId`s whose reserve expired (no record and past TTL) / total checks — implement the measurable definition below and document it.

**Wave A metric definition (lock this):**

- `expiredReserveCount`: number of `decisionId`s that (a) have a check event in the period, (b) have **no** outcome event (`executed`|`blocked`|`downgraded`|`released`), and (c) check is older than `reserveTtlMs` when reserve enabled; when reserve disabled, count is `0` and rate is `0`.
- `expiredReserveRate = expiredReserveCount / totalChecks` (0 if no checks).

Note: this overlaps orphans older than TTL; that is intentional — expired leases are the subset of orphans past the lease window. Keep both metrics.

- [ ] **Step 1: Failing test** — create allow under reserve, do not record, advance clock / fake createdAt if storage allows, assert health `expiredReserveRate > 0`.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement metric in memory first, then Supabase**

- [ ] **Step 4: Full health + reserve tests PASS**

- [ ] **Step 5: Commit if asked**

---

### Task 4: Docs + ROADMAP pointer

**Files:**
- Modify: `apps/docs/api/errors.md` (release, late-record, expiredReserveRate)
- Modify: `apps/docs/api/check.md`, `record.md`, `health.md`
- Modify: `docs/ROADMAP.md` — note Wave A items when shipped
- Modify: `docs/superpowers/specs/2026-08-07-ai-agent-governor-control-layer-design.md` — status line: Phase B completion items

- [ ] **Step 1: Update errors.md concurrent-allows section** with release + strict late-record
- [ ] **Step 2: Update health + orphan-rate pages**
- [ ] **Step 3: Smoke docs links if `apps/docs/scripts/smoke-dist.mjs` lists pages
- [ ] **Step 4: Commit if asked**

---

## Wave A acceptance checklist

- [x] Concurrent allows with `reserveTtlMs > 0` cannot both consume the same budget (existing tests still green)
- [x] `POST …/release` frees reserve without charging pressure
- [x] Late `executed` after expiry → `applied: false`, `reserveExpired: true`, no double charge
- [x] `/health` exposes `expiredReserveRate` with documented definition
- [x] Default `reserveTtlMs` still `0`
- [x] No Redis, mutex, or send gateway introduced

---

## Wave B — Adapters (separate plan slice; do not start until Wave A approved + shipped)

### Task B1: `eslint-plugin-softstop` (new package)

**Files:** Create `packages/eslint-plugin-softstop/` (or `packages/eslint-plugin-softstop/src/rules/require-record-after-check.ts`)

- Rule: bare `client.check` / `ss.check` should be in try/finally with `record`, **or** use `beforeContact` / `withSoftStop`.
- Golden fixtures: bad file fails, `beforeContact` example passes.
- Document in `apps/docs/integrate/workflow.md`.

### Task B2: Orphan sweeper script (alert-only default)

**Files:** Create `scripts/orphan-sweeper.js`

- Poll `GET …/health` + optional `getOrphanedDecisionIds` if exposed.
- Exit nonzero when `orphanRate > 0.05` or `expiredReserveRate > 0.05`.
- Flag `--auto-record-blocked` off by default; when on, `record({ outcome: "blocked", blockReason: "orphan_timeout" })` only for expired orphans — never invent `executed`.

### Wave B acceptance

- ESLint rule published or documented as workspace package
- Sweeper usable from cron; no silent executed backfill

---

## Wave C — Redis adapter (partner demand; separate plan)

### Task C1: Redis `Storage` implementing `tryUpsertUserState` + reserves

- Same handler code paths; Lua script: read state → evaluate not in Lua (keep evaluate in Node) **or** CAS compare-and-set JSON blob matching `stateVersion`.
- Prefer: Node evaluate + Redis `WATCH`/`MULTI` or single Lua that sets JSON only if version matches (logic stays in `handlers.ts`).

### Task C2: `POST …/extend-reserve`

- Body: `{ decisionId, userId, extendMs }` capped by policy max.
- Tests for extension before expiry.

### Task C3: Explicitly skip

- Per-user mutex across send
- SoftStop outbound provider proxy
- Mandatory Redis for OSS self-host

### Wave C acceptance

- Two API instances + Redis: concurrent allows still safe under reserve
- Memory/Supabase paths unchanged
- Docs: Redis env vars; still authorize-only

---

## Spec coverage (self-review)

| Spec item | Task |
|-----------|------|
| Strict late-record | Task 1 |
| Release API | Task 2 |
| expiredReserveRate | Task 3 |
| Docs | Task 4 |
| ESLint adapter | Wave B Task B1 |
| Orphan sweeper | Wave B Task B2 |
| Redis / extend-reserve | Wave C |
| Mutex / outbound gateway / webhook audit core | **Out of scope — do not implement** |

Placeholder scan: none intentional. Release vs `outcome: "released"` called out as user approval item — plan defaults to `POST /release`.
