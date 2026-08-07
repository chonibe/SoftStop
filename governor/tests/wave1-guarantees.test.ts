import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../api/src/app";
import { handleRecord } from "../api/src/handlers";
import { MemoryStorage } from "../api/src/storage/memoryStorage";
import { defaultRulesConfig } from "../api/src/rules/config";
import { emptyState } from "../api/src/rules/engine";

describe("mandatory decisionId", () => {
  it("rejects /record without decisionId", async () => {
    const app = createApp(new MemoryStorage());
    const response = await request(app).post("/v1/record").send({
      userId: "u1",
      actionType: "urgency",
      outcome: "executed"
    });
    expect(response.status).toBe(400);
  });

  it("rejects /record with non-UUID decisionId", async () => {
    const app = createApp(new MemoryStorage());
    const response = await request(app).post("/v1/record").send({
      userId: "u1",
      actionType: "urgency",
      outcome: "executed",
      decisionId: "not-a-uuid"
    });
    expect(response.status).toBe(400);
  });
});

describe("CAS no unconditional upsert", () => {
  it("returns 409 when record CAS retries are exhausted", async () => {
    const storage = new MemoryStorage();
    await storage.upsertUserState("cas_user", {
      ...emptyState(),
      stateVersion: 1
    });
    const decisionId = "22222222-2222-4222-8222-222222222222";
    await storage.openDecision!({
      tenantId: "default",
      userId: "cas_user",
      decisionId,
      actionType: "urgency",
      cost: 40
    });

    // Force perpetual conflict by advancing version on every tryUpsert peek.
    const originalTry = storage.tryUpsertUserState!.bind(storage);
    let attempts = 0;
    storage.tryUpsertUserState = async (userId, state, expectedVersion, tenantId) => {
      attempts += 1;
      // Bump stored version so CAS never matches
      const current = (await storage.getUserState(userId, tenantId)) ?? emptyState();
      await storage.upsertUserState(
        userId,
        { ...current, stateVersion: (current.stateVersion ?? 0) + 10 },
        tenantId
      );
      return originalTry(userId, state, expectedVersion, tenantId);
    };

    const result = await handleRecord(
      storage,
      {
        userId: "cas_user",
        actionType: "urgency",
        outcome: "executed",
        decisionId
      },
      defaultRulesConfig
    );

    expect(result.status).toBe(409);
    expect(attempts).toBeGreaterThanOrEqual(3);
    // Must not have fallen back to unconditional upsert with our nextState
    const final = await storage.getUserState("cas_user");
    expect(final?.pressure ?? 0).toBe(0);
  });
});

describe("health fail-loud", () => {
  it("returns ok:false when getHealthMetrics throws", async () => {
    const storage = new MemoryStorage();
    storage.getHealthMetrics = vi.fn(async () => {
      throw new Error("Health metrics query failed: boom");
    });
    const app = createApp(storage);
    const response = await request(app).get("/v1/health");
    expect(response.status).toBe(503);
    expect(response.body.ok).toBe(false);
    expect(response.body.error).toBe("health_storage_error");
  });
});
