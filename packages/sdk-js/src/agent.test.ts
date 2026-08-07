import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  SoftStop,
  beforeContact,
  wrapUserFacingTool,
  formatBlockedForLlm,
  withSoftStop
} from "./index";

function mockFetchSequence(responses: unknown[]) {
  let i = 0;
  return vi.fn(async () => {
    const body = responses[i++] ?? { ok: true };
    const text = JSON.stringify(body);
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => text,
      json: async () => body
    };
  });
}

function requestBody(fetchMock: ReturnType<typeof vi.fn>, callIndex: number) {
  const call = fetchMock.mock.calls[callIndex] as
    | [string, { body?: string }]
    | undefined;
  return JSON.parse(String(call?.[1]?.body ?? "{}"));
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
      expect(result.execution).toBe("executed");
      expect(result.recording).toBe("ok");
      expect(result.retryExecution).toBe(false);
      expect(result.retryRecord).toBe(false);
    }
    expect(run).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const recordBody = requestBody(fetchMock, 1);
    expect(recordBody.outcome).toBe("executed");
    expect(recordBody.context.actor).toBe("sales-agent");
  });

  it("does not imply safe replay when record fails after side effect", async () => {
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call += 1;
      if (call === 1) {
        const body = {
          allowed: true,
          reason: "allowed",
          decisionId: "11111111-1111-4111-8111-111111111111",
          pressure: 0,
          cost: 40,
          threshold: 100,
          projectedPressure: 40
        };
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify(body),
          json: async () => body
        };
      }
      return {
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        text: async () => JSON.stringify({ error: "down" }),
        json: async () => ({ error: "down" })
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const ss = new SoftStop({ url: "http://localhost:3000" });
    const run = vi.fn(async () => "sent");

    const result = await beforeContact(
      ss,
      { userId: "u1", actionType: "urgency" },
      run
    );

    expect(run).toHaveBeenCalledOnce();
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.result).toBe("sent");
      expect(result.execution).toBe("executed");
      expect(result.recording).toBe("failed");
      expect(result.retryExecution).toBe(false);
      expect(result.retryRecord).toBe(true);
    }
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
    const recordBody = requestBody(fetchMock, 1);
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
    const checkBody = requestBody(fetchMock, 0);
    expect(checkBody.context?.toolArgs).toBeUndefined();
    expect(checkBody.context?.actor).toBe("marketing-agent");
  });

  it("does not put raw toolArgs in check context by default", async () => {
    const fetchMock = mockFetchSequence([
      {
        allowed: true,
        reason: "allowed",
        decisionId: "dec-4",
        pressure: 0,
        cost: 30,
        threshold: 100,
        projectedPressure: 30
      },
      { ok: true }
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const ss = new SoftStop({ url: "http://localhost:3000" });
    const tool = wrapUserFacingTool(
      ss,
      {
        userId: "u1",
        actionType: "urgency",
        actor: "agent",
        toolName: "send_email",
        operationId: "op-1"
      },
      async () => ({ ok: true })
    );
    await tool({ secret: "should-not-leak", to: "x" });
    const checkBody = requestBody(fetchMock, 0);
    expect(checkBody.context).toEqual({
      actor: "agent",
      toolName: "send_email",
      operationId: "op-1"
    });
  });
});

describe("formatBlockedForLlm", () => {
  it("returns stable JSON for a blocked decision", () => {
    const text = formatBlockedForLlm({
      allowed: false,
      reason: "pressure_exceeded",
      decisionId: "dec-x",
      explanation: "User pressure would exceed the threshold.",
      suggestedActionType: "reminder",
      suggestedFallback: {
        strategy: "downgrade",
        actionType: "reminder",
        message: "Prefer a softer reminder path."
      },
      retryAfterMs: 600_000,
      pressure: 90,
      cost: 40,
      threshold: 100,
      projectedPressure: 130
    });

    const parsed = JSON.parse(text);
    expect(parsed).toEqual({
      blocked: true,
      reason: "pressure_exceeded",
      explanation: "User pressure would exceed the threshold.",
      suggestedActionType: "reminder",
      suggestedFallback: {
        strategy: "downgrade",
        actionType: "reminder",
        message: "Prefer a softer reminder path."
      },
      retryAfterMs: 600_000
    });
    expect(parsed.decisionId).toBeUndefined();
    expect(parsed.pressure).toBeUndefined();
  });

  it("omits optional fields when absent", () => {
    const parsed = JSON.parse(
      formatBlockedForLlm({
        allowed: false,
        reason: "global_cap_reached"
      })
    );
    expect(parsed).toEqual({
      blocked: true,
      reason: "global_cap_reached"
    });
  });
});

describe("withSoftStop", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns execute result when allowed", async () => {
    const fetchMock = mockFetchSequence([
      {
        allowed: true,
        reason: "allowed",
        decisionId: "dec-ws-1",
        pressure: 0,
        cost: 40,
        threshold: 100,
        projectedPressure: 40
      },
      { ok: true }
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const ss = new SoftStop({ url: "http://localhost:3000" });
    const execute = withSoftStop(
      async (args: { userId: string; subject: string }) => ({
        messageId: `msg_${args.userId}`
      }),
      {
        client: ss,
        userId: (args) => String(args.userId),
        actionType: "urgency",
        surface: "email",
        actor: "vercel-ai-agent"
      }
    );

    const out = await execute({ userId: "u1", subject: "Hi" });
    expect(out).toEqual({ messageId: "msg_u1" });
  });

  it("returns formatBlockedForLlm string when denied", async () => {
    const fetchMock = mockFetchSequence([
      {
        allowed: false,
        reason: "recent_escalation",
        decisionId: "dec-ws-2",
        explanation: "Another hard escalation was too recent.",
        suggestedActionType: "reminder",
        suggestedFallback: {
          strategy: "downgrade",
          actionType: "reminder",
          message: "Prefer a softer reminder path."
        },
        retryAfterMs: 420_000,
        pressure: 15,
        cost: 40,
        threshold: 100,
        projectedPressure: 55
      },
      { ok: true }
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const ss = new SoftStop({ url: "http://localhost:3000" });
    const run = vi.fn(async () => ({ messageId: "should-not-run" }));
    const execute = withSoftStop(run, {
      client: ss,
      userId: "u1",
      actionType: "urgency",
      surface: "email"
    });

    const out = await execute({ subject: "Again?" });
    expect(run).not.toHaveBeenCalled();
    expect(typeof out).toBe("string");
    expect(JSON.parse(out as string)).toEqual({
      blocked: true,
      reason: "recent_escalation",
      explanation: "Another hard escalation was too recent.",
      suggestedActionType: "reminder",
      suggestedFallback: {
        strategy: "downgrade",
        actionType: "reminder",
        message: "Prefer a softer reminder path."
      },
      retryAfterMs: 420_000
    });
  });
});
