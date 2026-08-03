import { describe, expect, it } from "vitest";
import { applyOutcome, emptyState, evaluateCheck } from "./engine";

describe("pressure evaluateCheck", () => {
  it("allows when state is empty", () => {
    const decision = evaluateCheck(emptyState(), "urgency", new Date());
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("allowed");
  });

  it("blocks stacked urgency after a recent escalation", () => {
    const now = new Date();
    let state = emptyState();
    state = applyOutcome(state, "reminder", "executed", {}, now);
    const decision = evaluateCheck(state, "urgency", now);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("recent_escalation");
  });
});
