/**
 * Concurrency stress.
 * - MemoryStorage path always runs in unit CI.
 * - Real Postgres RPC presence checked when SOFTSTOP_PG_STRESS=1 + DATABASE_URL
 *   (uses `psql`, no node-pg dependency).
 */
import { describe, expect, it } from "vitest";
import { execFileSync } from "child_process";
import request from "supertest";
import { createApp } from "../api/src/app";
import { MemoryStorage } from "../api/src/storage/memoryStorage";
import { defaultRulesConfig } from "../api/src/rules/config";
import { emptyState } from "../api/src/rules/engine";

const pgEnabled =
  process.env.SOFTSTOP_PG_STRESS === "1" && Boolean(process.env.DATABASE_URL);

describe.skipIf(!pgEnabled)("Postgres RPC presence", () => {
  it("softstop_* RPCs exist after migrations", () => {
    const out = execFileSync(
      "psql",
      [
        process.env.DATABASE_URL!,
        "-tAc",
        `SELECT string_agg(proname, ',' ORDER BY proname)
         FROM pg_proc
         WHERE proname LIKE 'softstop_%'`
      ],
      { encoding: "utf8" }
    ).trim();
    expect(out).toContain("softstop_check_and_reserve");
    expect(out).toContain("softstop_record_decision");
    expect(out).toContain("softstop_merge_users");
  });
});

describe("MemoryStorage concurrency stress", () => {
  it("dozens of concurrent checks with reserve: at most one allow when budget tight", async () => {
    const storage = new MemoryStorage();
    const app = createApp(storage, {
      rulesConfig: {
        ...defaultRulesConfig,
        reserveTtlMs: 20_000,
        threshold: 100,
        costs: { ...defaultRulesConfig.costs, urgency: 40 }
      }
    });
    await storage.upsertUserState("stress_user", {
      ...emptyState(),
      pressure: 70,
      pressureUpdatedAt: new Date().toISOString(),
      stateVersion: 0
    });

    const results = await Promise.all(
      Array.from({ length: 40 }, () =>
        request(app).post("/v1/check").send({
          userId: "stress_user",
          actionType: "urgency"
        })
      )
    );

    const allows = results.filter((r) => r.status === 200 && r.body.allowed);
    const conflicts = results.filter((r) => r.status === 409);
    const denies = results.filter(
      (r) => r.status === 200 && r.body.allowed === false
    );

    // 70 + 40 = 110 > 100 → first reserve can allow; rest deny or 409
    expect(allows.length).toBeLessThanOrEqual(1);
    expect(allows.length + denies.length + conflicts.length).toBe(40);
  });
});
