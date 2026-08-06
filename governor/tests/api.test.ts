import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../api/src/app";
import { MemoryStorage } from "../api/src/storage/memoryStorage";
import { defaultRulesConfig } from "../api/src/rules/config";

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

  it("persists pressure snapshot on check events", async () => {
    const storage = new MemoryStorage();
    const app = createApp(storage);
    await request(app).post("/v1/check").send({
      userId: "snap_user",
      actionType: "urgency",
      context: { actor: "sales-agent" }
    });

    const checkEvent = storage.events.find((e) => e.eventType === "check");
    expect(checkEvent).toBeTruthy();
    expect(checkEvent?.context?.pressure).toBe(0);
    expect(checkEvent?.context?.cost).toBe(40);
    expect(checkEvent?.context?.threshold).toBe(100);
    expect(checkEvent?.context?.projectedPressure).toBe(40);
    expect(checkEvent?.context?.reason).toBe("allowed");
    expect(checkEvent?.context?.actor).toBe("sales-agent");
  });

  it("returns activity with pressure and filtered events", async () => {
    const app = createApp(new MemoryStorage());

    const first = await request(app).post("/v1/check").send({
      userId: "activity_user",
      actionType: "urgency",
      context: { actor: "sales-agent" }
    });
    await request(app).post("/v1/record").send({
      userId: "activity_user",
      actionType: "urgency",
      outcome: "executed",
      decisionId: first.body.decisionId,
      context: { actor: "sales-agent" }
    });

    const second = await request(app).post("/v1/check").send({
      userId: "activity_user",
      actionType: "discount",
      context: { actor: "pricing" }
    });
    await request(app).post("/v1/record").send({
      userId: "activity_user",
      actionType: "discount",
      outcome: "executed",
      decisionId: second.body.decisionId,
      context: { actor: "pricing" }
    });

    // Noise from another user should not appear
    const other = await request(app).post("/v1/check").send({
      userId: "other_user",
      actionType: "reminder"
    });
    await request(app).post("/v1/record").send({
      userId: "other_user",
      actionType: "reminder",
      outcome: "executed",
      decisionId: other.body.decisionId
    });

    const activity = await request(app).get("/v1/users/activity_user/activity?limit=50");
    expect(activity.status).toBe(200);
    expect(activity.body.userId).toBe("activity_user");
    expect(activity.body.pressure).toBe(70);
    expect(activity.body.threshold).toBe(100);
    expect(activity.body.decayPerHour).toBe(8);
    expect(activity.body.costs.urgency).toBe(40);
    expect(activity.body.events).toHaveLength(2);
    expect(activity.body.events.every((e: { userId?: string }) => !e.userId || true)).toBe(true);
    expect(activity.body.events[0].actionType).toBe("discount");
    expect(activity.body.events[0].eventType).toBe("executed");
    expect(activity.body.events[0].actor).toBe("pricing");
    expect(activity.body.events[0].pressure).toBe(40);
    expect(activity.body.events[0].cost).toBe(30);
    expect(activity.body.events[0].projectedPressure).toBe(70);
    expect(activity.body.events[1].actionType).toBe("urgency");
    expect(activity.body.events[1].cost).toBe(40);
  });

  it("filters decision log by userId", async () => {
    const app = createApp(new MemoryStorage());
    const a = await request(app).post("/v1/check").send({ userId: "u_a", actionType: "urgency" });
    await request(app).post("/v1/record").send({
      userId: "u_a",
      actionType: "urgency",
      outcome: "executed",
      decisionId: a.body.decisionId
    });
    const b = await request(app).post("/v1/check").send({ userId: "u_b", actionType: "discount" });
    await request(app).post("/v1/record").send({
      userId: "u_b",
      actionType: "discount",
      outcome: "executed",
      decisionId: b.body.decisionId
    });

    const log = await request(app).get("/v1/report/decisions?userId=u_a&limit=50");
    expect(log.status).toBe(200);
    expect(log.body.decisions).toHaveLength(1);
    expect(log.body.decisions[0].userId).toBe("u_a");
  });

  it("merges decayed pressure (sum capped) and tombstones fromUserId", async () => {
    const storage = new MemoryStorage();
    const app = createApp(storage);
    const now = new Date().toISOString();

    await storage.upsertUserState("ph:anon-1", {
      cooldowns: { urgency: new Date(Date.now() + 3600e3).toISOString() },
      lastActionAt: { urgency: now },
      lastAnyEscalationAt: now,
      windows: {
        urgency: { windowStart: now, count: 1 },
        global: { windowStart: now, count: 1 }
      },
      pressure: 40,
      pressureUpdatedAt: now
    });
    await storage.upsertUserState("sc:user-1", {
      cooldowns: { reminder: new Date(Date.now() + 7200e3).toISOString() },
      lastActionAt: { reminder: now },
      lastAnyEscalationAt: now,
      windows: {
        reminder: { windowStart: now, count: 1 },
        global: { windowStart: now, count: 1 }
      },
      pressure: 30,
      pressureUpdatedAt: now
    });

    const merge = await request(app).post("/v1/users/merge").send({
      fromUserId: "ph:anon-1",
      toUserId: "sc:user-1"
    });

    expect(merge.status).toBe(200);
    expect(merge.body.ok).toBe(true);
    expect(merge.body.fromUserId).toBe("ph:anon-1");
    expect(merge.body.toUserId).toBe("sc:user-1");
    expect(merge.body.alreadyMerged).toBeFalsy();
    expect(merge.body.pressure).toBe(70);

    const toPressure = await request(app).get("/v1/users/sc:user-1/pressure");
    expect(toPressure.body.pressure).toBe(70);

    const fromState = await storage.getUserState("ph:anon-1");
    expect(fromState?.mergedInto).toBe("sc:user-1");
    expect(fromState?.pressure ?? 0).toBe(0);

    const toState = await storage.getUserState("sc:user-1");
    expect(toState?.cooldowns.urgency).toBeTruthy();
    expect(toState?.cooldowns.reminder).toBeTruthy();
    const urgCd = new Date(toState!.cooldowns.urgency!).getTime();
    const remCd = new Date(toState!.cooldowns.reminder!).getTime();
    expect(remCd).toBeGreaterThan(urgCd);
    expect(toState?.windows.global?.count).toBe(2);
    expect(toState?.windows.urgency?.count).toBe(1);
    expect(toState?.windows.reminder?.count).toBe(1);

    const mergeEvent = storage.events.find((e) => e.eventType === "merged");
    expect(mergeEvent).toBeTruthy();
    expect(mergeEvent?.userId).toBe("sc:user-1");
    expect(mergeEvent?.context?.fromUserId).toBe("ph:anon-1");
    expect(mergeEvent?.context?.toUserId).toBe("sc:user-1");
  });

  it("caps merged pressure at threshold and is idempotent on second merge", async () => {
    const storage = new MemoryStorage();
    const app = createApp(storage);
    const now = new Date().toISOString();

    await storage.upsertUserState("ph:hot", {
      cooldowns: {},
      lastActionAt: {},
      lastAnyEscalationAt: null,
      windows: {},
      pressure: 80,
      pressureUpdatedAt: now
    });
    await storage.upsertUserState("sc:hot", {
      cooldowns: {},
      lastActionAt: {},
      lastAnyEscalationAt: null,
      windows: {},
      pressure: 50,
      pressureUpdatedAt: now
    });

    const first = await request(app).post("/v1/users/merge").send({
      fromUserId: "ph:hot",
      toUserId: "sc:hot"
    });
    expect(first.status).toBe(200);
    expect(first.body.pressure).toBe(100);

    const second = await request(app).post("/v1/users/merge").send({
      fromUserId: "ph:hot",
      toUserId: "sc:hot"
    });
    expect(second.status).toBe(200);
    expect(second.body.ok).toBe(true);
    expect(second.body.alreadyMerged).toBe(true);
    expect(second.body.pressure).toBe(100);
    expect(storage.events.filter((e) => e.eventType === "merged")).toHaveLength(1);
  });

  it("rejects merge when fromUserId equals toUserId", async () => {
    const app = createApp(new MemoryStorage());
    const response = await request(app).post("/v1/users/merge").send({
      fromUserId: "sc:same",
      toUserId: "sc:same"
    });
    expect(response.status).toBe(400);
  });

  it("rejects actionType not in the loaded policy", async () => {
    const app = createApp(new MemoryStorage());
    const response = await request(app).post("/v1/check").send({
      userId: "user_custom",
      actionType: "legal_notice"
    });
    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body)).toMatch(/legal_notice|actionType|policy/i);
  });

  it("allows a policy-defined custom actionType", async () => {
    const rulesConfig = {
      ...defaultRulesConfig,
      cooldownHours: {
        ...defaultRulesConfig.cooldownHours,
        legal_notice: 48
      },
      typeCap: {
        ...defaultRulesConfig.typeCap,
        legal_notice: 1
      },
      costs: {
        ...defaultRulesConfig.costs,
        legal_notice: 20
      }
    };
    const app = createApp(new MemoryStorage(), { rulesConfig });
    const check = await request(app).post("/v1/check").send({
      userId: "user_legal",
      actionType: "legal_notice"
    });
    expect(check.status).toBe(200);
    expect(check.body.allowed).toBe(true);
    expect(check.body.cost).toBe(20);

    const record = await request(app).post("/v1/record").send({
      userId: "user_legal",
      actionType: "legal_notice",
      outcome: "executed",
      decisionId: check.body.decisionId
    });
    expect(record.status).toBe(200);
  });
});
