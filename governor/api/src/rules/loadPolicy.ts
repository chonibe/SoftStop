import fs from "fs";
import path from "path";
import {
  defaultPressureCosts,
  defaultRulesConfig,
  GovernorRulesConfig
} from "./config";
import {
  ACTION_TYPES,
  ActionType,
  BUILTIN_ACTION_TYPES,
  isValidActionTypeSlug
} from "../types";

export const POLICY_PRESETS = ["default", "strict", "lenient", "anon-aggressive"] as const;
export type PolicyPreset = (typeof POLICY_PRESETS)[number];

export interface LoadedPolicy {
  config: GovernorRulesConfig;
  source: string;
}

const isPositiveNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;

const sortedKeys = (obj: Record<string, unknown>): string[] =>
  Object.keys(obj).sort();

const parseActionNumberMap = (
  field: string,
  v: unknown
): Record<ActionType, number> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    throw new Error(
      `Policy.${field} must map action types to non-negative numbers`
    );
  }
  const obj = v as Record<string, unknown>;
  const out: Record<ActionType, number> = {};

  for (const key of Object.keys(obj)) {
    if (!isValidActionTypeSlug(key)) {
      throw new Error(
        `Policy.${field} has invalid action type slug "${key}" (use lowercase letters, digits, underscores; e.g. legal_notice)`
      );
    }
    if (!isPositiveNumber(obj[key])) {
      throw new Error(
        `Policy.${field}.${key} must be a non-negative number`
      );
    }
    out[key] = obj[key];
  }

  for (const key of BUILTIN_ACTION_TYPES) {
    if (!isPositiveNumber(out[key])) {
      throw new Error(
        `Policy.${field} must include built-in types ${ACTION_TYPES.join(", ")}`
      );
    }
  }

  return out;
};

const assertSameActionKeys = (
  a: Record<ActionType, number>,
  b: Record<ActionType, number>,
  aName: string,
  bName: string
) => {
  const ka = sortedKeys(a);
  const kb = sortedKeys(b);
  if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) {
    throw new Error(
      `Policy.${aName} and Policy.${bName} must have the same keys (got ${aName}=[${ka.join(", ")}] vs ${bName}=[${kb.join(", ")}])`
    );
  }
};

/**
 * Validate a policy pack object. Throws with a clear message on failure.
 * Built-in action types are required; additional types may be added if present
 * in cooldownHours, typeCap, and costs with identical key sets.
 */
export const validateRulesConfig = (raw: unknown): GovernorRulesConfig => {
  if (!raw || typeof raw !== "object") {
    throw new Error("Policy must be a JSON object");
  }
  const obj = raw as Record<string, unknown>;

  const cooldownHours = parseActionNumberMap("cooldownHours", obj.cooldownHours);
  const typeCap = parseActionNumberMap("typeCap", obj.typeCap);
  assertSameActionKeys(cooldownHours, typeCap, "cooldownHours", "typeCap");

  if (!isPositiveNumber(obj.globalCap)) {
    throw new Error("Policy.globalCap must be a non-negative number");
  }
  if (!isPositiveNumber(obj.windowHours) || obj.windowHours <= 0) {
    throw new Error("Policy.windowHours must be a positive number");
  }
  if (!isPositiveNumber(obj.stackingWindowMinutes)) {
    throw new Error("Policy.stackingWindowMinutes must be a non-negative number");
  }

  const threshold =
    obj.threshold === undefined
      ? defaultRulesConfig.threshold
      : obj.threshold;
  if (!isPositiveNumber(threshold) || threshold <= 0) {
    throw new Error("Policy.threshold must be a positive number");
  }

  const decayPerHour =
    obj.decayPerHour === undefined
      ? defaultRulesConfig.decayPerHour
      : obj.decayPerHour;
  if (!isPositiveNumber(decayPerHour)) {
    throw new Error("Policy.decayPerHour must be a non-negative number");
  }

  let costs: Record<ActionType, number>;
  if (obj.costs === undefined) {
    const extra = Object.keys(cooldownHours).filter(
      (k) => !(BUILTIN_ACTION_TYPES as readonly string[]).includes(k)
    );
    if (extra.length > 0) {
      throw new Error(
        `Policy.costs must define the same keys as cooldownHours/typeCap (missing costs for: ${extra.join(", ")})`
      );
    }
    costs = { ...defaultPressureCosts };
  } else {
    costs = parseActionNumberMap("costs", obj.costs);
    assertSameActionKeys(cooldownHours, costs, "cooldownHours", "costs");
  }

  return {
    cooldownHours: { ...cooldownHours },
    typeCap: { ...typeCap },
    globalCap: obj.globalCap,
    windowHours: obj.windowHours,
    stackingWindowMinutes: obj.stackingWindowMinutes,
    threshold,
    decayPerHour,
    costs
  };
};

export const loadPolicyFromFile = (filePath: string): LoadedPolicy => {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Policy file not found: ${resolved}`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(resolved, "utf8"));
  } catch (err) {
    throw new Error(
      `Failed to parse policy JSON at ${resolved}: ${(err as Error).message}`
    );
  }
  const config = validateRulesConfig(raw);
  return { config, source: resolved };
};

export const resolvePoliciesDir = (cwd = process.cwd()): string => {
  const candidates = [
    path.resolve(cwd, "policies"),
    path.resolve(cwd, "..", "policies"),
    path.resolve(__dirname, "../../../../policies")
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return path.resolve(cwd, "policies");
};

export const loadPolicyPreset = (
  preset: string,
  cwd = process.cwd()
): LoadedPolicy => {
  if (!POLICY_PRESETS.includes(preset as PolicyPreset)) {
    throw new Error(
      `Unknown policy preset "${preset}". Use one of: ${POLICY_PRESETS.join(", ")}`
    );
  }
  const filePath = path.join(resolvePoliciesDir(cwd), `${preset}.json`);
  return loadPolicyFromFile(filePath);
};

export interface LoadPolicyOptions {
  /** Absolute or relative path to a JSON policy file */
  policyFile?: string;
  /** Preset name: default | strict | lenient */
  policyPreset?: string;
  cwd?: string;
}

/**
 * Resolve policy from file path, preset name, or built-in defaults.
 * Precedence: policyFile > policyPreset > in-code defaultRulesConfig.
 */
export const loadPolicy = (options: LoadPolicyOptions = {}): LoadedPolicy => {
  const cwd = options.cwd ?? process.cwd();

  if (options.policyFile?.trim()) {
    return loadPolicyFromFile(options.policyFile.trim());
  }

  if (options.policyPreset?.trim()) {
    return loadPolicyPreset(options.policyPreset.trim(), cwd);
  }

  return {
    config: {
      ...defaultRulesConfig,
      cooldownHours: { ...defaultRulesConfig.cooldownHours },
      typeCap: { ...defaultRulesConfig.typeCap },
      costs: { ...defaultRulesConfig.costs }
    },
    source: "builtin:defaultRulesConfig"
  };
};

/**
 * Load from process.env:
 * - SOFTSTOP_POLICY_FILE or GOVERNOR_POLICY_FILE
 * - SOFTSTOP_POLICY or GOVERNOR_POLICY (preset name)
 */
export const loadPolicyFromEnv = (
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd()
): LoadedPolicy => {
  const policyFile =
    env.SOFTSTOP_POLICY_FILE?.trim() || env.GOVERNOR_POLICY_FILE?.trim();
  const policyPreset =
    env.SOFTSTOP_POLICY?.trim() || env.GOVERNOR_POLICY?.trim();

  return loadPolicy({ policyFile, policyPreset, cwd });
};
