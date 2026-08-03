import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../api/src/app";
import { MemoryStorage } from "../api/src/storage/memoryStorage";

describe("Governor API", () => {
  it("returns allow/deny decision", async () => {
    const app = createApp(new MemoryStorage());
    const response = await request(app).post("/v1/check").send({
      userId: "user_1",
      actionType: "urgency"
    });

    expect(response.status).toBe(200);
    expect(response.body.allowed).toBe(true);
    expect(response.body.decisionId).toBeTruthy();
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
});
