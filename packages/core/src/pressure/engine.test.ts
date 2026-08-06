import { describe, expect, it } from "vitest";
import { applyOutcome, emptyState, evaluateCheck } from "./engine";
import { defaultRulesConfig } from "./types";

describe("pressure evaluateCheck", () => {
  it("allows when state is empty", () => {
    const decision = evaluateCheck(emptyState(), "urgency", new Date());
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("allowed");
    expect(decision.projectedPressure).toBe(40);
  });

  it("blocks stacked urgency after a recent escalation", () => {
    const now = new Date();
    let state = emptyState();
    state = applyOutcome(state, "reminder", "executed", {}, now);
    const decision = evaluateCheck(state, "urgency", now);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("recent_escalation");
  });

  it("blocks when pressure would exceed threshold", () => {
    const now = new Date();
    const state = {
      ...emptyState(),
      pressure: 80,
      pressureUpdatedAt: now.toISOString()
    };
    const decision = evaluateCheck(state, "urgency", now, defaultRulesConfig);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("pressure_exceeded");
  });
});
