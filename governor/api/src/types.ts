export const BUILTIN_ACTION_TYPES = [
  "urgency",
  "discount",
  "interruption",
  "reminder"
] as const;

/** @deprecated Prefer BUILTIN_ACTION_TYPES; kept for existing imports. */
export const ACTION_TYPES = BUILTIN_ACTION_TYPES;

export type BuiltinActionType = (typeof BUILTIN_ACTION_TYPES)[number];

/** Built-in or policy-defined custom action type (slug). */
export type ActionType = string;

/** Lowercase letter start, then lowercase letters / digits / underscores, max 64 chars. */
export const ACTION_TYPE_SLUG_RE = /^[a-z][a-z0-9_]{0,63}$/;

export const isValidActionTypeSlug = (value: string): boolean =>
  ACTION_TYPE_SLUG_RE.test(value);

export const isBuiltinActionType = (value: string): value is BuiltinActionType =>
  (BUILTIN_ACTION_TYPES as readonly string[]).includes(value);

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

export type FallbackStrategy = "downgrade" | "skip" | "defer";

export interface SuggestedFallback {
  strategy: FallbackStrategy;
  actionType?: ActionType;
  message?: string;
}

export interface GovernorDecision {
  allowed: boolean;
  reason: DecisionReason;
  cooldownUntil?: string;
  /** Compat alias — same as suggestedFallback.actionType when present. */
  suggestedActionType?: ActionType;
  /** Structured steering for agents when blocked. */
  suggestedFallback?: SuggestedFallback;
  /** Ms until a retry may succeed (from cooldown or stacking window). */
  retryAfterMs?: number;
  /** Decayed pressure at evaluation time */
  pressure?: number;
  /** Server-owned cost for this actionType */
  cost?: number;
  /** Policy threshold */
  threshold?: number;
  /** pressure + cost if this action were allowed */
  projectedPressure?: number;
}
