import { ActionType } from "../types";

export interface GovernorRulesConfig {
  cooldownHours: Record<ActionType, number>;
  typeCap: Record<ActionType, number>;
  globalCap: number;
  windowHours: number;
  stackingWindowMinutes: number;
}

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
  stackingWindowMinutes: 10
};
