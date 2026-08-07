import { describe, expect, it, vi, afterEach } from "vitest";
import {
  SoftStop,
  SoftStopUnavailableError,
  SoftStopHttpError
} from "./index";

describe("SoftStop fail-safe modes", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("defaults to fail_closed and throws SoftStopUnavailableError on network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      })
    );

    const ss = new SoftStop({ url: "http://localhost:3000" });
    await expect(
      ss.check({ userId: "u1", actionType: "urgency" })
    ).rejects.toBeInstanceOf(SoftStopUnavailableError);

    try {
      await ss.check({ userId: "u1", actionType: "urgency" });
    } catch (e) {
      expect(e).toBeInstanceOf(SoftStopUnavailableError);
      const err = e as SoftStopUnavailableError;
      expect(err.operation).toBe("check");
      expect(err.message).toMatch(/unavailable|unreachable|timeout/i);
      expect(err.message).toMatch(/fail_closed/i);
    }
  });

  it("fail_open returns explicit softstop_unavailable allow without decisionId", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      })
    );

    const ss = new SoftStop({
      url: "http://localhost:3000",
      onUnavailable: "fail_open"
    });
    const decision = await ss.check({ userId: "u1", actionType: "urgency" });

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("softstop_unavailable");
    expect(decision.decisionId).toBeUndefined();
    expect(decision.explanation).toMatch(/fail_open/i);
  });

  it("never invents silent allowed:true when fail_closed (default)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("network down");
      })
    );

    const ss = new SoftStop({
      url: "http://localhost:3000",
      onUnavailable: "fail_closed"
    });

    await expect(
      ss.check({ userId: "u1", actionType: "reminder" })
    ).rejects.toThrow(SoftStopUnavailableError);
  });

  it("respects timeoutMs and treats abort as unavailable", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          const signal = init?.signal;
          if (signal) {
            signal.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted", "AbortError"));
            });
          }
        });
      })
    );

    const ss = new SoftStop({
      url: "http://localhost:3000",
      timeoutMs: 50,
      onUnavailable: "fail_closed"
    });

    const pending = ss.check({ userId: "u1", actionType: "urgency" });
    const expectation = expect(pending).rejects.toBeInstanceOf(
      SoftStopUnavailableError
    );
    await vi.advanceTimersByTimeAsync(50);
    await expectation;
  });

  it("fail_open does not swallow SoftStopHttpError from a live API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: async () => JSON.stringify({ error: "unknown actionType" })
      }))
    );

    const ss = new SoftStop({
      url: "http://localhost:3000",
      onUnavailable: "fail_open"
    });

    await expect(
      ss.check({ userId: "u1", actionType: "nope" })
    ).rejects.toBeInstanceOf(SoftStopHttpError);
  });

  it("passes AbortSignal with configured timeoutMs to fetch", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.signal).toBeDefined();
      expect(init?.signal?.aborted).toBe(false);
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () =>
          JSON.stringify({
            allowed: true,
            reason: "allowed",
            decisionId: "dec-1"
          })
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const ss = new SoftStop({
      url: "http://localhost:3000",
      timeoutMs: 250
    });
    const decision = await ss.check({ userId: "u1", actionType: "urgency" });
    expect(decision.decisionId).toBe("dec-1");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("beforeContact skips record on fail_open unavailable allow", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/check")) {
          throw new TypeError("fetch failed");
        }
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify({ ok: true })
        };
      })
    );

    const ss = new SoftStop({
      url: "http://localhost:3000",
      onUnavailable: "fail_open"
    });
    const run = vi.fn(async () => "sent");
    const gated = await ss.beforeContact(
      { userId: "u1", actionType: "urgency" },
      run
    );

    expect(gated.allowed).toBe(true);
    if (gated.allowed) {
      expect(gated.result).toBe("sent");
      expect(gated.decision.reason).toBe("softstop_unavailable");
    }
    expect(run).toHaveBeenCalledOnce();
    // only check was attempted — no record
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
