import { describe, expect, it, vi, beforeEach } from "vitest";
import { SoftStop, beforeContact, wrapUserFacingTool } from "./index";

function mockFetchSequence(responses: unknown[]) {
  let i = 0;
  return vi.fn(async () => {
    const body = responses[i++] ?? { ok: true };
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => body
    };
  });
}

describe("beforeContact", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("runs and records executed when allowed", async () => {
    const fetchMock = mockFetchSequence([
      {
        allowed: true,
        reason: "allowed",
        decisionId: "dec-1",
        pressure: 0,
        cost: 40,
        threshold: 100,
        projectedPressure: 40
      },
      { ok: true }
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const ss = new SoftStop({ url: "http://localhost:3000" });
    const run = vi.fn(async () => "sent");

    const result = await ss.beforeContact(
      { userId: "u1", actionType: "urgency", actor: "sales-agent", surface: "email" },
      run
    );

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.result).toBe("sent");
    }
    expect(run).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const recordBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(recordBody.outcome).toBe("executed");
    expect(recordBody.context.actor).toBe("sales-agent");
  });

  it("skips run and records blocked when denied", async () => {
    const fetchMock = mockFetchSequence([
      {
        allowed: false,
        reason: "pressure_exceeded",
        decisionId: "dec-2",
        suggestedActionType: "reminder",
        pressure: 80,
        cost: 40,
        threshold: 100,
        projectedPressure: 120
      },
      { ok: true }
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const ss = new SoftStop({ url: "http://localhost:3000" });
    const run = vi.fn(async () => "sent");

    const result = await beforeContact(
      ss,
      { userId: "u1", actionType: "urgency" },
      run
    );

    expect(result.allowed).toBe(false);
    expect(run).not.toHaveBeenCalled();
    if (!result.allowed) {
      expect(result.decision.reason).toBe("pressure_exceeded");
      expect(result.suggestedActionType).toBe("reminder");
    }
    const recordBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(recordBody.outcome).toBe("blocked");
    expect(recordBody.blockReason).toBe("pressure_exceeded");
  });
});

describe("wrapUserFacingTool", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("wraps a contact tool with SoftStop", async () => {
    const fetchMock = mockFetchSequence([
      {
        allowed: true,
        reason: "allowed",
        decisionId: "dec-3",
        pressure: 0,
        cost: 30,
        threshold: 100,
        projectedPressure: 30
      },
      { ok: true }
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const ss = new SoftStop({ url: "http://localhost:3000" });
    const sendSms = wrapUserFacingTool(
      ss,
      {
        userId: (args) => String(args.to),
        actionType: "discount",
        surface: "sms",
        actor: "marketing-agent"
      },
      async (args: { to: string; body: string }) => ({ delivered: true, to: args.to })
    );

    const out = await sendSms({ to: "user_9", body: "20% off" });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.result.delivered).toBe(true);
    }
  });
});
