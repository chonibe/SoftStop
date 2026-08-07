import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../api/src/app";
import { MemoryStorage } from "../api/src/storage/memoryStorage";

describe("Governor Health API", () => {
  it("returns health metrics with MemoryStorage", async () => {
    const storage = new MemoryStorage();
    const app = createApp(storage);

    const response = await request(app)
      .get("/v1/health")
      .query({ periodHours: 24 });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.metrics).toBeDefined();
    expect(response.body.metrics.periodHours).toBe(24);
    expect(typeof response.body.metrics.totalChecks).toBe("number");
    expect(typeof response.body.metrics.totalOutcomes).toBe("number");
    expect(typeof response.body.metrics.orphanCount).toBe("number");
    expect(typeof response.body.metrics.orphanRate).toBe("number");
    expect(typeof response.body.metrics.expiredReserveCount).toBe("number");
    expect(typeof response.body.metrics.expiredReserveRate).toBe("number");
    expect(response.body.metrics.expiredReserveCount).toBe(0);
    expect(response.body.metrics.expiredReserveRate).toBe(0);
    expect(typeof response.body.metrics.blockRate).toBe("number");
    expect(typeof response.body.metrics.healthScore).toBe("number");
    expect(response.body.metrics.actionTypeDistribution).toBeInstanceOf(Object);
  });

  it("computes orphan rate when checks lack records", async () => {
    const storage = new MemoryStorage();
    const app = createApp(storage);

    await request(app)
      .post("/v1/check")
      .send({ userId: "user_1", actionType: "reminder" });
    await request(app)
      .post("/v1/check")
      .send({ userId: "user_2", actionType: "reminder" });

    const checkRes = await request(app).post("/v1/check").send({
      userId: "user_3",
      actionType: "reminder"
    });

    await request(app).post("/v1/record").send({
      userId: "user_3",
      actionType: "reminder",
      outcome: "executed",
      decisionId: checkRes.body.decisionId
    });

    const healthRes = await request(app).get("/v1/health").query({ periodHours: 24 });

    expect(healthRes.status).toBe(200);
    expect(healthRes.body.metrics.totalChecks).toBe(3);
    expect(healthRes.body.metrics.totalOutcomes).toBe(1);
    expect(healthRes.body.metrics.orphanCount).toBe(2);
    expect(healthRes.body.metrics.orphanRate).toBeCloseTo(2 / 3);
  });

  it("defaults periodHours to 24 when omitted", async () => {
    const app = createApp(new MemoryStorage());
    const response = await request(app).get("/v1/health");

    expect(response.status).toBe(200);
    expect(response.body.metrics.periodHours).toBe(24);
  });
});
