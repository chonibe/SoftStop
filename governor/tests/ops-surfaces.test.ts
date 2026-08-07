import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../api/src/app";
import { MemoryStorage } from "../api/src/storage/memoryStorage";
import { defaultRulesConfig } from "../api/src/rules/config";

describe("production ops surfaces", () => {
  it("/v1/policy requires read:audit when auth is required", async () => {
    const storage = new MemoryStorage();
    const { key: pressureOnly } = await storage.createApiKey!(
      "tenant-a",
      "pressure",
      ["read:pressure"]
    );
    const { key: auditKey } = await storage.createApiKey!("tenant-a", "audit", [
      "read:audit"
    ]);
    const app = createApp(storage, { authMode: "required" });

    const denied = await request(app)
      .get("/v1/policy")
      .set("Authorization", `Bearer ${pressureOnly}`);
    expect(denied.status).toBe(403);

    const ok = await request(app)
      .get("/v1/policy")
      .set("Authorization", `Bearer ${auditKey}`);
    expect(ok.status).toBe(200);
    expect(ok.body.ok).toBe(true);
    expect(ok.body.policy).toBeTruthy();
    expect(ok.body.source).toBeTruthy();
  });

  it("/v1/policy is available under auth=off (fixed tenant)", async () => {
    const storage = new MemoryStorage();
    const app = createApp(storage, {
      authMode: "off",
      rulesConfig: defaultRulesConfig
    });
    const res = await request(app).get("/v1/policy");
    expect(res.status).toBe(200);
    expect(res.body.policy.threshold).toBe(defaultRulesConfig.threshold);
  });

  it("/readyz uses storage.ping", async () => {
    const storage = new MemoryStorage();
    let pinged = false;
    storage.ping = async () => {
      pinged = true;
    };
    const app = createApp(storage);
    const res = await request(app).get("/readyz");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ready");
    expect(pinged).toBe(true);
  });

  it("/readyz returns 503 when ping fails", async () => {
    const storage = new MemoryStorage();
    storage.ping = async () => {
      throw new Error("db down");
    };
    const app = createApp(storage);
    const res = await request(app).get("/readyz");
    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
  });

  it("CORS is off by default and honor SOFTSTOP_CORS_ORIGINS override via options", async () => {
    const storage = new MemoryStorage();
    const locked = createApp(storage, { corsOrigins: null });
    const open = createApp(storage, {
      corsOrigins: ["https://demo.example"]
    });

    const lockedRes = await request(locked)
      .options("/v1/health")
      .set("Origin", "https://evil.example")
      .set("Access-Control-Request-Method", "GET");
    // Without cors middleware, Express typically 404s OPTIONS or lacks ACAO.
    expect(lockedRes.headers["access-control-allow-origin"]).toBeUndefined();

    const openRes = await request(open)
      .get("/livez")
      .set("Origin", "https://demo.example");
    expect(openRes.headers["access-control-allow-origin"]).toBe(
      "https://demo.example"
    );
  });
});
