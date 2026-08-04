import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../api/src/app";
import { MemoryStorage } from "../api/src/storage/memoryStorage";

describe("Governor API", () => {
  it("returns allow/deny decision with pressure fields", async () => {
    const app = createApp(new MemoryStorage());
    const response = await request(app).post("/v1/check").send({
      userId: "user_1",
      actionType: "urgency"
    });

    expect(response.status).toBe(200);
    expect(response.body.allowed).toBe(true);
    expect(response.body.decisionId).toBeTruthy();
    expect(response.body.pressure).toBe(0);
    expect(response.body.cost).toBe(40);
    expect(response.body.threshold).toBe(100);
    expect(response.body.projectedPressure).toBe(40);
  });

  it("records an outcome", async () => {
    const app = createApp(new MemoryStorage());
    const decision = await request(app).post("/v1/check").send({
      userId: "user_2",
      actionType: "discount"
    });

    const record = await request(app).post("/v1/record").send({
      userId: "user_2",
      actionType: "discount",
      outcome: "executed",
      decisionId: decision.body.decisionId
    });

    expect(record.status).toBe(200);
    expect(record.body.ok).toBe(true);
  });

  it("returns user pressure after executed contacts", async () => {
    const app = createApp(new MemoryStorage());
    const check = await request(app).post("/v1/check").send({
      userId: "user_pressure",
      actionType: "urgency"
    });
    await request(app).post("/v1/record").send({
      userId: "user_pressure",
      actionType: "urgency",
      outcome: "executed",
      decisionId: check.body.decisionId
    });

    const pressure = await request(app).get("/v1/users/user_pressure/pressure");
    expect(pressure.status).toBe(200);
    expect(pressure.body.userId).toBe("user_pressure");
    expect(pressure.body.pressure).toBe(40);
    expect(pressure.body.threshold).toBe(100);
    expect(pressure.body.decayPerHour).toBe(8);
  });

  it("blocks with pressure_exceeded when score would overflow", async () => {
    const storage = new MemoryStorage();
    const app = createApp(storage);
    await storage.upsertUserState("hot_user", {
      cooldowns: {},
      lastActionAt: {},
      lastAnyEscalationAt: null,
      windows: {},
      pressure: 80,
      pressureUpdatedAt: new Date().toISOString()
    });

    const response = await request(app).post("/v1/check").send({
      userId: "hot_user",
      actionType: "urgency"
    });

    expect(response.status).toBe(200);
    expect(response.body.allowed).toBe(false);
    expect(response.body.reason).toBe("pressure_exceeded");
    expect(response.body.projectedPressure).toBe(120);
  });
});
