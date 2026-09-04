import { describe, expect, it } from "vitest";
import {
  applyOutcome,
  decayedPressure,
  emptyState,
  evaluateCheck
} from "../api/src/rules/engine";
import { defaultRulesConfig } from "../api/src/rules/config";

describe("rules engine", () => {
  it("blocks during cooldown after hesitation", () => {
    const now = new Date();
    const state = applyOutcome(
      emptyState(),
      "urgency",
      "executed",
      { dismissed: true },
      now
    );
    const decision = evaluateCheck(
      state,
      "urgency",
      new Date(now.getTime() + 1 * 60 * 1000),
      defaultRulesConfig
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("cooldown_active");
  });

  it("enforces per-type cap within window", () => {
    const now = new Date();
    let state = emptyState();
    state = applyOutcome(state, "reminder", "executed", {}, now);
    state = applyOutcome(state, "reminder", "executed", {}, now);

    const decision = evaluateCheck(
      state,
      "reminder",
      new Date(now.getTime() + 5 * 60 * 1000),
      defaultRulesConfig
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("type_cap_reached");
  });

  it("adds server-owned cost on executed outcome", () => {
    const now = new Date();
    const state = applyOutcome(emptyState(), "urgency", "executed", {}, now);
    expect(state.pressure).toBe(40);
    expect(state.pressureUpdatedAt).toBe(now.toISOString());
  });

  it("decays pressure over time", () => {
    const now = new Date();
    const state = {
      ...emptyState(),
      pressure: 40,
      pressureUpdatedAt: now.toISOString()
    };
    const later = new Date(now.getTime() + 5 * 36e5);
    expect(decayedPressure(state, later, 8)).toBe(0);
    expect(decayedPressure(state, new Date(now.getTime() + 2 * 36e5), 8)).toBe(24);
  });

  it("allows under threshold and attaches pressure fields", () => {
    const now = new Date();
    const decision = evaluateCheck(emptyState(), "urgency", now, defaultRulesConfig);
    expect(decision.allowed).toBe(true);
    expect(decision.pressure).toBe(0);
    expect(decision.cost).toBe(40);
    expect(decision.threshold).toBe(100);
    expect(decision.projectedPressure).toBe(40);
    expect(decision.sendAfter).toBeUndefined();
    expect(decision.retryAfterMs).toBeUndefined();
    expect(decision.suggestedFallback).toBeUndefined();
  });

  it("blocks when pressure plus cost exceeds threshold", () => {
    const now = new Date();
    const state = {
      ...emptyState(),
      pressure: 80,
      pressureUpdatedAt: now.toISOString()
    };
    const decision = evaluateCheck(state, "urgency", now, defaultRulesConfig);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("pressure_exceeded");
    expect(decision.pressure).toBe(80);
    expect(decision.cost).toBe(40);
    expect(decision.projectedPressure).toBe(120);
  });

  it("allows after decay brings projected pressure under threshold", () => {
    const now = new Date();
    const state = {
      ...emptyState(),
      pressure: 80,
      pressureUpdatedAt: now.toISOString()
    };
    // 5h * 8 = 40 decay → pressure 40; + urgency 40 = 80 <= 100
    const later = new Date(now.getTime() + 5 * 36e5);
    const decision = evaluateCheck(state, "urgency", later, defaultRulesConfig);
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("allowed");
    expect(decision.pressure).toBe(40);
    expect(decision.projectedPressure).toBe(80);
  });

  it("allows when pressure + cost equals threshold (strict > only)", () => {
    const now = new Date();
    const state = {
      ...emptyState(),
      pressure: 60,
      pressureUpdatedAt: now.toISOString()
    };
    // cost urgency=40 → 60+40=100 == threshold → allow
    const atThreshold = evaluateCheck(state, "urgency", now, defaultRulesConfig);
    expect(atThreshold.allowed).toBe(true);
    expect(atThreshold.projectedPressure).toBe(100);

    const over = {
      ...emptyState(),
      pressure: 61,
      pressureUpdatedAt: now.toISOString()
    };
    const overDecision = evaluateCheck(over, "urgency", now, defaultRulesConfig);
    expect(overDecision.allowed).toBe(false);
    expect(overDecision.reason).toBe("pressure_exceeded");
  });

  it("attaches suggestedFallback + keeps suggestedActionType on urgency deny", () => {
    const now = new Date();
    const state = {
      ...emptyState(),
      pressure: 80,
      pressureUpdatedAt: now.toISOString()
    };
    const decision = evaluateCheck(state, "urgency", now, defaultRulesConfig);
    expect(decision.suggestedActionType).toBe("reminder");
    expect(decision.suggestedFallback?.strategy).toBe("downgrade");
    expect(decision.suggestedFallback?.actionType).toBe("reminder");
    // 80 + 40 - 100 = 20 pressure to decay; 20/8h = 2.5h
    expect(decision.retryAfterMs).toBe(Math.ceil(2.5 * 36e5));
    expect(decision.sendAfter).toBe(
      new Date(now.getTime() + Math.ceil(2.5 * 36e5)).toISOString()
    );
  });

  it("pressure deny without a cheaper type that fits now defers with sendAfter", () => {
    const now = new Date("2026-09-04T12:00:00.000Z");
    const state = {
      ...emptyState(),
      pressure: 90,
      pressureUpdatedAt: now.toISOString()
    };
    const decision = evaluateCheck(state, "reminder", now, defaultRulesConfig);
    expect(decision.reason).toBe("pressure_exceeded");
    expect(decision.suggestedFallback?.strategy).toBe("defer");
    expect(decision.suggestedFallback?.actionType).toBe("reminder");
    // 90+15-100=5; 5/8 h
    expect(decision.retryAfterMs).toBe(Math.ceil((5 / 8) * 36e5));
    expect(decision.sendAfter).toBeDefined();
  });

  it("type_cap deny includes window retryAfterMs and sendAfter", () => {
    const now = new Date("2026-09-04T12:00:00.000Z");
    let state = emptyState();
    state = applyOutcome(state, "reminder", "executed", {}, now);
    state = applyOutcome(state, "reminder", "executed", {}, now);
    const decision = evaluateCheck(
      state,
      "reminder",
      new Date(now.getTime() + 5 * 60 * 1000),
      defaultRulesConfig
    );
    expect(decision.reason).toBe("type_cap_reached");
    expect(decision.retryAfterMs).toBeGreaterThan(0);
    expect(decision.sendAfter).toBeDefined();
    expect(decision.suggestedFallback).toBeDefined();
  });

  it("global_cap deny includes window retryAfterMs", () => {
    const now = new Date("2026-09-04T12:00:00.000Z");
    const config = {
      ...defaultRulesConfig,
      threshold: 10_000,
      typeCap: {
        urgency: 10,
        discount: 10,
        interruption: 10,
        reminder: 10
      }
    };
    let state = emptyState();
    state = applyOutcome(state, "urgency", "executed", {}, now, config);
    state = applyOutcome(state, "discount", "executed", {}, now, config);
    state = applyOutcome(state, "interruption", "executed", {}, now, config);
    state = applyOutcome(state, "reminder", "executed", {}, now, config);
    const decision = evaluateCheck(state, "reminder", now, config);
    expect(decision.reason).toBe("global_cap_reached");
    expect(decision.retryAfterMs).toBeGreaterThan(0);
    expect(decision.sendAfter).toBeDefined();
    expect(decision.suggestedFallback?.strategy).toBe("defer");
  });

  it("cooldown deny includes sendAfter matching retryAfterMs", () => {
    const now = new Date("2026-08-07T12:00:00.000Z");
    const cooldownUntil = "2026-08-07T12:30:00.000Z";
    const state = {
      ...emptyState(),
      cooldowns: { urgency: cooldownUntil }
    };
    const decision = evaluateCheck(state, "urgency", now, defaultRulesConfig);
    expect(decision.retryAfterMs).toBe(30 * 60 * 1000);
    expect(decision.sendAfter).toBe(cooldownUntil);
  });

  it("hints next surface when check includes surface", () => {
    const now = new Date();
    const state = {
      ...emptyState(),
      pressure: 80,
      pressureUpdatedAt: now.toISOString()
    };
    const decision = evaluateCheck(state, "urgency", now, defaultRulesConfig, {
      surface: "email"
    });
    expect(decision.suggestedFallback?.surface).toBe("push");
  });

  it("sets retryAfterMs from cooldownUntil", () => {
    const now = new Date("2026-08-07T12:00:00.000Z");
    const cooldownUntil = "2026-08-07T12:30:00.000Z";
    const state = {
      ...emptyState(),
      cooldowns: { urgency: cooldownUntil }
    };
    const decision = evaluateCheck(state, "urgency", now, defaultRulesConfig);
    expect(decision.reason).toBe("cooldown_active");
    expect(decision.retryAfterMs).toBe(30 * 60 * 1000);
  });
});
