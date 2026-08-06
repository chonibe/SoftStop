import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { SoftStop, SoftStopHttpError } from "./index";

describe("SoftStopHttpError on check", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("includes API error body for unknown actionType (400)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: async () =>
          JSON.stringify({
            error:
              'actionType "urgnecy" is not defined in the loaded policy. Add it to costs, cooldownHours, and typeCap (same keys), or use a built-in type.'
          })
      }))
    );

    const ss = new SoftStop({ url: "http://localhost:3000" });
    await expect(
      ss.check({ userId: "u1", actionType: "urgnecy" })
    ).rejects.toMatchObject({
      name: "SoftStopHttpError",
      status: 400
    });

    try {
      await ss.check({ userId: "u1", actionType: "urgnecy" });
    } catch (e) {
      expect(e).toBeInstanceOf(SoftStopHttpError);
      const err = e as SoftStopHttpError;
      expect(err.message).toContain("400");
      expect(err.message).toContain("urgnecy");
      expect(err.message).toContain("not defined in the loaded policy");
    }
  });
});
