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

  it("attaches suggestedFallback when suggesting reminder on urgency deny", () => {
    const now = new Date();
    const state = {
      ...emptyState(),
      pressure: 80,
      pressureUpdatedAt: now.toISOString()
    };
    const decision = evaluateCheck(state, "urgency", now, defaultRulesConfig);
    expect(decision.suggestedActionType).toBe("reminder");
    expect(decision.suggestedFallback).toEqual({
      strategy: "downgrade",
      actionType: "reminder",
      message: expect.stringMatching(/reminder/i)
    });
    expect(decision.suggestedFallback?.actionType).toBe(
      decision.suggestedActionType
    );
  });

  it("sets retryAfterMs from cooldownUntil when cooldown is active", () => {
    const now = new Date("2026-08-07T12:00:00.000Z");
    const cooldownUntil = "2026-08-07T12:10:00.000Z";
    const state = {
      ...emptyState(),
      cooldowns: { urgency: cooldownUntil }
    };
    const decision = evaluateCheck(state, "urgency", now, defaultRulesConfig);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("cooldown_active");
    expect(decision.cooldownUntil).toBe(cooldownUntil);
    expect(decision.retryAfterMs).toBe(10 * 60 * 1000);
  });

  it("sets retryAfterMs from remaining stacking window on recent_escalation", () => {
    const now = new Date("2026-08-07T12:00:00.000Z");
    const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000);
    let state = emptyState();
    state = applyOutcome(state, "reminder", "executed", {}, threeMinutesAgo);
    const decision = evaluateCheck(state, "urgency", now, defaultRulesConfig);
    expect(decision.reason).toBe("recent_escalation");
    // default stackingWindowMinutes = 10 → 7 minutes left
    expect(decision.retryAfterMs).toBe(7 * 60 * 1000);
  });
});
