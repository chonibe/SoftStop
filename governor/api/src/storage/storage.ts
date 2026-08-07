import { GovernorEvent, GovernorUserState } from "../types";

export interface HealthMetrics {
  periodHours: number;
  totalChecks: number;
  totalOutcomes: number;
  orphanCount: number;
  orphanRate: number;
  blockRate: number;
  actionTypeDistribution: Record<string, number>;
  healthScore: number;
}

export interface ReportMetrics {
  period: { from: string; to: string };
  totalChecks: number;
  totalOutcomes: number;
  orphanCount: number;
  orphanRate: number;
  blocksByReason: Record<string, number>;
  outcomesByType: { executed: number; blocked: number; downgraded: number };
  actionTypeDistribution: Record<string, number>;
}

export interface DecisionLogEntry {
  id: string;
  createdAt: string;
  userId: string;
  actionType: string;
  eventType: "executed" | "blocked" | "downgraded";
  blockReason?: string;
  decisionId?: string;
  context?: Record<string, unknown>;
}

export interface Storage {
  getUserState(userId: string, tenantId?: string): Promise<GovernorUserState | null>;
  upsertUserState(userId: string, state: GovernorUserState, tenantId?: string): Promise<void>;
  /**
   * Optimistic concurrency upsert. Succeeds only when the stored stateVersion
   * matches `expectedVersion` (missing row treated as version 0).
   * `state.stateVersion` must already be the post-write version (expectedVersion + 1).
   */
  tryUpsertUserState?(
    userId: string,
    state: GovernorUserState,
    expectedVersion: number,
    tenantId?: string
  ): Promise<"ok" | "conflict">;
  insertEvent(event: GovernorEvent): Promise<void>;
  getHealthMetrics?(periodHours?: number, tenantId?: string): Promise<HealthMetrics>;
  getOrphanedDecisionIds?(periodHours?: number, limit?: number, tenantId?: string): Promise<string[]>;
  getReportMetrics?(from: string, to: string, tenantId?: string): Promise<ReportMetrics>;
  getDecisionLog?(
    from: string,
    to: string,
    limit?: number,
    tenantId?: string,
    userId?: string
  ): Promise<DecisionLogEntry[]>;
  getTenantByApiKey?(key: string): Promise<string | null>;
  createApiKey?(tenantId: string, name?: string): Promise<{ key: string }>;
}
