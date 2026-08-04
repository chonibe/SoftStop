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
});
