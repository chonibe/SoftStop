import { ActionType, BuiltinActionType } from "../types";

export interface GovernorRulesConfig {
  cooldownHours: Record<ActionType, number>;
  typeCap: Record<ActionType, number>;
  globalCap: number;
  windowHours: number;
  stackingWindowMinutes: number;
  /** Max pressure before block (pressure + cost > threshold). */
  threshold: number;
  /** Linear pressure decay per hour toward 0. */
  decayPerHour: number;
  /** Server-owned pressure cost per action type. */
  costs: Record<ActionType, number>;
  /**
   * Opt-in check-and-reserve TTL in ms. `0` (default) = legacy read-only check.
   * When > 0, an allow holds cost until record or expiry (typically 15–20s).
   */
  reserveTtlMs?: number;
}

export const defaultPressureCosts: Record<BuiltinActionType, number> = {
  urgency: 40,
  discount: 30,
  interruption: 25,
  reminder: 15
};

export const defaultRulesConfig: GovernorRulesConfig = {
  cooldownHours: {
    urgency: 24,
    discount: 24,
    interruption: 12,
    reminder: 6
  },
  typeCap: {
    urgency: 1,
    discount: 1,
    interruption: 2,
    reminder: 2
  },
  globalCap: 4,
  windowHours: 24,
  stackingWindowMinutes: 10,
  threshold: 100,
  decayPerHour: 8,
  costs: { ...defaultPressureCosts },
  /** Legacy check (no reserve) until SOFTSTOP_RESERVE_TTL_MS / policy sets > 0. */
  reserveTtlMs: 0
};

export const policyActionTypes = (config: GovernorRulesConfig): ActionType[] =>
  Object.keys(config.costs);

export const isPolicyActionType = (
  config: GovernorRulesConfig,
  actionType: string
): boolean => Object.prototype.hasOwnProperty.call(config.costs, actionType);
