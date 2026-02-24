export const ACTION_TYPES = [
  "urgency",
  "discount",
  "interruption",
  "reminder"
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export type GovernorEventType =
  | "check"
  | "executed"
  | "blocked"
  | "downgraded";

export type DecisionReason =
  | "allowed"
  | "cooldown_active"
  | "type_cap_reached"
  | "global_cap_reached"
  | "recent_escalation";

export type OutcomeType = "executed" | "blocked" | "downgraded";

export interface GovernorEvent {
  userId: string;
  actionType: ActionType;
  eventType: GovernorEventType;
  decisionId?: string;
  context?: Record<string, unknown>;
  createdAt?: string;
  tenantId?: string;
}

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
}

export interface GovernorDecision {
  allowed: boolean;
  reason: DecisionReason;
  cooldownUntil?: string;
  suggestedActionType?: ActionType;
}
