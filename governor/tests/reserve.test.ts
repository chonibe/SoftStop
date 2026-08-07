import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../api/src/app";
import { handleCheck, handleRecord, handleRelease } from "../api/src/handlers";
import { MemoryStorage } from "../api/src/storage/memoryStorage";
import { defaultRulesConfig, GovernorRulesConfig } from "../api/src/rules/config";
import {
  activeReserveCost,
  applyOutcome,
  emptyState,
  evaluateCheck,
  pruneExpiredReserves
} from "../api/src/rules/engine";
import { GovernorUserState } from "../api/src/types";

const withReserve = (
  ttlMs: number,
  overrides: Partial<GovernorRulesConfig> = {}
): GovernorRulesConfig => ({
  ...defaultRulesConfig,
  cooldownHours: { ...defaultRulesConfig.cooldownHours },
  typeCap: { ...defaultRulesConfig.typeCap },
  costs: { ...defaultRulesConfig.costs },
  reserveTtlMs: ttlMs,
  ...overrides
});

describe("check-and-reserve", () => {
  it("legacy/builtin rulesConfig (reserveTtlMs=0): check does not write state or return reserveExpiresAt", async () => {
    const storage = new MemoryStorage();
    const app = createApp(storage);

    const response = await request(app).post("/v1/check").send({
      userId: "legacy_user",
      actionType: "urgency"
    });

    expect(response.status).toBe(200);
    expect(response.body.allowed).toBe(true);
    expect(response.body.reserveExpiresAt).toBeUndefined();
    expect(await storage.getUserState("legacy_user")).toBeNull();
  });

  it("production/supabase path enables reserve by default unless SOFTSTOP_RESERVE=off", async () => {
    const { resolveReserveTtlMs, assertProductionReserveSafety } = await import(
      "../api/src/env"
    );
    expect(
      resolveReserveTtlMs(
        { GOVERNOR_STORAGE: "supabase" },
        { useSupabase: true }
      )
    ).toBe(20_000);
    expect(
      resolveReserveTtlMs(
        { GOVERNOR_STORAGE: "supabase", SOFTSTOP_RESERVE: "off" },
        { useSupabase: true }
      )
    ).toBe(0);
    expect(
      resolveReserveTtlMs(
        {
          GOVERNOR_STORAGE: "supabase",
          SOFTSTOP_UNSAFE_LEGACY_CHECK: "1"
        },
        { useSupabase: true }
      )
    ).toBe(0);
    expect(resolveReserveTtlMs({}, { useSupabase: false })).toBe(0);

    // SOFTSTOP_RESERVE=off alone refuses Supabase startup
    expect(() =>
      assertProductionReserveSafety(
        { GOVERNOR_STORAGE: "supabase", SOFTSTOP_RESERVE: "off" },
        { useSupabase: true, reserveTtlMs: 0 }
      )
    ).toThrow(/REFUSING|UNSAFE_LEGACY_CHECK/);

    // Escape hatch allows with warning
    const warnings: string[] = [];
    expect(() =>
      assertProductionReserveSafety(
        {
          GOVERNOR_STORAGE: "supabase",
          SOFTSTOP_UNSAFE_LEGACY_CHECK: "1"
        },
        {
          useSupabase: true,
          reserveTtlMs: 0,
          warn: (m) => warnings.push(m)
        }
      )
    ).not.toThrow();
    expect(warnings.some((w) => /UNSAFE legacy/i.test(w))).toBe(true);

    // Safe default (reserve on) is fine
    expect(() =>
      assertProductionReserveSafety(
        { GOVERNOR_STORAGE: "supabase" },
        { useSupabase: true, reserveTtlMs: 20_000 }
      )
    ).not.toThrow();
  });

  it("reserve on: allow returns reserveExpiresAt and holds cost in state", async () => {
    const storage = new MemoryStorage();
    const ttlMs = 20_000;
    const app = createApp(storage, { rulesConfig: withReserve(ttlMs) });
    const before = Date.now();

    const response = await request(app).post("/v1/check").send({
      userId: "reserve_user",
      actionType: "urgency"
    });

    expect(response.status).toBe(200);
    expect(response.body.allowed).toBe(true);
    expect(response.body.reserveExpiresAt).toBeTruthy();
    const expiresAt = new Date(response.body.reserveExpiresAt as string).getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + ttlMs - 50);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + ttlMs + 50);

    const state = await storage.getUserState("reserve_user");
    expect(state?.reserves?.length).toBe(1);
    expect(state?.reserves?.[0]?.decisionId).toBe(response.body.decisionId);
    expect(state?.reserves?.[0]?.cost).toBe(40);
    expect(state?.stateVersion).toBe(1);
  });

  it("concurrent double-check: only one allow when reserve would exhaust budget", async () => {
    const storage = new MemoryStorage();
    const app = createApp(storage, { rulesConfig: withReserve(20_000) });
    // 60 + 40 = 100 allowed; a held reserve of 40 makes the next urgency exceed.
    await storage.upsertUserState("race_user", {
      ...emptyState(),
      pressure: 60,
      pressureUpdatedAt: new Date().toISOString()
    });

    const [a, b] = await Promise.all([
      request(app).post("/v1/check").send({
        userId: "race_user",
        actionType: "urgency"
      }),
      request(app).post("/v1/check").send({
        userId: "race_user",
        actionType: "urgency"
      })
    ]);

    const allowed = [a, b].filter((r) => r.body.allowed === true);
    const denied = [a, b].filter((r) => r.body.allowed === false);

    expect(allowed).toHaveLength(1);
    expect(denied).toHaveLength(1);
    expect(denied[0].body.reason).toBe("pressure_exceeded");

    const state = await storage.getUserState("race_user");
    expect(state?.reserves?.length).toBe(1);
  });

  it("expired reserves are dropped and no longer hold budget", async () => {
    const now = new Date();
    const expired: GovernorUserState = {
      ...emptyState(),
      pressure: 60,
      pressureUpdatedAt: now.toISOString(),
      reserves: [
        {
          decisionId: "old-reserve",
          actionType: "urgency",
          cost: 40,
          expiresAt: new Date(now.getTime() - 1000).toISOString()
        }
      ],
      stateVersion: 1
    };

    const pruned = pruneExpiredReserves(expired, now);
    expect(pruned.reserves).toEqual([]);
    expect(activeReserveCost(pruned, now)).toBe(0);

    const decision = evaluateCheck(
      pruned,
      "urgency",
      now,
      withReserve(20_000)
    );
    expect(decision.allowed).toBe(true);
  });

  it("active reserve blocks a second check that would exceed threshold", () => {
    const now = new Date();
    const state: GovernorUserState = {
      ...emptyState(),
      pressure: 60,
      pressureUpdatedAt: now.toISOString(),
      reserves: [
        {
          decisionId: "held",
          actionType: "urgency",
          cost: 40,
          expiresAt: new Date(now.getTime() + 20_000).toISOString()
        }
      ],
      stateVersion: 1
    };

    const decision = evaluateCheck(state, "urgency", now, withReserve(20_000));
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("pressure_exceeded");
    // effective pressure includes active reserve hold
    expect(decision.pressure).toBe(100);
    expect(decision.projectedPressure).toBe(140);
  });

  it("late executed after reserve expiry does not apply cost (strict)", async () => {
    const storage = new MemoryStorage();
    const config = withReserve(20_000);
    const check = await handleCheck(
      storage,
      { userId: "u1", actionType: "urgency" },
      config
    );
    const checkBody = check.body as { allowed?: boolean; decisionId?: string };
    expect(checkBody.allowed).toBe(true);
    const decisionId = checkBody.decisionId!;

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

  it("health reports expiredReserveRate when reserved check ages past TTL", async () => {
    const storage = new MemoryStorage();
    const ttlMs = 20_000;
    const app = createApp(storage, { rulesConfig: withReserve(ttlMs) });

    await request(app).post("/v1/check").send({
      userId: "expire_metric",
      actionType: "urgency"
    });

    const checkEvent = storage.events.find((e) => e.eventType === "check");
    expect(checkEvent).toBeTruthy();
    checkEvent!.createdAt = new Date(Date.now() - ttlMs - 1000).toISOString();

    const health = await request(app).get("/v1/health").query({ periodHours: 24 });
    expect(health.status).toBe(200);
    expect(health.body.metrics.expiredReserveCount).toBe(1);
    expect(health.body.metrics.expiredReserveRate).toBe(1);
  });

  it("record clears matching reserve and applies cost once", async () => {
    const storage = new MemoryStorage();
    const app = createApp(storage, { rulesConfig: withReserve(20_000) });

    const check = await request(app).post("/v1/check").send({
      userId: "record_clear",
      actionType: "urgency"
    });
    expect(check.body.allowed).toBe(true);
    expect(check.body.reserveExpiresAt).toBeTruthy();

    const held = await storage.getUserState("record_clear");
    expect(held?.reserves?.length).toBe(1);

    const record = await request(app).post("/v1/record").send({
      userId: "record_clear",
      actionType: "urgency",
      outcome: "executed",
      decisionId: check.body.decisionId
    });
    expect(record.status).toBe(200);
    expect(record.body.ok).toBe(true);

    const state = await storage.getUserState("record_clear");
    expect(state?.reserves ?? []).toEqual([]);
    expect(state?.pressure).toBe(40);
  });

  it("applyOutcome clears reserve by decisionId", () => {
    const now = new Date();
    const state: GovernorUserState = {
      ...emptyState(),
      reserves: [
        {
          decisionId: "d1",
          actionType: "urgency",
          cost: 40,
          expiresAt: new Date(now.getTime() + 20_000).toISOString()
        }
      ],
      stateVersion: 1
    };

    const next = applyOutcome(
      state,
      "urgency",
      "executed",
      {},
      now,
      withReserve(20_000),
      { decisionId: "d1" }
    );
    expect(next.reserves ?? []).toEqual([]);
    expect(next.pressure).toBe(40);
  });

  it("MemoryStorage OCC rejects stale stateVersion writes", async () => {
    const storage = new MemoryStorage();
    await storage.upsertUserState("occ_user", {
      ...emptyState(),
      stateVersion: 2
    });

    const result = await storage.tryUpsertUserState(
      "occ_user",
      { ...emptyState(), pressure: 40, stateVersion: 3, reserves: [] },
      1
    );
    expect(result).toBe("conflict");

    const ok = await storage.tryUpsertUserState(
      "occ_user",
      { ...emptyState(), pressure: 40, stateVersion: 3, reserves: [] },
      2
    );
    expect(ok).toBe("ok");
    expect((await storage.getUserState("occ_user"))?.stateVersion).toBe(3);
  });
});
