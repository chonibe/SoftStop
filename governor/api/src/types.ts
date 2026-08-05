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
  | "downgraded"
  | "merged";

export type DecisionReason =
  | "allowed"
  | "cooldown_active"
  | "type_cap_reached"
  | "global_cap_reached"
  | "recent_escalation"
  | "pressure_exceeded";

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
  /** Accumulated contact pressure (server-owned). Defaults to 0 when missing. */
  pressure?: number;
  /** ISO timestamp when pressure was last updated (for decay). */
  pressureUpdatedAt?: string | null;
  /** Set when this journal was merged into another userId (tombstone). */
  mergedInto?: string | null;
}

export interface GovernorDecision {
  allowed: boolean;
  reason: DecisionReason;
  cooldownUntil?: string;
  suggestedActionType?: ActionType;
  /** Decayed pressure at evaluation time */
  pressure?: number;
  /** Server-owned cost for this actionType */
  cost?: number;
  /** Policy threshold */
  threshold?: number;
  /** pressure + cost if this action were allowed */
  projectedPressure?: number;
}
