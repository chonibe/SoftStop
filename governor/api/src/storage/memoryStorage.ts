import { GovernorEvent, GovernorUserState } from "../types";
import { DecisionLogEntry, HealthMetrics, ReportMetrics, Storage } from "./storage";

function stateKey(userId: string, tenantId = "default"): string {
  return `${tenantId}:${userId}`;
}

export class MemoryStorage implements Storage {
  /** Exposed for tests; production callers should use Storage methods. */
  events: GovernorEvent[] = [];
  private states = new Map<string, GovernorUserState>();

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

  async getHealthMetrics(periodHours = 24, tenantId = "default"): Promise<HealthMetrics> {
    const cutoff = Date.now() - periodHours * 60 * 60 * 1000;
    const recent = this.events.filter(
      (e) => (e.tenantId ?? "default") === tenantId && (e.createdAt ? new Date(e.createdAt).getTime() : 0) >= cutoff
    );

    const checks = recent.filter((e) => e.eventType === "check" && e.decisionId);
    const outcomes = recent.filter((e) =>
      ["executed", "blocked", "downgraded"].includes(e.eventType)
    );

    const outcomeDecisionIds = new Set(outcomes.map((o) => o.decisionId).filter(Boolean));
    const orphanCount = checks.filter((c) => !outcomeDecisionIds.has(c.decisionId!)).length;

    const totalChecks = checks.length;
    const totalOutcomes = outcomes.length;
    const orphanRate = totalChecks > 0 ? orphanCount / totalChecks : 0;
    const blockRate =
      totalOutcomes > 0
        ? outcomes.filter((o) => o.eventType === "blocked").length / totalOutcomes
        : 0;

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
    const cutoff = Date.now() - periodHours * 60 * 60 * 1000;
    const recent = this.events.filter(
      (e) => (e.tenantId ?? "default") === tenantId && (e.createdAt ? new Date(e.createdAt).getTime() : 0) >= cutoff
    );

    const checks = recent.filter((e) => e.eventType === "check" && e.decisionId);
    const outcomeDecisionIds = new Set(
      recent
        .filter((e) =>
          ["executed", "blocked", "downgraded"].includes(e.eventType)
        )
        .map((o) => o.decisionId)
        .filter(Boolean)
    );

    return checks
      .filter((c) => !outcomeDecisionIds.has(c.decisionId!))
      .map((c) => c.decisionId!)
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
}
