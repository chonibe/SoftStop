import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  SoftStop,
  toSoftStopUserId,
  emitSoftStopDecisionToPostHog,
  emitSoftStopUnavailableToPostHog
} from "./index";

describe("toSoftStopUserId", () => {
  it("prefixes anonymous PostHog distinct_id with ph:", () => {
    expect(
      toSoftStopUserId({ get_distinct_id: () => "abc-123" })
    ).toBe("ph:abc-123");
  });

  it("uses sc: when known shop user", () => {
    expect(
      toSoftStopUserId(
        { get_distinct_id: () => "abc-123" },
        { kind: "sc", id: "uuid-1" }
      )
    ).toBe("sc:uuid-1");
  });

  it("normalizes email: identities", () => {
    expect(
      toSoftStopUserId(
        { get_distinct_id: () => "abc-123" },
        { kind: "email", id: "  Ada@Example.COM " }
      )
    ).toBe("email:ada@example.com");
  });

  it("does not double-prefix already-prefixed ids", () => {
    expect(
      toSoftStopUserId(
        { get_distinct_id: () => "ph:already" },
        undefined
      )
    ).toBe("ph:already");
  });
});

describe("emitSoftStopDecisionToPostHog", () => {
  it("emits softstop_allowed with decision fields", () => {
    const capture = vi.fn();
    emitSoftStopDecisionToPostHog(capture, {
      softstopUserId: "ph:x",
      actionType: "interruption",
      surface: "in-app",
      actor: "posthog-survey",
      decision: {
        allowed: true,
        reason: "allowed",
        decisionId: "d1",
        pressure: 0,
        cost: 25,
        threshold: 100,
        projectedPressure: 25
      }
    });
    expect(capture).toHaveBeenCalledWith("softstop_allowed", {
      softstop_user_id: "ph:x",
      action_type: "interruption",
      surface: "in-app",
      actor: "posthog-survey",
      decision_id: "d1",
      pressure: 0,
      cost: 25,
      projected_pressure: 25,
      threshold: 100
    });
  });

  it("emits softstop_blocked with block_reason", () => {
    const capture = vi.fn();
    emitSoftStopDecisionToPostHog(capture, {
      softstopUserId: "sc:u",
      actionType: "urgency",
      actor: "edition-watchlist",
      decision: {
        allowed: false,
        reason: "pressure_exceeded",
        decisionId: "d2",
        pressure: 90,
        cost: 40,
        threshold: 100,
        projectedPressure: 130,
        explanation: "too much"
      }
    });
    expect(capture).toHaveBeenCalledWith(
      "softstop_blocked",
      expect.objectContaining({
        block_reason: "pressure_exceeded",
        explanation: "too much"
      })
    );
  });
});

describe("emitSoftStopUnavailableToPostHog", () => {
  it("emits softstop_unavailable without inventing a decision_id", () => {
    const capture = vi.fn();
    emitSoftStopUnavailableToPostHog(capture, {
      actor: "sc-promo-modal",
      actionType: "interruption",
      softstopUserId: "ph:anon-1"
    });
    expect(capture).toHaveBeenCalledWith("softstop_unavailable", {
      actor: "sc-promo-modal",
      action_type: "interruption",
      softstop_user_id: "ph:anon-1",
      decision_id: null
    });
  });
});

describe("SoftStop.merge", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs /users/merge and returns body", async () => {
    const body = {
      ok: true,
      alreadyMerged: false,
      fromUserId: "ph:a",
      toUserId: "sc:b",
      pressure: 40
    };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify(body),
      json: async () => body
    }));
    vi.stubGlobal("fetch", fetchMock);

    const ss = new SoftStop({ url: "http://localhost:3000" });
    const result = await ss.merge({ fromUserId: "ph:a", toUserId: "sc:b" });

    expect(result.pressure).toBe(40);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/v1/users/merge",
      expect.objectContaining({ method: "POST" })
    );
  });
});
