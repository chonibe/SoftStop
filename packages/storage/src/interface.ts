import type { AuthorizeRequest, GovernorDecision } from "@governor/core";

export interface DecisionRecord {
  id: string;
  request: AuthorizeRequest;
  decision: GovernorDecision;
  createdAt: string;
}

export interface DecisionListOptions {
  tenantId: string;
  limit?: number;
}

export interface GovernorStorage {
  recordDecision(record: DecisionRecord): Promise<void>;
  listDecisions?(options: DecisionListOptions): Promise<DecisionRecord[]>;
  incrementLimit?(
    key: string,
    window: "minute" | "hourly" | "daily",
    limit: number
  ): Promise<{ allowed: boolean; count: number; retryAfter?: string }>;
  getApproval?(escalationId: string, tenantId?: string): Promise<"pending" | "approved" | "denied" | "expired" | null>;
  recordApproval?(
    escalationId: string,
    status: "pending" | "approved" | "denied" | "expired",
    tenantId?: string,
    metadata?: Record<string, unknown>
  ): Promise<void>;
}
