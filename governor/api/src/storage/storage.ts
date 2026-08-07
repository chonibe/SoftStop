import { GovernorEvent, GovernorUserState } from "../types";

export type ApiKeyScope =
  | "check"
  | "record"
  | "read:pressure"
  | "read:audit"
  | "merge:users"
  | "admin:keys";

export const ALL_API_KEY_SCOPES: ApiKeyScope[] = [
  "check",
  "record",
  "read:pressure",
  "read:audit",
  "merge:users",
  "admin:keys"
];

export type DecisionStatus =
  | "reserved"
  | "executed"
  | "blocked"
  | "released"
  | "expired"
  | "downgraded";

export interface ApiKeyInfo {
  tenantId: string;
  scopes: ApiKeyScope[];
  expiresAt?: string | null;
  revokedAt?: string | null;
}

export interface AtomicReserveInput {
  tenantId: string;
  userId: string;
  decisionId: string;
  actionType: string;
  expectedVersion: number;
  nextState: GovernorUserState;
  eventContext: Record<string, unknown>;
  reserveExpiresAt: string;
  cost: number;
}

export interface AtomicRecordInput {
  tenantId: string;
  userId: string;
  decisionId: string;
  actionType: string;
  outcome: "executed" | "blocked" | "downgraded";
  expectedVersion: number;
  nextState: GovernorUserState;
  eventContext: Record<string, unknown>;
}

export interface AtomicMergeInput {
  tenantId: string;
  fromUserId: string;
  toUserId: string;
  fromExpectedVersion: number;
  toExpectedVersion: number;
  mergedState: GovernorUserState;
  tombstoneState: GovernorUserState;
  eventContext: Record<string, unknown>;
}

export type AtomicResult =
  | { ok: true; idempotent?: boolean; status?: string }
  | { ok: false; error: string; status?: string; version?: number };

export interface HealthMetrics {
  periodHours: number;
  totalChecks: number;
  totalOutcomes: number;
  orphanCount: number;
  orphanRate: number;
  /** Checks past reserve TTL with no closing outcome; 0 when reserve mode off. */
  expiredReserveCount: number;
  /** expiredReserveCount / totalChecks; 0 when reserve mode off or no checks. */
  expiredReserveRate: number;
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

export interface OrphanedCheck {
  decisionId: string;
  userId: string;
  actionType: string;
  createdAt: string;
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
  getHealthMetrics?(
    periodHours?: number,
    tenantId?: string,
    reserveTtlMs?: number
  ): Promise<HealthMetrics>;
  getOrphanedDecisionIds?(periodHours?: number, limit?: number, tenantId?: string): Promise<string[]>;
  /** Checks with no closing outcome; used by orphan sweeper / health?includeOrphans=1 */
  getOrphanedChecks?(
    periodHours?: number,
    limit?: number,
    tenantId?: string
  ): Promise<OrphanedCheck[]>;
  getReportMetrics?(from: string, to: string, tenantId?: string): Promise<ReportMetrics>;
  getDecisionLog?(
    from: string,
    to: string,
    limit?: number,
    tenantId?: string,
    userId?: string
  ): Promise<DecisionLogEntry[]>;
  getTenantByApiKey?(key: string): Promise<string | null>;
  /** Resolve key → tenant + scopes (preferred over getTenantByApiKey). */
  resolveApiKey?(key: string): Promise<ApiKeyInfo | null>;
  createApiKey?(
    tenantId: string,
    name?: string,
    scopes?: ApiKeyScope[]
  ): Promise<{ key: string }>;
  /** Atomic check+reserve (Wave 2). */
  checkAndReserveAtomic?(input: AtomicReserveInput): Promise<AtomicResult>;
  /** Atomic terminal record (Wave 2). */
  recordDecisionAtomic?(input: AtomicRecordInput): Promise<AtomicResult>;
  /** Atomic merge (Wave 2). */
  mergeUsersAtomic?(input: AtomicMergeInput): Promise<AtomicResult>;
  touchApiKey?(key: string): Promise<void>;
}
