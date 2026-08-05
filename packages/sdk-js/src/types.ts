export type ActionType = "urgency" | "discount" | "interruption" | "reminder";
export type Surface = "email" | "sms" | "push" | "in-app";
export type Outcome = "executed" | "blocked" | "downgraded";

export interface SoftStopOptions {
  url?: string;
  baseUrl?: string;
  apiKey?: string;
  prefix?: "/v1" | "/api";
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
  suggestedActionType?: ActionType;
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
  costs: Record<ActionType, number>;
}

export interface RecordRequest {
  decisionId?: string;
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
