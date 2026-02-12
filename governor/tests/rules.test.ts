import { describe, expect, it } from "vitest";
import { applyOutcome, emptyState, evaluateCheck } from "../api/src/rules/engine";
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
});
