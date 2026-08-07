import { describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import request from "supertest";
import { createApp } from "../api/src/app";
import { handleRecord, handleRelease } from "../api/src/handlers";
import { MemoryStorage } from "../api/src/storage/memoryStorage";
import { defaultRulesConfig, GovernorRulesConfig } from "../api/src/rules/config";
import { emptyState } from "../api/src/rules/engine";

const withReserve = (ttlMs = 20_000): GovernorRulesConfig => ({
  ...defaultRulesConfig,
  reserveTtlMs: ttlMs
});

describe("decision lifecycle (Wave 2)", () => {
  it("rejects record without a prior check/decision (unknown_decision)", async () => {
    const storage = new MemoryStorage();
    const decisionId = randomUUID();
    const result = await handleRecord(
      storage,
      {
        userId: "no_prior_check",
        actionType: "urgency",
        outcome: "executed",
        decisionId
      },
      withReserve()
    );
    expect(result.status).toBe(404);
    expect((result.body as { error?: string }).error).toBe("unknown_decision");
    expect(storage.decisions.has(decisionId)).toBe(false);
  });

  it("allows unknown-decision record only when SoftStop unsafe legacy escape hatch is set", async () => {
    const storage = new MemoryStorage({ allowUnknownDecision: true });
    const decisionId = randomUUID();
    const result = await handleRecord(
      storage,
      {
        userId: "legacy_user",
        actionType: "urgency",
        outcome: "executed",
        decisionId
      },
      withReserve()
    );
    expect(result.status).toBe(200);
    expect(storage.decisions.get(decisionId)?.status).toBe("executed");
  });

  it("release is idempotent after reserve is cleared (no decision_mismatch)", async () => {
    const storage = new MemoryStorage();
    const config = withReserve();
    const app = createApp(storage, { rulesConfig: config });

    const check = await request(app).post("/v1/check").send({
      userId: "release_idem",
      actionType: "urgency"
    });
    expect(check.status).toBe(200);
    expect(check.body.allowed).toBe(true);
    const decisionId = check.body.decisionId as string;

    const first = await handleRelease(
      storage,
      { decisionId, userId: "release_idem" },
      config
    );
    expect(first.status).toBe(200);
    expect(storage.decisions.get(decisionId)?.status).toBe("released");
    expect((await storage.getUserState("release_idem"))?.reserves ?? []).toEqual([]);

    const second = await handleRelease(
      storage,
      { decisionId, userId: "release_idem" },
      config
    );
    expect(second.status).toBe(200);
    expect((second.body as { idempotent?: boolean }).idempotent).toBe(true);
    expect(storage.decisions.get(decisionId)?.status).toBe("released");
    expect(
      storage.events.filter(
        (e) => e.decisionId === decisionId && e.eventType === "released"
      ).length
    ).toBe(1);
  });

  it("records reserved → executed and is idempotent on duplicate terminal", async () => {
    const storage = new MemoryStorage();
    const app = createApp(storage, { rulesConfig: withReserve() });

    const check = await request(app).post("/v1/check").send({
      userId: "life_user",
      actionType: "urgency"
    });
    expect(check.status).toBe(200);
    expect(check.body.allowed).toBe(true);
    expect(storage.decisions.get(check.body.decisionId)?.status).toBe("reserved");

    const record1 = await request(app).post("/v1/record").send({
      userId: "life_user",
      actionType: "urgency",
      outcome: "executed",
      decisionId: check.body.decisionId
    });
    expect(record1.status).toBe(200);
    expect(storage.decisions.get(check.body.decisionId)?.status).toBe("executed");

    const record2 = await handleRecord(
      storage,
      {
        userId: "life_user",
        actionType: "urgency",
        outcome: "executed",
        decisionId: check.body.decisionId
      },
      withReserve()
    );
    expect(record2.status).toBe(200);
    expect((record2.body as { idempotent?: boolean }).idempotent).toBe(true);

    const executedEvents = storage.events.filter(
      (e) =>
        e.decisionId === check.body.decisionId && e.eventType === "executed"
    );
    expect(executedEvents.length).toBe(1);
  });

  it("rejects conflicting terminal outcome", async () => {
    const storage = new MemoryStorage();
    const decisionId = "33333333-3333-4333-8333-333333333333";
    storage.decisions.set(decisionId, {
      tenantId: "default",
      userId: "u",
      actionType: "urgency",
      status: "executed"
    });
    await storage.upsertUserState("u", { ...emptyState(), stateVersion: 1 });

    const result = await handleRecord(
      storage,
      {
        userId: "u",
        actionType: "urgency",
        outcome: "blocked",
        decisionId,
        blockReason: "pressure_exceeded"
      },
      withReserve()
    );
    expect(result.status).toBe(409);
    expect((result.body as { error?: string }).error).toBe("already_terminal");
  });

  it("reserved → released is terminal; later record(executed) fails", async () => {
    const storage = new MemoryStorage();
    const app = createApp(storage, { rulesConfig: withReserve() });

    const check = await request(app).post("/v1/check").send({
      userId: "release_life_user",
      actionType: "urgency"
    });
    expect(check.status).toBe(200);
    expect(check.body.allowed).toBe(true);
    const decisionId = check.body.decisionId as string;
    expect(storage.decisions.get(decisionId)?.status).toBe("reserved");

    const release = await request(app).post("/v1/release").send({
      userId: "release_life_user",
      decisionId
    });
    expect(release.status).toBe(200);
    expect(storage.decisions.get(decisionId)?.status).toBe("released");

    const late = await request(app).post("/v1/record").send({
      userId: "release_life_user",
      actionType: "urgency",
      outcome: "executed",
      decisionId
    });
    expect(late.status).toBe(409);
    expect(late.body.error).toBe("already_terminal");
    expect(storage.decisions.get(decisionId)?.status).toBe("released");

    const terminals = storage.events.filter(
      (e) =>
        e.decisionId === decisionId &&
        ["executed", "blocked", "released", "downgraded"].includes(e.eventType)
    );
    expect(terminals.map((e) => e.eventType).sort()).toEqual(["released"]);
  });
});

describe("API key scopes (Wave 2)", () => {
  it("returns 403 when key lacks required scope", async () => {
    const storage = new MemoryStorage();
    const { key } = await storage.createApiKey!("tenant-a", "read-only", [
      "read:pressure"
    ]);
    const app = createApp(storage, { authMode: "required" });

    const response = await request(app)
      .post("/v1/check")
      .set("Authorization", `Bearer ${key}`)
      .send({ userId: "u1", actionType: "urgency" });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/scope/i);
  });

  it("allows check when key has check scope", async () => {
    const storage = new MemoryStorage();
    const { key } = await storage.createApiKey!("tenant-a", "checker", ["check"]);
    const app = createApp(storage, { authMode: "required" });

    const response = await request(app)
      .post("/v1/check")
      .set("Authorization", `Bearer ${key}`)
      .send({ userId: "u1", actionType: "urgency" });

    expect(response.status).toBe(200);
    expect(response.body.allowed).toBe(true);
  });
});
