import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../api/src/app";
import { MemoryStorage } from "../api/src/storage/memoryStorage";
import { resolveAuthMode, resolveRequestTenant } from "../api/src/keys";
import { emptyState } from "../api/src/rules/engine";

describe("resolveAuthMode", () => {
  it("defaults to off for memory/dev", () => {
    expect(resolveAuthMode({ GOVERNOR_STORAGE: "memory" })).toBe("off");
    expect(resolveAuthMode({})).toBe("off");
  });

  it("requires auth when GOVERNOR_STORAGE=supabase", () => {
    expect(resolveAuthMode({ GOVERNOR_STORAGE: "supabase" })).toBe("required");
  });

  it("SOFTSTOP_AUTH=required forces auth", () => {
    expect(
      resolveAuthMode({ GOVERNOR_STORAGE: "memory", SOFTSTOP_AUTH: "required" })
    ).toBe("required");
  });

  it("SOFTSTOP_AUTH=off disables auth even for supabase", () => {
    expect(
      resolveAuthMode({ GOVERNOR_STORAGE: "supabase", SOFTSTOP_AUTH: "off" })
    ).toBe("off");
  });
});

describe("resolveRequestTenant", () => {
  it("never falls back to body tenantId for invalid keys", async () => {
    const storage = new MemoryStorage();
    const result = await resolveRequestTenant(
      storage,
      {
        headers: { authorization: "Bearer gov_invalid" },
        body: { tenantId: "forged-tenant" }
      },
      { authMode: "required" }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
    }
  });

  it("auth off uses fixed tenant and ignores body tenantId", async () => {
    const storage = new MemoryStorage();
    const result = await resolveRequestTenant(
      storage,
      { body: { tenantId: "forged-tenant" } },
      { authMode: "off", fixedTenantId: "acme" }
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tenantId).toBe("acme");
    }
  });

  it("auth required returns tenant only from valid key", async () => {
    const storage = new MemoryStorage();
    const { key } = await storage.createApiKey!("tenant-a");
    const result = await resolveRequestTenant(
      storage,
      {
        headers: { authorization: `Bearer ${key}` },
        body: { tenantId: "forged-tenant" }
      },
      { authMode: "required" }
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tenantId).toBe("tenant-a");
      expect(result.scopes).toContain("check");
    }
  });
});

describe("trusted tenant middleware", () => {
  it("returns 401 when auth required and key missing", async () => {
    const app = createApp(new MemoryStorage(), { authMode: "required" });
    const response = await request(app).post("/v1/check").send({
      userId: "u1",
      actionType: "urgency",
      tenantId: "should-not-matter"
    });
    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/unauthorized|api key/i);
  });

  it("ignores forged body tenantId when authenticated", async () => {
    const storage = new MemoryStorage();
    const { key } = await storage.createApiKey!("real-tenant");
    await storage.upsertUserState(
      "u1",
      { ...emptyState(), pressure: 0 },
      "real-tenant"
    );
    const app = createApp(storage, { authMode: "required" });

    const check = await request(app)
      .post("/v1/check")
      .set("Authorization", `Bearer ${key}`)
      .send({
        userId: "u1",
        actionType: "urgency",
        tenantId: "forged-other-tenant"
      });

    expect(check.status).toBe(200);
    expect(check.body.allowed).toBe(true);

    const forgedState = await storage.getUserState("u1", "forged-other-tenant");
    expect(forgedState).toBeNull();

    // With reserve off (defaultRulesConfig), check does not write; record must land on real tenant.
    const record = await request(app)
      .post("/v1/record")
      .set("Authorization", `Bearer ${key}`)
      .send({
        userId: "u1",
        actionType: "urgency",
        outcome: "executed",
        decisionId: check.body.decisionId,
        tenantId: "forged-other-tenant"
      });
    expect(record.status).toBe(200);

    const realState = await storage.getUserState("u1", "real-tenant");
    expect(realState?.pressure).toBe(40);
    const forgedAfter = await storage.getUserState("u1", "forged-other-tenant");
    expect(forgedAfter).toBeNull();
  });

  it("private auth-off mode ignores client-chosen tenant namespace", async () => {
    const storage = new MemoryStorage();
    const app = createApp(storage, {
      authMode: "off",
      fixedTenantId: "default"
    });

    const check = await request(app).post("/v1/check").send({
      userId: "private_user",
      actionType: "reminder",
      tenantId: "attacker-ns"
    });
    expect(check.status).toBe(200);

    await request(app).post("/v1/record").send({
      userId: "private_user",
      actionType: "reminder",
      outcome: "executed",
      decisionId: check.body.decisionId,
      tenantId: "attacker-ns"
    });

    expect(await storage.getUserState("private_user", "attacker-ns")).toBeNull();
    expect(await storage.getUserState("private_user", "default")).toBeTruthy();
  });
});
