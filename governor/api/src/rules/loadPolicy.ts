import fs from "fs";
import path from "path";
import {
  defaultPressureCosts,
  defaultRulesConfig,
  GovernorRulesConfig
} from "./config";
import { ACTION_TYPES, ActionType } from "../types";

export const POLICY_PRESETS = ["default", "strict", "lenient"] as const;
export type PolicyPreset = (typeof POLICY_PRESETS)[number];

export interface LoadedPolicy {
  config: GovernorRulesConfig;
  source: string;
}

const isPositiveNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;

const isActionRecord = (v: unknown): v is Record<ActionType, number> => {
  if (!v || typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  for (const key of ACTION_TYPES) {
    if (!isPositiveNumber(obj[key])) return false;
  }
  return true;
};

/**
 * Validate a policy pack object. Throws with a clear message on failure.
 */
export const validateRulesConfig = (raw: unknown): GovernorRulesConfig => {
  if (!raw || typeof raw !== "object") {
    throw new Error("Policy must be a JSON object");
  }
  const obj = raw as Record<string, unknown>;

  if (!isActionRecord(obj.cooldownHours)) {
    throw new Error(
      `Policy.cooldownHours must map ${ACTION_TYPES.join(", ")} to non-negative numbers`
    );
  }
  if (!isActionRecord(obj.typeCap)) {
    throw new Error(
      `Policy.typeCap must map ${ACTION_TYPES.join(", ")} to non-negative numbers`
    );
  }
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

  let costs: Record<ActionType, number> = { ...defaultPressureCosts };
  if (obj.costs !== undefined) {
    if (!isActionRecord(obj.costs)) {
      throw new Error(
        `Policy.costs must map ${ACTION_TYPES.join(", ")} to non-negative numbers`
      );
    }
    costs = { ...obj.costs };
  }

  return {
    cooldownHours: { ...obj.cooldownHours },
    typeCap: { ...obj.typeCap },
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
