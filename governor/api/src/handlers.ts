import { randomUUID } from "crypto";
import { formatExplanation } from "./clarity";
import { checkSchema, recordSchema } from "./schemas";
import { Storage } from "./storage/storage";
import { applyOutcome, decayedPressure, emptyState, evaluateCheck } from "./rules/engine";
import { defaultRulesConfig, GovernorRulesConfig } from "./rules/config";
import { OutcomeType } from "./types";

function parseReportPeriod(from?: string, to?: string): { from: string; to: string } {
  const now = new Date();
  const defaultTo = now.toISOString();
  const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const fromStr = from ?? defaultFrom;
  const toStr = to ?? defaultTo;

  const fromDate = new Date(fromStr);
  const toDate = new Date(toStr);
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return { from: defaultFrom, to: defaultTo };
  }
  if (fromDate > toDate) {
    return { from: toStr, to: fromStr };
  }
  return { from: fromStr, to: toStr };
}

const DEFAULT_TENANT = "default";

export const handleHealth = async (
  storage: Storage,
  periodHours?: number,
  tenantId?: string
): Promise<{ status: number; body: unknown }> => {
  if (!storage.getHealthMetrics) {
    return {
      status: 200,
      body: { ok: false, error: "Health metrics not available" }
    };
  }

  const tid = tenantId ?? DEFAULT_TENANT;
  const metrics = await storage.getHealthMetrics(periodHours ?? 24, tid);
  return { status: 200, body: { ok: true, metrics } };
};

export const handleVerify = async (
  storage: Storage,
  tenantId?: string,
  rulesConfig: GovernorRulesConfig = defaultRulesConfig
): Promise<{ status: number; body: unknown }> => {
  const tid = tenantId ?? DEFAULT_TENANT;
  const testUserId = `_gov_verify_${Date.now()}`;
  const decisionId = randomUUID();
  const now = new Date();

  const state = (await storage.getUserState(testUserId, tid)) ?? emptyState();
  const decision = evaluateCheck(state, "reminder", now, rulesConfig);

  if (!decision.allowed) {
    return {
      status: 500,
      body: {
        ok: false,
        error: "Integration verification failed: check was not allowed",
        decisionId
      }
    };
  }

  await storage.insertEvent({
    userId: testUserId,
    actionType: "reminder",
    eventType: "check",
    decisionId,
    context: { _gov_verify: true },
    tenantId: tid
  });

  const nextState = applyOutcome(
    state,
    "reminder",
    "executed",
    {},
    now,
    rulesConfig
  );

  await storage.insertEvent({
    userId: testUserId,
    actionType: "reminder",
    eventType: "executed",
    decisionId,
    context: { _gov_verify: true, signals: {} },
    tenantId: tid
  });

  await storage.upsertUserState(testUserId, nextState, tid);

  if (storage.getOrphanedDecisionIds) {
    const orphans = await storage.getOrphanedDecisionIds(1, 100, tid);
    if (orphans.includes(decisionId)) {
      return {
        status: 500,
        body: {
          ok: false,
          error: "Integration verification failed: check/record linking not persisted",
          decisionId
        }
      };
    }
  }

  return {
    status: 200,
    body: {
      ok: true,
      decisionId,
      message: "Integration verification passed"
    }
  };
};

export const handleCheck = async (
  storage: Storage,
  payload: unknown,
  rulesConfig: GovernorRulesConfig = defaultRulesConfig
) => {
  const parsed = checkSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 400, body: { error: parsed.error.flatten() } };
  }

  const { userId, actionType, surface, context, tenantId } = parsed.data;
  const tid = tenantId ?? DEFAULT_TENANT;
  const now = new Date();
  const state = (await storage.getUserState(userId, tid)) ?? emptyState();
  const decision = evaluateCheck(state, actionType, now, rulesConfig);
  const decisionId = randomUUID();

  await storage.insertEvent({
    userId,
    actionType,
    eventType: "check",
    decisionId,
    context: context ? { surface, ...context } : { surface },
    tenantId: tid
  });

  const body: Record<string, unknown> = {
    allowed: decision.allowed,
    reason: decision.reason,
    decisionId,
    cooldownUntil: decision.cooldownUntil,
    suggestedActionType: decision.suggestedActionType,
    pressure: decision.pressure,
    cost: decision.cost,
    threshold: decision.threshold,
    projectedPressure: decision.projectedPressure
  };
  if (!decision.allowed) {
    body.explanation = formatExplanation(decision.reason, {
      cooldownUntil: decision.cooldownUntil,
      actionType
    });
  }
  return { status: 200, body };
};

export const handleGetPressure = async (
  storage: Storage,
  userId: string,
  tenantId?: string,
  rulesConfig: GovernorRulesConfig = defaultRulesConfig
): Promise<{ status: number; body: unknown }> => {
  if (!userId?.trim()) {
    return { status: 400, body: { error: "userId required" } };
  }
  const tid = tenantId ?? DEFAULT_TENANT;
  const now = new Date();
  const state = (await storage.getUserState(userId.trim(), tid)) ?? emptyState();
  const pressure = decayedPressure(state, now, rulesConfig.decayPerHour);
  return {
    status: 200,
    body: {
      userId: userId.trim(),
      pressure,
      threshold: rulesConfig.threshold,
      decayPerHour: rulesConfig.decayPerHour,
      updatedAt: state.pressureUpdatedAt ?? null,
      costs: rulesConfig.costs
    }
  };
};

export const handleRecord = async (
  storage: Storage,
  payload: unknown,
  rulesConfig: GovernorRulesConfig = defaultRulesConfig
) => {
  const parsed = recordSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 400, body: { error: parsed.error.flatten() } };
  }

  const { decisionId, userId, tenantId, actionType, outcome, blockReason, signals, context } =
    parsed.data;
  const tid = tenantId ?? DEFAULT_TENANT;
  const now = new Date();
  const state = (await storage.getUserState(userId, tid)) ?? emptyState();
  const nextState = applyOutcome(
    state,
    actionType,
    outcome as OutcomeType,
    signals,
    now,
    rulesConfig
  );

  const eventContext: Record<string, unknown> = context ? { ...context, signals } : { signals };
  if (outcome === "blocked" && blockReason) {
    eventContext.blockReason = blockReason;
  }

  await storage.insertEvent({
    userId,
    actionType,
    eventType: outcome,
    decisionId,
    context: eventContext,
    tenantId: tid
  });

  await storage.upsertUserState(userId, nextState, tid);

  return { status: 200, body: { ok: true } };
};

export const handleReport = async (
  storage: Storage,
  from?: string,
  to?: string,
  tenantId?: string
): Promise<{ status: number; body: unknown }> => {
  if (!storage.getReportMetrics) {
    return {
      status: 200,
      body: { ok: false, error: "Reporting not available" }
    };
  }
  const { from: fromStr, to: toStr } = parseReportPeriod(from, to);
  const tid = tenantId ?? DEFAULT_TENANT;
  const report = await storage.getReportMetrics(fromStr, toStr, tid);
  return { status: 200, body: { ok: true, report } };
};

export const handleAuditReport = async (
  storage: Storage,
  from?: string,
  to?: string,
  format?: "json" | "csv",
  tenantId?: string
): Promise<{
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}> => {
  if (!storage.getReportMetrics) {
    return {
      status: 200,
      body: { ok: false, error: "Reporting not available" }
    };
  }
  const { from: fromStr, to: toStr } = parseReportPeriod(from, to);
  const tid = tenantId ?? DEFAULT_TENANT;
  const summary = await storage.getReportMetrics(fromStr, toStr, tid);
  const audit = {
    generatedAt: new Date().toISOString(),
    period: { from: fromStr, to: toStr },
    summary,
    exportFormat: format ?? "json"
  };

  if (format === "csv") {
    const rows: string[] = [
      "metric,value",
      `period_from,${fromStr}`,
      `period_to,${toStr}`,
      `totalChecks,${summary.totalChecks}`,
      `totalOutcomes,${summary.totalOutcomes}`,
      `orphanCount,${summary.orphanCount}`,
      `orphanRate,${summary.orphanRate}`,
      `executed,${summary.outcomesByType.executed}`,
      `blocked,${summary.outcomesByType.blocked}`,
      `downgraded,${summary.outcomesByType.downgraded}`
    ];
    for (const [reason, count] of Object.entries(summary.blocksByReason)) {
      rows.push(`blocks_${reason},${count}`);
    }
    for (const [actionType, count] of Object.entries(summary.actionTypeDistribution)) {
      rows.push(`action_${actionType},${count}`);
    }
    return {
      status: 200,
      body: rows.join("\n"),
      headers: { "Content-Type": "text/csv" }
    };
  }

  return { status: 200, body: { ok: true, audit } };
};

function blockReasonToPlainLanguage(reason?: string): string {
  if (!reason || reason === "unknown") {
    return "Block reason not recorded (ensure record() passes blockReason when outcome is blocked).";
  }
  const known: Record<string, string> = {
    cooldown_active:
      "User recently dismissed or ignored this type. Try again after cooldown.",
    type_cap_reached:
      "Maximum allowed for this type in the last 24 hours.",
    global_cap_reached:
      "Maximum total escalations (4) in the last 24 hours.",
    recent_escalation:
      "Another escalation occurred in the last 10 minutes; avoid stacking."
  };
  return known[reason] ?? reason;
}

export const handleDecisionLog = async (
  storage: Storage,
  from?: string,
  to?: string,
  limit?: number,
  tenantId?: string
): Promise<{ status: number; body: unknown }> => {
  if (!storage.getDecisionLog) {
    return {
      status: 200,
      body: { ok: false, error: "Decision log not available", decisions: [] }
    };
  }
  const { from: fromStr, to: toStr } = parseReportPeriod(from, to);
  const tid = tenantId ?? DEFAULT_TENANT;
  const entries = await storage.getDecisionLog(fromStr, toStr, limit ?? 200, tid);
  const decisions = entries.map((e) => ({
    ...e,
    explanationPlain:
      e.eventType === "blocked"
        ? blockReasonToPlainLanguage(e.blockReason)
        : undefined
  }));
  return { status: 200, body: { ok: true, period: { from: fromStr, to: toStr }, decisions } };
};

interface InsightItem {
  severity: "good" | "warning" | "critical";
  title: string;
  message: string;
  action?: string;
}

export const handleInsights = async (
  storage: Storage,
  from?: string,
  to?: string,
  periodHours?: number,
  tenantId?: string
): Promise<{ status: number; body: unknown }> => {
  const insights: InsightItem[] = [];
  const now = new Date();
  const defaultTo = now.toISOString();
  const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fromStr = from ?? defaultFrom;
  const toStr = to ?? defaultTo;
  const hours = periodHours ?? 24;
  const tid = tenantId ?? DEFAULT_TENANT;

  if (!storage.getHealthMetrics) {
    return { status: 200, body: { ok: true, period: { from: fromStr, to: toStr }, insights: [] } };
  }

  const metrics = await storage.getHealthMetrics(hours, tid);
  let report: { blocksByReason: Record<string, number>; outcomesByType: { blocked: number }; totalChecks: number; totalOutcomes: number } | null = null;
  if (storage.getReportMetrics) {
    report = await storage.getReportMetrics(fromStr, toStr, tid);
  }

  const { orphanRate, healthScore, totalChecks, totalOutcomes, blockRate } = metrics;
  const outcomeRatio = totalChecks > 0 ? totalOutcomes / totalChecks : 1;

  // Adoption: orphan rate / record coverage
  if (orphanRate > 0.2) {
    insights.push({
      severity: "critical",
      title: "Many checks never get record()",
      message: `${(orphanRate * 100).toFixed(1)}% of checks are orphaned. Governor state will diverge from reality.`,
      action: "Ensure every check() is followed by record(), including when blocked."
    });
  } else if (orphanRate > 0.05) {
    insights.push({
      severity: "warning",
      title: "Some checks missing record()",
      message: `${(orphanRate * 100).toFixed(1)}% orphan rate. A few escalation paths may skip record().`,
      action: "Audit all touchpoints; every check must have a matching record."
    });
  } else if (totalChecks > 0 && orphanRate <= 0.05) {
    insights.push({
      severity: "good",
      title: "Adoption looks healthy",
      message: `Orphan rate ${(orphanRate * 100).toFixed(2)}%. Most checks are being recorded.`
    });
  }

  // Integration: outcomes vs checks
  if (totalChecks > 10 && outcomeRatio < 0.5) {
    insights.push({
      severity: "critical",
      title: "Record() often skipped",
      message: `Only ${(outcomeRatio * 100).toFixed(0)}% of checks have outcomes. State will be incorrect.`,
      action: "Add record() after every escalation attempt (allowed or blocked)."
    });
  }

  // Integration: health score
  if (healthScore < 50) {
    insights.push({
      severity: "critical",
      title: "Significant integration gaps",
      message: `Health score ${healthScore}. Adoption or record coverage is incomplete.`,
      action: "Review ADOPTION_CONTRACT.md and ensure all touchpoints use Governor correctly."
    });
  } else if (healthScore < 70) {
    insights.push({
      severity: "warning",
      title: "Integration needs attention",
      message: `Health score ${healthScore}. Some gaps in adoption or recording.`,
      action: "Check for missing record() calls or mislabeled actionTypes."
    });
  } else if (totalChecks > 0) {
    insights.push({
      severity: "good",
      title: "Integration healthy",
      message: `Health score ${healthScore}. Check and record flow looks correct.`
    });
  }

  // Block reasons (from report)
  if (report && report.outcomesByType.blocked > 0 && report.blocksByReason) {
    const entries = Object.entries(report.blocksByReason).sort((a, b) => b[1] - a[1]);
    const top = entries[0];
    const reasonPlain: Record<string, string> = {
      cooldown_active: "User recently dismissed or ignored this type.",
      type_cap_reached: "Maximum for this type in 24h.",
      global_cap_reached: "Maximum total escalations (4) in 24h.",
      recent_escalation: "Another escalation in last 10 minutes."
    };
    if (blockRate >= 0.05 && blockRate <= 0.25) {
      insights.push({
        severity: "good",
        title: "Governor is blocking appropriately",
        message: `${report.outcomesByType.blocked} blocks (${(blockRate * 100).toFixed(1)}%). Top reason: ${reasonPlain[top[0]] ?? top[0]} (${top[1]}x).`
      });
    } else if (blockRate > 0.8 && report.outcomesByType.blocked > 10) {
      insights.push({
        severity: "warning",
        title: "High block rate",
        message: `${(blockRate * 100).toFixed(1)}% of outcomes blocked. May indicate over-pressure before Governor or rules too strict.`,
        action: "Review whether actionTypes are correctly labeled."
      });
    } else if (blockRate < 0.01 && report.outcomesByType.blocked === 0 && report.totalOutcomes > 20) {
      insights.push({
        severity: "warning",
        title: "No blocking observed",
        message: "Governor may not be wired into high-pressure touchpoints, or users aren't hitting limits yet.",
        action: "Verify all escalation touchpoints call check() before acting."
      });
    } else if (top) {
      insights.push({
        severity: "good",
        title: "Block reason breakdown",
        message: `Top: ${reasonPlain[top[0]] ?? top[0]} (${top[1]}). Governor is enforcing limits.`
      });
    }
  }

  if (totalChecks === 0 && totalOutcomes === 0) {
    insights.push({
      severity: "warning",
      title: "No activity yet",
      message: "No checks or outcomes in this period. Governor will show insights once integration is live."
    });
  }

  return {
    status: 200,
    body: { ok: true, period: { from: fromStr, to: toStr, periodHours: hours }, insights }
  };
};
