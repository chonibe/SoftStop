/**
 * Built-in SoftStop action types (always present in every policy).
 * Prefer these for autocomplete; custom policy slugs are also valid ActionTypes.
 */
export type BuiltinActionType =
  | "urgency"
  | "discount"
  | "interruption"
  | "reminder";

/**
 * Built-ins plus policy-defined custom slugs.
 * `(string & {})` keeps autocomplete for builtins while allowing customs.
 * Typos like `"urgnecy"` still type-check — the API rejects unknown types with HTTP 400
 * (see SoftStopHttpError). Prefer BuiltinActionType literals in app code when possible.
 */
export type ActionType = BuiltinActionType | (string & {});

export type Surface = "email" | "sms" | "push" | "in-app";
export type Outcome = "executed" | "blocked" | "downgraded";

export type FallbackStrategy = "downgrade" | "skip" | "defer";

export interface SuggestedFallback {
  strategy: FallbackStrategy;
  actionType?: ActionType;
  message?: string;
}

/**
 * When SoftStop is unreachable or times out during `check`:
 * - `fail_closed` (default) — throw SoftStopUnavailableError; never invent allowed:true
 * - `fail_open` — return `{ allowed: true, reason: "softstop_unavailable" }` with no decisionId
 *   (skip `record()`; use for critical paths only)
 */
export type OnUnavailable = "fail_closed" | "fail_open";

export interface SoftStopOptions {
  url?: string;
  baseUrl?: string;
  apiKey?: string;
  prefix?: "/v1" | "/api";
  /**
   * Behavior when SoftStop is unreachable / times out on `check`.
   * Default: `fail_closed` (authorize-only honesty).
   */
  onUnavailable?: OnUnavailable;
  /**
   * Per-request timeout in milliseconds (AbortSignal).
   * Default: `500` — short enough for agent loops.
   */
  timeoutMs?: number;
}

export interface CheckRequest {
  userId: string;
  actionType: ActionType;
  surface?: Surface;
  context?: Record<string, unknown>;
}

export interface CheckResponse {
  allowed: boolean;
  reason: string;
  decisionId?: string;
  cooldownUntil?: string;
  /** Compat alias — same as suggestedFallback.actionType when present. */
  suggestedActionType?: ActionType;
  suggestedFallback?: SuggestedFallback;
  retryAfterMs?: number;
  explanation?: string;
  pressure?: number;
  cost?: number;
  threshold?: number;
  projectedPressure?: number;
}

export interface PressureResponse {
  userId: string;
  pressure: number;
  threshold: number;
  decayPerHour: number;
  updatedAt: string | null;
  costs: Record<string, number>;
}

export interface RecordRequest {
  /** Required UUID from check (server enforces). */
  decisionId: string;
  userId: string;
  actionType: ActionType;
  outcome: Outcome;
  blockReason?: string;
  signals?: {
    dismissed?: boolean;
    ignored?: boolean;
    hesitated?: boolean;
  };
  context?: Record<string, unknown>;
  tenantId?: string;
}

export interface MergeRequest {
  fromUserId: string;
  toUserId: string;
  tenantId?: string;
}

export interface MergeResponse {
  ok?: boolean;
  alreadyMerged?: boolean;
  fromUserId?: string;
  toUserId?: string;
  pressure?: number;
  threshold?: number;
  error?: unknown;
}

/** Minimal client surface used by agent helpers (avoids circular imports). */
export interface SoftStopClient {
  check(payload: CheckRequest): Promise<CheckResponse>;
  record(payload: RecordRequest): Promise<{ ok?: boolean }>;
}
