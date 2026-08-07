/**
 * Concurrency stress.
 * - MemoryStorage path always runs in unit CI.
 * - Real Postgres RPC contention when SOFTSTOP_PG_STRESS=1 + DATABASE_URL
 *   (uses `psql`, no node-pg dependency).
 *
 * Re-run locally:
 *   createdb softstop_stress  # or use DATABASE_URL
 *   for f in governor/api/db/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done
 *   SOFTSTOP_PG_STRESS=1 DATABASE_URL=postgres:///softstop_stress \
 *     pnpm exec vitest run --config vitest.config.ts governor/tests/pg-concurrency.stress.test.ts
 */
import { describe, expect, it, beforeAll } from "vitest";
import { execFileSync, spawn, spawnSync } from "child_process";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import request from "supertest";
import { createApp } from "../api/src/app";
import { MemoryStorage } from "../api/src/storage/memoryStorage";
import { defaultRulesConfig } from "../api/src/rules/config";
import { emptyState } from "../api/src/rules/engine";

const pgEnabled =
  process.env.SOFTSTOP_PG_STRESS === "1" && Boolean(process.env.DATABASE_URL);

const migrationsDir = path.resolve(__dirname, "../api/db/migrations");

function psql(sql: string): string {
  return execFileSync(
    "psql",
    [process.env.DATABASE_URL!, "-v", "ON_ERROR_STOP=1", "-tAc", sql],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }
  ).trim();
}

function sqlLit(value: string | number | null): string {
  if (value === null) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

function applyMigrations(): void {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const full = path.join(migrationsDir, file);
    const r = spawnSync(
      "psql",
      [process.env.DATABASE_URL!, "-v", "ON_ERROR_STOP=1", "-f", full],
      { encoding: "utf8" }
    );
    if (r.status !== 0) {
      throw new Error(`Migration ${file} failed: ${r.stderr || r.stdout}`);
    }
  }
}

describe.skipIf(!pgEnabled)("Postgres RPC contention", () => {
  const tenantId = "default";
  const userId = "pg_stress_user";

  beforeAll(() => {
    applyMigrations();
  });

  it("softstop_* RPCs exist after migrations", () => {
    const out = psql(
      `SELECT string_agg(proname, ',' ORDER BY proname)
       FROM pg_proc
       WHERE proname LIKE 'softstop_%'`
    );
    expect(out).toContain("softstop_check_and_reserve");
    expect(out).toContain("softstop_record_decision");
    expect(out).toContain("softstop_merge_users");
  });

  it("parallel check_and_reserve: never two winners on same version; pressure coherent", async () => {
    const cost = 40;
    const threshold = 100;
    const startPressure = 0;
    // Budget allows floor(100/40)=2 reserves before effective pressure blocks in app;
    // at RPC layer we race N attempts each trying expectedVersion=0 — only ONE may win.
    psql(
      `DELETE FROM softstop_decisions WHERE tenant_id=${sqlLit(tenantId)} AND user_id=${sqlLit(userId)};
       DELETE FROM governor_events WHERE tenant_id=${sqlLit(tenantId)} AND user_id=${sqlLit(userId)};
       DELETE FROM governor_user_state WHERE tenant_id=${sqlLit(tenantId)} AND user_id=${sqlLit(userId)};`
    );
    const baseState = {
      ...emptyState(),
      pressure: startPressure,
      pressureUpdatedAt: new Date().toISOString(),
      stateVersion: 0
    };
    psql(
      `INSERT INTO governor_user_state (tenant_id, user_id, state, updated_at)
       VALUES (${sqlLit(tenantId)}, ${sqlLit(userId)}, ${sqlLit(JSON.stringify(baseState))}::jsonb, now());`
    );

    const n = 32;
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const sqls = Array.from({ length: n }, () => {
      const decisionId = randomUUID();
      const nextState = {
        ...baseState,
        reserves: [
          {
            decisionId,
            actionType: "urgency",
            cost,
            expiresAt
          }
        ],
        stateVersion: 1
      };
      return `SELECT softstop_check_and_reserve(
        ${sqlLit(tenantId)},
        ${sqlLit(userId)},
        ${sqlLit(decisionId)}::uuid,
        'urgency',
        0,
        ${sqlLit(JSON.stringify(nextState))}::jsonb,
        '{}'::jsonb,
        ${sqlLit(expiresAt)}::timestamptz,
        ${cost}
      )::text;`;
    });

    const results = await Promise.all(
      sqls.map(
        (sql) =>
          new Promise<string>((resolve, reject) => {
            const child = spawn(
              "psql",
              [process.env.DATABASE_URL!, "-v", "ON_ERROR_STOP=1", "-tAc", sql],
              { stdio: ["ignore", "pipe", "pipe"] }
            );
            let out = "";
            let err = "";
            child.stdout.on("data", (d: Buffer) => {
              out += d.toString();
            });
            child.stderr.on("data", (d: Buffer) => {
              err += d.toString();
            });
            child.on("close", (code) => {
              if (code !== 0) reject(new Error(err || `psql ${code}`));
              else resolve(out.trim());
            });
          })
      )
    );

    const parsed = results.map((r) => JSON.parse(r) as { ok: boolean; error?: string });
    const oks = parsed.filter((p) => p.ok);
    const conflicts = parsed.filter((p) => !p.ok && p.error === "conflict");
    expect(oks.length).toBe(1);
    expect(conflicts.length).toBe(n - 1);

    const stateRaw = psql(
      `SELECT state::text FROM governor_user_state
       WHERE tenant_id=${sqlLit(tenantId)} AND user_id=${sqlLit(userId)}`
    );
    const state = JSON.parse(stateRaw) as {
      stateVersion: number;
      reserves?: { cost: number }[];
      pressure?: number;
    };
    expect(state.stateVersion).toBe(1);
    expect(state.reserves?.length).toBe(1);
    expect((state.pressure ?? 0) + (state.reserves?.[0]?.cost ?? 0)).toBeLessThanOrEqual(
      threshold
    );

    const decisionCount = Number(
      psql(
        `SELECT count(*) FROM softstop_decisions
         WHERE tenant_id=${sqlLit(tenantId)} AND user_id=${sqlLit(userId)} AND status='reserved'`
      )
    );
    expect(decisionCount).toBe(1);
  });

  it("record_decision: never two different terminals; retries idempotent", () => {
    const decisionId = randomUUID();
    const uid = "pg_record_user";
    psql(
      `DELETE FROM softstop_decisions WHERE tenant_id=${sqlLit(tenantId)} AND user_id=${sqlLit(uid)};
       DELETE FROM governor_events WHERE tenant_id=${sqlLit(tenantId)} AND user_id=${sqlLit(uid)};
       DELETE FROM governor_user_state WHERE tenant_id=${sqlLit(tenantId)} AND user_id=${sqlLit(uid)};`
    );
    const reserved = {
      ...emptyState(),
      pressure: 0,
      stateVersion: 1,
      reserves: [
        {
          decisionId,
          actionType: "urgency",
          cost: 40,
          expiresAt: new Date(Date.now() + 60_000).toISOString()
        }
      ]
    };
    psql(
      `INSERT INTO governor_user_state (tenant_id, user_id, state, updated_at)
       VALUES (${sqlLit(tenantId)}, ${sqlLit(uid)}, ${sqlLit(JSON.stringify(reserved))}::jsonb, now());
       INSERT INTO softstop_decisions (decision_id, tenant_id, user_id, action_type, status, cost)
       VALUES (${sqlLit(decisionId)}::uuid, ${sqlLit(tenantId)}, ${sqlLit(uid)}, 'urgency', 'reserved', 40);`
    );

    const executedState = {
      ...emptyState(),
      pressure: 40,
      pressureUpdatedAt: new Date().toISOString(),
      stateVersion: 2,
      reserves: []
    };
    const blockedState = {
      ...emptyState(),
      pressure: 0,
      stateVersion: 2,
      reserves: []
    };

    const r1 = JSON.parse(
      psql(
        `SELECT softstop_record_decision(
          ${sqlLit(tenantId)}, ${sqlLit(uid)}, ${sqlLit(decisionId)}::uuid,
          'urgency', 'executed', 1,
          ${sqlLit(JSON.stringify(executedState))}::jsonb, '{}'::jsonb
        )::text;`
      )
    ) as { ok: boolean; status?: string };
    expect(r1.ok).toBe(true);
    expect(r1.status).toBe("executed");

    // Idempotent same terminal
    const r2 = JSON.parse(
      psql(
        `SELECT softstop_record_decision(
          ${sqlLit(tenantId)}, ${sqlLit(uid)}, ${sqlLit(decisionId)}::uuid,
          'urgency', 'executed', 1,
          ${sqlLit(JSON.stringify(executedState))}::jsonb, '{}'::jsonb
        )::text;`
      )
    ) as { ok: boolean; idempotent?: boolean; status?: string };
    expect(r2.ok).toBe(true);
    expect(r2.idempotent).toBe(true);

    // Conflicting terminal rejected
    const r3 = JSON.parse(
      psql(
        `SELECT softstop_record_decision(
          ${sqlLit(tenantId)}, ${sqlLit(uid)}, ${sqlLit(decisionId)}::uuid,
          'urgency', 'blocked', 2,
          ${sqlLit(JSON.stringify(blockedState))}::jsonb, '{}'::jsonb
        )::text;`
      )
    ) as { ok: boolean; error?: string; status?: string };
    expect(r3.ok).toBe(false);
    expect(r3.error).toBe("already_terminal");
    expect(r3.status).toBe("executed");

    const status = psql(
      `SELECT status FROM softstop_decisions WHERE decision_id=${sqlLit(decisionId)}::uuid`
    );
    expect(status).toBe("executed");

    const execEvents = Number(
      psql(
        `SELECT count(*) FROM governor_events
         WHERE decision_id=${sqlLit(decisionId)}::uuid AND event_type='executed'`
      )
    );
    expect(execEvents).toBe(1);

    const finalPressure = Number(
      psql(
        `SELECT (state->>'pressure')::float FROM governor_user_state
         WHERE tenant_id=${sqlLit(tenantId)} AND user_id=${sqlLit(uid)}`
      )
    );
    expect(finalPressure).toBe(40);
  });

  it("serialized retry loop never loses pressure increments under contention", async () => {
    const uid = "pg_retry_user";
    const cost = 40;
    psql(
      `DELETE FROM softstop_decisions WHERE tenant_id=${sqlLit(tenantId)} AND user_id=${sqlLit(uid)};
       DELETE FROM governor_events WHERE tenant_id=${sqlLit(tenantId)} AND user_id=${sqlLit(uid)};
       DELETE FROM governor_user_state WHERE tenant_id=${sqlLit(tenantId)} AND user_id=${sqlLit(uid)};`
    );
    psql(
      `INSERT INTO governor_user_state (tenant_id, user_id, state, updated_at)
       VALUES (${sqlLit(tenantId)}, ${sqlLit(uid)}, ${sqlLit(JSON.stringify({
         ...emptyState(),
         pressure: 0,
         stateVersion: 0
       }))}::jsonb, now());`
    );

    // Mimic handler CAS retries: each worker reads version, tries reserve, retries on conflict.
    const workers = 8;
    async function worker(): Promise<"ok" | "denied"> {
      for (let attempt = 0; attempt < 20; attempt++) {
        const raw = psql(
          `SELECT state::text FROM governor_user_state
           WHERE tenant_id=${sqlLit(tenantId)} AND user_id=${sqlLit(uid)}`
        );
        const state = JSON.parse(raw) as {
          stateVersion: number;
          pressure?: number;
          reserves?: { cost: number; decisionId: string; expiresAt: string }[];
        };
        const held = (state.reserves ?? []).reduce((s, r) => s + r.cost, 0);
        const effective = (state.pressure ?? 0) + held;
        if (effective + cost > 100) return "denied";

        const decisionId = randomUUID();
        const expiresAt = new Date(Date.now() + 60_000).toISOString();
        const nextState = {
          ...state,
          reserves: [
            ...(state.reserves ?? []),
            { decisionId, actionType: "urgency", cost, expiresAt }
          ],
          stateVersion: (state.stateVersion ?? 0) + 1
        };
        const result = JSON.parse(
          psql(
            `SELECT softstop_check_and_reserve(
              ${sqlLit(tenantId)}, ${sqlLit(uid)}, ${sqlLit(decisionId)}::uuid,
              'urgency', ${state.stateVersion ?? 0},
              ${sqlLit(JSON.stringify(nextState))}::jsonb, '{}'::jsonb,
              ${sqlLit(expiresAt)}::timestamptz, ${cost}
            )::text;`
          )
        ) as { ok: boolean };
        if (result.ok) return "ok";
      }
      return "denied";
    }

    const outcomes = await Promise.all(
      Array.from({ length: workers }, () => worker())
    );
    const okCount = outcomes.filter((o) => o === "ok").length;
    // threshold 100 / cost 40 → at most 2 reserves
    expect(okCount).toBeLessThanOrEqual(2);
    expect(okCount).toBeGreaterThanOrEqual(1);

    const final = JSON.parse(
      psql(
        `SELECT state::text FROM governor_user_state
         WHERE tenant_id=${sqlLit(tenantId)} AND user_id=${sqlLit(uid)}`
      )
    ) as { reserves?: { cost: number }[]; pressure?: number };
    const held = (final.reserves ?? []).reduce((s, r) => s + r.cost, 0);
    expect((final.pressure ?? 0) + held).toBeLessThanOrEqual(100);
    expect(held).toBe(okCount * cost);

    const reservedRows = Number(
      psql(
        `SELECT count(*) FROM softstop_decisions
         WHERE tenant_id=${sqlLit(tenantId)} AND user_id=${sqlLit(uid)} AND status='reserved'`
      )
    );
    expect(reservedRows).toBe(okCount);
  });

  it("failure injection: aborted reserve leaves coherent journal", () => {
    const uid = "pg_abort_user";
    const decisionId = randomUUID();
    psql(
      `DELETE FROM softstop_decisions WHERE tenant_id=${sqlLit(tenantId)} AND user_id=${sqlLit(uid)};
       DELETE FROM governor_events WHERE tenant_id=${sqlLit(tenantId)} AND user_id=${sqlLit(uid)};
       DELETE FROM governor_user_state WHERE tenant_id=${sqlLit(tenantId)} AND user_id=${sqlLit(uid)};
       INSERT INTO governor_user_state (tenant_id, user_id, state, updated_at)
       VALUES (${sqlLit(tenantId)}, ${sqlLit(uid)}, ${sqlLit(JSON.stringify({
         ...emptyState(),
         stateVersion: 0
       }))}::jsonb, now());`
    );

    // Simulate mid-flight abort: BEGIN, call RPC, ROLLBACK
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const nextState = {
      ...emptyState(),
      reserves: [{ decisionId, actionType: "urgency", cost: 40, expiresAt }],
      stateVersion: 1
    };
    psql(`
      BEGIN;
      SELECT softstop_check_and_reserve(
        ${sqlLit(tenantId)}, ${sqlLit(uid)}, ${sqlLit(decisionId)}::uuid,
        'urgency', 0,
        ${sqlLit(JSON.stringify(nextState))}::jsonb, '{}'::jsonb,
        ${sqlLit(expiresAt)}::timestamptz, 40
      );
      ROLLBACK;
    `);

    const ver = psql(
      `SELECT coalesce((state->>'stateVersion')::int, 0) FROM governor_user_state
       WHERE tenant_id=${sqlLit(tenantId)} AND user_id=${sqlLit(uid)}`
    );
    expect(ver).toBe("0");
    const decisions = Number(
      psql(
        `SELECT count(*) FROM softstop_decisions WHERE decision_id=${sqlLit(decisionId)}::uuid`
      )
    );
    expect(decisions).toBe(0);

    // Successful reserve then aborted conflicting terminal record
    psql(
      `SELECT softstop_check_and_reserve(
        ${sqlLit(tenantId)}, ${sqlLit(uid)}, ${sqlLit(decisionId)}::uuid,
        'urgency', 0,
        ${sqlLit(JSON.stringify(nextState))}::jsonb, '{}'::jsonb,
        ${sqlLit(expiresAt)}::timestamptz, 40
      );`
    );
    const executedState = {
      ...emptyState(),
      pressure: 40,
      stateVersion: 2,
      reserves: []
    };
    psql(`
      BEGIN;
      SELECT softstop_record_decision(
        ${sqlLit(tenantId)}, ${sqlLit(uid)}, ${sqlLit(decisionId)}::uuid,
        'urgency', 'executed', 1,
        ${sqlLit(JSON.stringify(executedState))}::jsonb, '{}'::jsonb
      );
      ROLLBACK;
    `);
    const statusAfterAbort = psql(
      `SELECT status FROM softstop_decisions WHERE decision_id=${sqlLit(decisionId)}::uuid`
    );
    expect(statusAfterAbort).toBe("reserved");
    const ver2 = psql(
      `SELECT (state->>'stateVersion')::text FROM governor_user_state
       WHERE tenant_id=${sqlLit(tenantId)} AND user_id=${sqlLit(uid)}`
    );
    expect(ver2).toBe("1");

    // Commit terminal once — coherent lifecycle
    const committed = JSON.parse(
      psql(
        `SELECT softstop_record_decision(
          ${sqlLit(tenantId)}, ${sqlLit(uid)}, ${sqlLit(decisionId)}::uuid,
          'urgency', 'executed', 1,
          ${sqlLit(JSON.stringify(executedState))}::jsonb, '{}'::jsonb
        )::text;`
      )
    ) as { ok: boolean };
    expect(committed.ok).toBe(true);
    expect(
      psql(`SELECT status FROM softstop_decisions WHERE decision_id=${sqlLit(decisionId)}::uuid`)
    ).toBe("executed");
  });

  it("decision_mismatch: wrong tenant/user cannot take over decision_id", () => {
    const decisionId = randomUUID();
    const uid = "pg_owner";
    psql(
      `DELETE FROM softstop_decisions WHERE decision_id=${sqlLit(decisionId)}::uuid;
       DELETE FROM governor_events WHERE decision_id=${sqlLit(decisionId)}::uuid;
       DELETE FROM governor_user_state WHERE tenant_id=${sqlLit(tenantId)} AND user_id IN (${sqlLit(uid)}, 'pg_attacker');`
    );
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const reserved = {
      ...emptyState(),
      stateVersion: 1,
      reserves: [{ decisionId, actionType: "urgency", cost: 40, expiresAt }]
    };
    psql(
      `INSERT INTO governor_user_state (tenant_id, user_id, state, updated_at)
       VALUES (${sqlLit(tenantId)}, ${sqlLit(uid)}, ${sqlLit(JSON.stringify(reserved))}::jsonb, now());
       INSERT INTO softstop_decisions (decision_id, tenant_id, user_id, action_type, status, cost)
       VALUES (${sqlLit(decisionId)}::uuid, ${sqlLit(tenantId)}, ${sqlLit(uid)}, 'urgency', 'reserved', 40);`
    );

    const attackerState = {
      ...emptyState(),
      pressure: 40,
      stateVersion: 1,
      reserves: []
    };
    const steal = JSON.parse(
      psql(
        `SELECT softstop_record_decision(
          ${sqlLit(tenantId)}, 'pg_attacker', ${sqlLit(decisionId)}::uuid,
          'urgency', 'executed', 0,
          ${sqlLit(JSON.stringify(attackerState))}::jsonb, '{}'::jsonb
        )::text;`
      )
    ) as { ok: boolean; error?: string };
    expect(steal.ok).toBe(false);
    expect(steal.error).toBe("decision_mismatch");
    expect(
      psql(`SELECT status FROM softstop_decisions WHERE decision_id=${sqlLit(decisionId)}::uuid`)
    ).toBe("reserved");
  });

  it("first-row race: parallel reserves with no prior user row → exactly one winner", async () => {
    const uid = "pg_first_row";
    psql(
      `DELETE FROM softstop_decisions WHERE tenant_id=${sqlLit(tenantId)} AND user_id=${sqlLit(uid)};
       DELETE FROM governor_events WHERE tenant_id=${sqlLit(tenantId)} AND user_id=${sqlLit(uid)};
       DELETE FROM governor_user_state WHERE tenant_id=${sqlLit(tenantId)} AND user_id=${sqlLit(uid)};`
    );

    const n = 24;
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const sqls = Array.from({ length: n }, () => {
      const decisionId = randomUUID();
      const nextState = {
        ...emptyState(),
        reserves: [{ decisionId, actionType: "urgency", cost: 40, expiresAt }],
        stateVersion: 1
      };
      return `SELECT softstop_check_and_reserve(
        ${sqlLit(tenantId)}, ${sqlLit(uid)}, ${sqlLit(decisionId)}::uuid,
        'urgency', 0,
        ${sqlLit(JSON.stringify(nextState))}::jsonb, '{}'::jsonb,
        ${sqlLit(expiresAt)}::timestamptz, 40
      )::text;`;
    });

    const results = await Promise.all(
      sqls.map(
        (sql) =>
          new Promise<string>((resolve, reject) => {
            const child = spawn(
              "psql",
              [process.env.DATABASE_URL!, "-v", "ON_ERROR_STOP=1", "-tAc", sql],
              { stdio: ["ignore", "pipe", "pipe"] }
            );
            let out = "";
            let err = "";
            child.stdout.on("data", (d: Buffer) => {
              out += d.toString();
            });
            child.stderr.on("data", (d: Buffer) => {
              err += d.toString();
            });
            child.on("close", (code) => {
              if (code !== 0) reject(new Error(err || `psql ${code}`));
              else resolve(out.trim());
            });
          })
      )
    );
    const oks = results
      .map((r) => JSON.parse(r) as { ok: boolean })
      .filter((p) => p.ok);
    expect(oks.length).toBe(1);
    const reserved = Number(
      psql(
        `SELECT count(*) FROM softstop_decisions
         WHERE tenant_id=${sqlLit(tenantId)} AND user_id=${sqlLit(uid)} AND status='reserved'`
      )
    );
    expect(reserved).toBe(1);
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
      pressure: 60,
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

    // 60 + 40 = 100 allowed once; held reserve makes the next urgency exceed (100+40>100)
    expect(allows.length).toBe(1);
    expect(allows.length + denies.length + conflicts.length).toBe(40);
  });
});
