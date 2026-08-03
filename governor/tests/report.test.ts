import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../api/src/app";
import { MemoryStorage } from "../api/src/storage/memoryStorage";

describe("Governor Report API", () => {
  it("returns report with MemoryStorage", async () => {
    const storage = new MemoryStorage();
    const app = createApp(storage);

    const response = await request(app)
      .get("/v1/report")
      .query({ from: "2020-01-01T00:00:00Z", to: "2030-12-31T23:59:59Z" });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.report).toBeDefined();
    expect(response.body.report.period).toEqual({
      from: "2020-01-01T00:00:00Z",
      to: "2030-12-31T23:59:59Z"
    });
    expect(typeof response.body.report.totalChecks).toBe("number");
    expect(typeof response.body.report.totalOutcomes).toBe("number");
    expect(typeof response.body.report.orphanCount).toBe("number");
    expect(typeof response.body.report.orphanRate).toBe("number");
    expect(response.body.report.blocksByReason).toBeInstanceOf(Object);
    expect(response.body.report.outcomesByType).toEqual({
      executed: expect.any(Number),
      blocked: expect.any(Number),
      downgraded: expect.any(Number)
    });
    expect(response.body.report.actionTypeDistribution).toBeInstanceOf(Object);
  });

  it("includes blocksByReason when blocked outcomes have blockReason", async () => {
    const storage = new MemoryStorage();
    const app = createApp(storage);

    const checkRes = await request(app)
      .post("/v1/check")
      .send({ userId: "user_1", actionType: "urgency" });

    await request(app)
      .post("/v1/record")
      .send({
        userId: "user_1",
        actionType: "urgency",
        outcome: "executed",
        decisionId: checkRes.body.decisionId
      });

    const check2 = await request(app)
      .post("/v1/check")
      .send({ userId: "user_1", actionType: "urgency" });
    expect(check2.body.allowed).toBe(false);

    await request(app)
      .post("/v1/record")
      .send({
        userId: "user_1",
        actionType: "urgency",
        outcome: "blocked",
        blockReason: check2.body.reason
      });

    const reportRes = await request(app).get("/v1/report");
    expect(reportRes.body.report.outcomesByType.blocked).toBe(1);
    expect(reportRes.body.report.blocksByReason[check2.body.reason]).toBe(1);
  });

  it("audit report returns JSON by default", async () => {
    const app = createApp(new MemoryStorage());
    const response = await request(app).get("/v1/report/audit");

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.audit).toBeDefined();
    expect(response.body.audit.generatedAt).toBeTruthy();
    expect(response.body.audit.summary).toBeDefined();
  });

  it("audit report with format=csv returns CSV", async () => {
    const app = createApp(new MemoryStorage());
    const response = await request(app)
      .get("/v1/report/audit")
      .query({ format: "csv" });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.text).toContain("metric,value");
    expect(response.text).toContain("totalChecks");
  });
});
