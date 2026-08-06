import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  loadPolicy,
  loadPolicyFromEnv,
  loadPolicyFromFile,
  loadPolicyPreset,
  validateRulesConfig
} from "../api/src/rules/loadPolicy";
import { applyOutcome, emptyState, evaluateCheck } from "../api/src/rules/engine";
import { defaultRulesConfig } from "../api/src/rules/config";

describe("loadPolicy", () => {
  it("loads the default preset from policies/", () => {
    const loaded = loadPolicyPreset("default");
    expect(loaded.config.globalCap).toBe(4);
    expect(loaded.config.typeCap.urgency).toBe(1);
    expect(loaded.source).toMatch(/default\.json$/);
  });

  it("loads strict, lenient, and anon-aggressive presets", () => {
    expect(loadPolicyPreset("strict").config.globalCap).toBe(2);
    expect(loadPolicyPreset("lenient").config.globalCap).toBe(10);
    expect(loadPolicyPreset("anon-aggressive").config.decayPerHour).toBe(16);
    expect(loadPolicyPreset("anon-aggressive").config.threshold).toBe(100);
  });

  it("rejects invalid JSON shape", () => {
    expect(() => validateRulesConfig({ globalCap: 1 })).toThrow(/cooldownHours/);
  });

  it("rejects missing policy file", () => {
    expect(() => loadPolicyFromFile("/tmp/softstop-missing-policy.json")).toThrow(
      /not found/
    );
  });

  it("loads a custom file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "softstop-policy-"));
    const file = path.join(dir, "custom.json");
    fs.writeFileSync(
      file,
      JSON.stringify({
        ...defaultRulesConfig,
        globalCap: 99,
        typeCap: { ...defaultRulesConfig.typeCap, urgency: 0 }
      })
    );
    const loaded = loadPolicyFromFile(file);
    expect(loaded.config.globalCap).toBe(99);
    expect(loaded.config.typeCap.urgency).toBe(0);
  });

  it("prefers policyFile over preset", () => {
    const loaded = loadPolicy({
      policyFile: path.resolve("policies/lenient.json"),
      policyPreset: "strict"
    });
    expect(loaded.config.globalCap).toBe(10);
  });

  it("reads SOFTSTOP_POLICY from env", () => {
    const loaded = loadPolicyFromEnv({ SOFTSTOP_POLICY: "strict" });
    expect(loaded.config.globalCap).toBe(2);
  });
});

describe("rules engine with custom config", () => {
  it("denies urgency when typeCap.urgency is 0", () => {
    const config = {
      ...defaultRulesConfig,
      typeCap: { ...defaultRulesConfig.typeCap, urgency: 0 }
    };
    const decision = evaluateCheck(emptyState(), "urgency", new Date(), config);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("type_cap_reached");
  });

  it("allows more reminders under a lenient pack", () => {
    const lenient = loadPolicyPreset("lenient").config;
    const now = new Date();
    let state = emptyState();
    state = applyOutcome(state, "reminder", "executed", {}, now, lenient);
    state = applyOutcome(state, "reminder", "executed", {}, now, lenient);
    const decision = evaluateCheck(
      state,
      "reminder",
      new Date(now.getTime() + 5 * 60 * 1000),
      lenient
    );
    expect(decision.allowed).toBe(true);
  });

  it("loads a policy with a custom action type in all three maps", () => {
    const withCustom = {
      ...defaultRulesConfig,
      cooldownHours: { ...defaultRulesConfig.cooldownHours, legal_notice: 48 },
      typeCap: { ...defaultRulesConfig.typeCap, legal_notice: 1 },
      costs: { ...defaultRulesConfig.costs, legal_notice: 20 }
    };
    const config = validateRulesConfig(withCustom);
    expect(config.costs.legal_notice).toBe(20);
    expect(config.typeCap.legal_notice).toBe(1);

    const decision = evaluateCheck(emptyState(), "legal_notice", new Date(), config);
    expect(decision.allowed).toBe(true);
    expect(decision.cost).toBe(20);
  });

  it("rejects custom action type missing from costs", () => {
    expect(() =>
      validateRulesConfig({
        ...defaultRulesConfig,
        cooldownHours: { ...defaultRulesConfig.cooldownHours, legal_notice: 48 },
        typeCap: { ...defaultRulesConfig.typeCap, legal_notice: 1 }
      })
    ).toThrow(/same keys|legal_notice|costs/);
  });

  it("rejects invalid action type slug in policy", () => {
    expect(() =>
      validateRulesConfig({
        ...defaultRulesConfig,
        cooldownHours: { ...defaultRulesConfig.cooldownHours, "Legal-Notice": 1 },
        typeCap: { ...defaultRulesConfig.typeCap, "Legal-Notice": 1 },
        costs: { ...defaultRulesConfig.costs, "Legal-Notice": 1 }
      })
    ).toThrow(/slug|invalid/i);
  });
});
