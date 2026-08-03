import { describe, expect, it } from "vitest";
import {
  REASON_PLAIN_LANGUAGE,
  formatExplanation
} from "../api/src/clarity";

describe("clarity", () => {
  it("REASON_PLAIN_LANGUAGE has all decision reasons", () => {
    expect(REASON_PLAIN_LANGUAGE.allowed).toBe("Escalation allowed.");
    expect(REASON_PLAIN_LANGUAGE.cooldown_active).toContain("cooldown");
    expect(REASON_PLAIN_LANGUAGE.type_cap_reached).toContain("24 hours");
    expect(REASON_PLAIN_LANGUAGE.global_cap_reached).toContain("4");
    expect(REASON_PLAIN_LANGUAGE.recent_escalation).toContain("10 minutes");
  });

  it("formatExplanation returns plain language for allowed", () => {
    expect(formatExplanation("allowed")).toBe("Escalation allowed.");
  });

  it("formatExplanation returns plain language for cooldown_active with cooldownUntil", () => {
    const result = formatExplanation("cooldown_active", {
      cooldownUntil: "2026-02-16T10:30:00Z"
    });
    expect(result).toContain("2026-02-16T10:30:00Z");
    expect(result).toContain("Cooldown expires");
  });

  it("formatExplanation returns default for cooldown_active without cooldownUntil", () => {
    const result = formatExplanation("cooldown_active");
    expect(result).toBe(REASON_PLAIN_LANGUAGE.cooldown_active);
  });

  it("formatExplanation returns plain language for other reasons", () => {
    expect(formatExplanation("type_cap_reached")).toBe(
      REASON_PLAIN_LANGUAGE.type_cap_reached
    );
    expect(formatExplanation("global_cap_reached")).toBe(
      REASON_PLAIN_LANGUAGE.global_cap_reached
    );
    expect(formatExplanation("recent_escalation")).toBe(
      REASON_PLAIN_LANGUAGE.recent_escalation
    );
  });
});
