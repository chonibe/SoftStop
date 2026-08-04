export const ACTION_TYPES = [
  "urgency",
  "discount",
  "interruption",
  "reminder"
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export type DecisionReason =
  | "allowed"
  | "cooldown_active"
  | "type_cap_reached"
  | "global_cap_reached"
  | "recent_escalation"
  | "pressure_exceeded";

export interface GovernorUserState {
  cooldowns: Record<string, string | null>;
  lastActionAt: Record<string, string | null>;
  lastAnyEscalationAt: string | null;
  windows: Record<
    string,
    {
      windowStart: string;
      count: number;
    }
  >;
  pressure?: number;
  pressureUpdatedAt?: string | null;
}

export interface PressureDecision {
  allowed: boolean;
  reason: DecisionReason;
  cooldownUntil?: string;
  suggestedActionType?: ActionType;
  pressure?: number;
  cost?: number;
  threshold?: number;
  projectedPressure?: number;
}

export interface GovernorRulesConfig {
  cooldownHours: Record<ActionType, number>;
  typeCap: Record<ActionType, number>;
  globalCap: number;
  windowHours: number;
  stackingWindowMinutes: number;
  threshold: number;
  decayPerHour: number;
  costs: Record<ActionType, number>;
}

export const defaultPressureCosts: Record<ActionType, number> = {
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
  costs: { ...defaultPressureCosts }
};
