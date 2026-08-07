import { randomBytes } from "crypto";
import { GovernorEvent, GovernorUserState } from "../types";
import {
  ALL_API_KEY_SCOPES,
  ApiKeyInfo,
  ApiKeyScope,
  AtomicMergeInput,
  AtomicRecordInput,
  AtomicReleaseInput,
  AtomicReserveInput,
  AtomicResult,
  DecisionLogEntry,
  DecisionRecord,
  DecisionStatus,
  HealthMetrics,
  ReportMetrics,
  Storage
} from "./storage";

function stateKey(userId: string, tenantId = "default"): string {
  return `${tenantId}:${userId}`;
}

export interface MemoryStorageOptions {
  /** Unsafe: allow record without a prior check/decision row. */
  allowUnknownDecision?: boolean;
}

export class MemoryStorage implements Storage {
  /** Exposed for tests; production callers should use Storage methods. */
  events: GovernorEvent[] = [];
  private states = new Map<string, GovernorUserState>();
  /** Raw key → ApiKeyInfo (test/dev only; production hashes keys in Supabase). */
  private apiKeys = new Map<string, ApiKeyInfo>();
  private allowUnknownDecision: boolean;
  /** decisionId → lifecycle status */
  decisions = new Map<
    string,
    {
      tenantId: string;
      userId: string;
      actionType: string;
      status: DecisionStatus;
      cost?: number;
      reserveExpiresAt?: string;
    }
  >();

  constructor(options: MemoryStorageOptions = {}) {
    this.allowUnknownDecision =
      options.allowUnknownDecision === true ||
      ["1", "true", "yes", "on"].includes(
        String(process.env.SOFTSTOP_UNSAFE_ALLOW_UNKNOWN_DECISION ?? "")
          .trim()
          .toLowerCase()
      );
  }

  async getUserState(userId: string, tenantId = "default"): Promise<GovernorUserState | null> {
    return this.states.get(stateKey(userId, tenantId)) ?? null;
  }

  async upsertUserState(
    userId: string,
    state: GovernorUserState,
    tenantId = "default"
  ): Promise<void> {
    this.states.set(stateKey(userId, tenantId), state);
  }

  async tryUpsertUserState(
    userId: string,
    state: GovernorUserState,
    expectedVersion: number,
    tenantId = "default"
  ): Promise<"ok" | "conflict"> {
    const key = stateKey(userId, tenantId);
    const current = this.states.get(key);
    const currentVersion =
      current && typeof current.stateVersion === "number" ? current.stateVersion : 0;
    if (currentVersion !== expectedVersion) {
      return "conflict";
    }
    this.states.set(key, state);
    return "ok";
  }

  async insertEvent(event: GovernorEvent): Promise<void> {
    const withTimestamp = {
      ...event,
      tenantId: event.tenantId ?? "default",
      createdAt: event.createdAt ?? new Date().toISOString()
    };
    this.events.push(withTimestamp);
  }

  async getHealthMetrics(
    periodHours = 24,
    tenantId = "default",
    reserveTtlMs = 0
  ): Promise<HealthMetrics> {
    const cutoff = Date.now() - periodHours * 60 * 60 * 1000;
    const recent = this.events.filter(
      (e) => (e.tenantId ?? "default") === tenantId && (e.createdAt ? new Date(e.createdAt).getTime() : 0) >= cutoff
    );

    const closingTypes = ["executed", "blocked", "downgraded", "released"];
    const checks = recent.filter((e) => e.eventType === "check" && e.decisionId);
    const outcomes = recent.filter((e) =>
      ["executed", "blocked", "downgraded"].includes(e.eventType)
    );
    const closing = recent.filter((e) => closingTypes.includes(e.eventType));

    const closingDecisionIds = new Set(closing.map((o) => o.decisionId).filter(Boolean));
    const orphanCount = checks.filter((c) => !closingDecisionIds.has(c.decisionId!)).length;

    const totalChecks = checks.length;
    const totalOutcomes = outcomes.length;
    const orphanRate = totalChecks > 0 ? orphanCount / totalChecks : 0;
    const blockRate =
      totalOutcomes > 0
        ? outcomes.filter((o) => o.eventType === "blocked").length / totalOutcomes
        : 0;

    let expiredReserveCount = 0;
    if (reserveTtlMs > 0) {
      const now = Date.now();
      expiredReserveCount = checks.filter((c) => {
        if (closingDecisionIds.has(c.decisionId!)) return false;
        const created = c.createdAt ? new Date(c.createdAt).getTime() : 0;
        return now - created >= reserveTtlMs;
      }).length;
    }
    const expiredReserveRate =
      reserveTtlMs > 0 && totalChecks > 0 ? expiredReserveCount / totalChecks : 0;

    const actionTypeDistribution: Record<string, number> = {};
    for (const o of outcomes) {
      actionTypeDistribution[o.actionType] =
        (actionTypeDistribution[o.actionType] ?? 0) + 1;
    }

    let healthScore = 100;
    if (orphanRate > 0.5) healthScore -= 40;
    else if (orphanRate > 0.2) healthScore -= 20;
    else if (orphanRate > 0.05) healthScore -= 10;
    if (totalChecks > 0 && totalOutcomes === 0) healthScore -= 30;
    else if (totalChecks > 10 && totalOutcomes / totalChecks < 0.5) healthScore -= 20;
    if (Object.keys(actionTypeDistribution).length === 1 && totalOutcomes > 5)
      healthScore -= 15;
    if (blockRate > 0.8) healthScore -= 10;
    else if (blockRate < 0.01 && totalOutcomes > 20) healthScore -= 5;
    healthScore = Math.max(0, Math.min(100, healthScore));

    return {
      periodHours,
      totalChecks,
      totalOutcomes,
      orphanCount,
      orphanRate,
      expiredReserveCount,
      expiredReserveRate,
      blockRate,
      actionTypeDistribution,
      healthScore
    };
  }

  async getOrphanedDecisionIds(
    periodHours = 24,
    limit = 100,
    tenantId = "default"
  ): Promise<string[]> {
    const orphans = await this.getOrphanedChecks(periodHours, limit, tenantId);
    return orphans.map((o) => o.decisionId);
  }

  async getOrphanedChecks(
    periodHours = 24,
    limit = 100,
    tenantId = "default"
  ): Promise<
    { decisionId: string; userId: string; actionType: string; createdAt: string }[]
  > {
    const cutoff = Date.now() - periodHours * 60 * 60 * 1000;
    const recent = this.events.filter(
      (e) => (e.tenantId ?? "default") === tenantId && (e.createdAt ? new Date(e.createdAt).getTime() : 0) >= cutoff
    );

    const checks = recent.filter((e) => e.eventType === "check" && e.decisionId);
    const outcomeDecisionIds = new Set(
      recent
        .filter((e) =>
          ["executed", "blocked", "downgraded", "released"].includes(e.eventType)
        )
        .map((o) => o.decisionId)
        .filter(Boolean)
    );

    return checks
      .filter((c) => !outcomeDecisionIds.has(c.decisionId!))
      .map((c) => ({
        decisionId: c.decisionId!,
        userId: c.userId,
        actionType: c.actionType,
        createdAt: c.createdAt ?? new Date(0).toISOString()
      }))
      .slice(0, limit);
  }

  async getReportMetrics(from: string, to: string, tenantId = "default"): Promise<ReportMetrics> {
    const fromTime = new Date(from).getTime();
    const toTime = new Date(to).getTime();
    const inRange = this.events.filter((e) => {
      if ((e.tenantId ?? "default") !== tenantId) return false;
      const t = e.createdAt ? new Date(e.createdAt).getTime() : 0;
      return t >= fromTime && t <= toTime;
    });

    const checks = inRange.filter((e) => e.eventType === "check" && e.decisionId);
    const outcomes = inRange.filter((e) =>
      ["executed", "blocked", "downgraded"].includes(e.eventType)
    );

    const outcomeDecisionIds = new Set(outcomes.map((o) => o.decisionId).filter(Boolean));
    const orphanCount = checks.filter((c) => !outcomeDecisionIds.has(c.decisionId!)).length;

    const totalChecks = checks.length;
    const totalOutcomes = outcomes.length;
    const orphanRate = totalChecks > 0 ? orphanCount / totalChecks : 0;

    const outcomesByType = {
      executed: outcomes.filter((o) => o.eventType === "executed").length,
      blocked: outcomes.filter((o) => o.eventType === "blocked").length,
      downgraded: outcomes.filter((o) => o.eventType === "downgraded").length
    };

    const blocksByReason: Record<string, number> = {};
    for (const o of outcomes) {
      if (o.eventType === "blocked") {
        const reason = (o.context as { blockReason?: string })?.blockReason ?? "unknown";
        blocksByReason[reason] = (blocksByReason[reason] ?? 0) + 1;
      }
    }

    const actionTypeDistribution: Record<string, number> = {};
    for (const o of outcomes) {
      actionTypeDistribution[o.actionType] =
        (actionTypeDistribution[o.actionType] ?? 0) + 1;
    }

    return {
      period: { from, to },
      totalChecks,
      totalOutcomes,
      orphanCount,
      orphanRate,
      blocksByReason,
      outcomesByType,
      actionTypeDistribution
    };
  }

  async getDecisionLog(
    from: string,
    to: string,
    limit = 200,
    tenantId = "default",
    userId?: string
  ): Promise<DecisionLogEntry[]> {
    const fromTime = new Date(from).getTime();
    const toTime = new Date(to).getTime();
    const outcomes = this.events
      .filter((e) => (e.tenantId ?? "default") === tenantId)
      .filter((e) =>
        ["executed", "blocked", "downgraded"].includes(e.eventType)
      )
      .filter((e) => (userId ? e.userId === userId : true))
      .filter((e) => {
        const t = e.createdAt ? new Date(e.createdAt).getTime() : 0;
        return t >= fromTime && t <= toTime;
      })
      .sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      })
      .slice(0, limit)
      .map((e, i) => ({
        id: `mem-${e.decisionId ?? "orphan"}-${i}`,
        createdAt: e.createdAt ?? new Date().toISOString(),
        userId: e.userId,
        actionType: e.actionType,
        eventType: e.eventType as "executed" | "blocked" | "downgraded",
        blockReason: (e.context as { blockReason?: string })?.blockReason,
        decisionId: e.decisionId,
        context: e.context
      }));
    return outcomes;
  }

  async getTenantByApiKey(key: string): Promise<string | null> {
    const info = await this.resolveApiKey(key);
    return info?.tenantId ?? null;
  }

  async resolveApiKey(key: string): Promise<ApiKeyInfo | null> {
    const info = this.apiKeys.get(key);
    if (!info) return null;
    if (info.revokedAt) return null;
    if (info.expiresAt && new Date(info.expiresAt).getTime() <= Date.now()) {
      return null;
    }
    return info;
  }

  async createApiKey(
    tenantId: string,
    _name?: string,
    scopes?: ApiKeyScope[]
  ): Promise<{ key: string }> {
    const key = `gov_${randomBytes(24).toString("hex")}`;
    this.apiKeys.set(key, {
      tenantId,
      scopes: scopes ?? ALL_API_KEY_SCOPES.filter((s) => s !== "admin:keys")
    });
    return { key };
  }

  async touchApiKey(key: string): Promise<void> {
    const info = this.apiKeys.get(key);
    if (info) {
      this.apiKeys.set(key, { ...info });
    }
  }

  async checkAndReserveAtomic(input: AtomicReserveInput): Promise<AtomicResult> {
    const result = await this.tryUpsertUserState(
      input.userId,
      input.nextState,
      input.expectedVersion,
      input.tenantId
    );
    if (result === "conflict") {
      return { ok: false, error: "conflict" };
    }
    this.decisions.set(input.decisionId, {
      tenantId: input.tenantId,
      userId: input.userId,
      actionType: input.actionType,
      status: "reserved",
      cost: input.cost,
      reserveExpiresAt: input.reserveExpiresAt
    });
    await this.insertEvent({
      userId: input.userId,
      actionType: input.actionType,
      eventType: "check",
      decisionId: input.decisionId,
      context: input.eventContext,
      tenantId: input.tenantId
    });
    return { ok: true, status: "reserved" };
  }

  async getDecision(decisionId: string): Promise<DecisionRecord | null> {
    const existing = this.decisions.get(decisionId);
    if (!existing) return null;
    return { decisionId, ...existing };
  }

  async openDecision(input: {
    tenantId: string;
    userId: string;
    decisionId: string;
    actionType: string;
    cost?: number;
    reserveExpiresAt?: string | null;
  }): Promise<void> {
    if (this.decisions.has(input.decisionId)) return;
    this.decisions.set(input.decisionId, {
      tenantId: input.tenantId,
      userId: input.userId,
      actionType: input.actionType,
      status: "reserved",
      cost: input.cost,
      reserveExpiresAt: input.reserveExpiresAt ?? undefined
    });
  }

  async ping(): Promise<void> {
    // In-memory is always ready.
  }

  async recordDecisionAtomic(input: AtomicRecordInput): Promise<AtomicResult> {
    const existing = this.decisions.get(input.decisionId);
    const allowUnknown =
      input.allowUnknown === true || this.allowUnknownDecision;

    if (!existing) {
      if (!allowUnknown) {
        return { ok: false, error: "unknown_decision" };
      }
    } else {
      if (
        existing.tenantId !== input.tenantId ||
        existing.userId !== input.userId ||
        existing.actionType !== input.actionType
      ) {
        return { ok: false, error: "decision_mismatch", status: existing.status };
      }
    }
    if (existing && existing.status === input.outcome) {
      return { ok: true, idempotent: true, status: existing.status };
    }
    if (
      existing &&
      ["executed", "blocked", "released", "expired", "downgraded"].includes(
        existing.status
      ) &&
      existing.status !== input.outcome
    ) {
      return { ok: false, error: "already_terminal", status: existing.status };
    }

    const result = await this.tryUpsertUserState(
      input.userId,
      input.nextState,
      input.expectedVersion,
      input.tenantId
    );
    if (result === "conflict") {
      return { ok: false, error: "conflict" };
    }

    this.decisions.set(input.decisionId, {
      tenantId: input.tenantId,
      userId: input.userId,
      actionType: input.actionType,
      status: input.outcome,
      cost: existing?.cost
    });

    const already = this.events.some(
      (e) =>
        e.decisionId === input.decisionId && e.eventType === input.outcome
    );
    if (!already) {
      await this.insertEvent({
        userId: input.userId,
        actionType: input.actionType,
        eventType: input.outcome,
        decisionId: input.decisionId,
        context: input.eventContext,
        tenantId: input.tenantId
      });
    }
    return { ok: true, status: input.outcome };
  }

  async releaseDecisionAtomic(input: AtomicReleaseInput): Promise<AtomicResult> {
    const existing = this.decisions.get(input.decisionId);
    if (!existing) {
      return { ok: false, error: "unknown_decision" };
    }
    if (
      existing.tenantId !== input.tenantId ||
      existing.userId !== input.userId
    ) {
      return { ok: false, error: "decision_mismatch", status: existing.status };
    }
    return this.recordDecisionAtomic({
      ...input,
      actionType: existing.actionType,
      outcome: "released",
      allowUnknown: false
    });
  }

  async mergeUsersAtomic(input: AtomicMergeInput): Promise<AtomicResult> {
    const toResult = await this.tryUpsertUserState(
      input.toUserId,
      input.mergedState,
      input.toExpectedVersion,
      input.tenantId
    );
    if (toResult === "conflict") {
      return { ok: false, error: "conflict" };
    }
    const fromResult = await this.tryUpsertUserState(
      input.fromUserId,
      input.tombstoneState,
      input.fromExpectedVersion,
      input.tenantId
    );
    if (fromResult === "conflict") {
      return { ok: false, error: "conflict" };
    }
    await this.insertEvent({
      userId: input.toUserId,
      actionType: "reminder",
      eventType: "merged",
      context: input.eventContext,
      tenantId: input.tenantId
    });
    return { ok: true };
  }
}
