import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../api/src/app";
import { MemoryStorage } from "../api/src/storage/memoryStorage";

describe("Governor Verify API", () => {
  it("returns success when integration is valid", async () => {
    const app = createApp(new MemoryStorage());
    const response = await request(app).post("/v1/verify");

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.decisionId).toBeTruthy();
    expect(response.body.message).toBe("Integration verification passed");
  });

  it("creates test events that are linked", async () => {
    const storage = new MemoryStorage();
    const app = createApp(storage);

    const verifyRes = await request(app).post("/v1/verify");
    expect(verifyRes.status).toBe(200);

    const orphanIds = await storage.getOrphanedDecisionIds!(1, 100);
    expect(orphanIds).not.toContain(verifyRes.body.decisionId);
  });

  it("accepts POST only", async () => {
    const app = createApp(new MemoryStorage());

    const getRes = await request(app).get("/v1/verify");
    expect(getRes.status).toBe(404);

    const postRes = await request(app).post("/v1/verify");
    expect(postRes.status).toBe(200);
  });
});
