import { randomUUID } from "crypto";
import { formatExplanation } from "./clarity";
import { checkSchema, recordSchema, mergeSchema, releaseSchema } from "./schemas";
import { Storage } from "./storage/storage";
import {
  appendReserve,
  applyOutcome,
  clearReserveByDecisionId,
  decayedPressure,
  emptyState,
  evaluateCheck,
  hasActiveReserve,
  isStrictReserveExpired,
  mergeUserStates,
  pruneExpiredReserves,
  tombstoneState
} from "./rules/engine";
import { defaultRulesConfig, GovernorRulesConfig, isPolicyActionType } from "./rules/config";
import { ActionType, OutcomeType } from "./types";

const unknownActionTypeError = (actionType: string) => ({
  status: 400 as const,
  body: {
    error: `actionType "${actionType}" is not defined in the loaded policy. Add it to costs, cooldownHours, and typeCap (same keys), or use a built-in type.`
  }
});

const RESERVE_CAS_RETRIES = 3;

function reserveTtlMs(config: GovernorRulesConfig): number {
  return config.reserveTtlMs ?? 0;
}

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
  tenantId?: string,
  rulesConfig: GovernorRulesConfig = defaultRulesConfig,
  includeOrphans = false
): Promise<{ status: number; body: unknown }> => {
  if (!storage.getHealthMetrics) {
    return {
      status: 200,
      body: { ok: false, error: "Health metrics not available" }
    };
  }

  const tid = tenantId ?? DEFAULT_TENANT;
  const hours = periodHours ?? 24;
  const metrics = await storage.getHealthMetrics(
    hours,
    tid,
    reserveTtlMs(rulesConfig)
  );
  const body: Record<string, unknown> = { ok: true, metrics };
  if (includeOrphans && storage.getOrphanedChecks) {
    body.orphanedChecks = await storage.getOrphanedChecks(hours, 100, tid);
  } else if (includeOrphans && storage.getOrphanedDecisionIds) {
    const ids = await storage.getOrphanedDecisionIds(hours, 100, tid);
    body.orphanedChecks = ids.map((decisionId) => ({ decisionId }));
  }
  return { status: 200, body };
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
  if (!isPolicyActionType(rulesConfig, actionType)) {
    return unknownActionTypeError(actionType);
  }
  const tid = tenantId ?? DEFAULT_TENANT;
  const ttlMs = reserveTtlMs(rulesConfig);
  const reserveEnabled = ttlMs > 0;
  const now = new Date();
  const decisionId = randomUUID();

  let decision = evaluateCheck(emptyState(), actionType, now, rulesConfig);
  let reserveExpiresAt: string | undefined;
  let actor =
    context && typeof (context as { actor?: unknown }).actor === "string"
      ? (context as { actor: string }).actor
      : undefined;

  if (reserveEnabled && storage.tryUpsertUserState) {
    let wrote = false;
    for (let attempt = 0; attempt < RESERVE_CAS_RETRIES; attempt++) {
      const raw = (await storage.getUserState(userId, tid)) ?? emptyState();
      const state = pruneExpiredReserves(raw, now);
      const expectedVersion =
        typeof state.stateVersion === "number" ? state.stateVersion : 0;
      decision = evaluateCheck(state, actionType, now, rulesConfig);

      if (!decision.allowed) {
        wrote = true; // nothing to write; proceed to event + response
        break;
      }

      const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
      const nextState = appendReserve(
        state,
        {
          decisionId,
          actionType,
          cost: decision.cost ?? rulesConfig.costs[actionType],
          expiresAt,
          ...(actor ? { actor } : {})
        },
        now
      );
      // appendReserve already bumps version from pruned state's version
      const result = await storage.tryUpsertUserState(
        userId,
        nextState,
        expectedVersion,
        tid
      );
      if (result === "ok") {
        reserveExpiresAt = expiresAt;
        wrote = true;
        break;
      }
    }
    if (!wrote) {
      // Exhausted CAS retries — re-evaluate once for a safe deny/allow without write
      const state =
        pruneExpiredReserves(
          (await storage.getUserState(userId, tid)) ?? emptyState(),
          now
        );
      decision = evaluateCheck(state, actionType, now, rulesConfig);
      if (decision.allowed) {
        decision = {
          ...decision,
          allowed: false,
          reason: "pressure_exceeded"
        };
      }
    }
  } else {
    const state = (await storage.getUserState(userId, tid)) ?? emptyState();
    decision = evaluateCheck(state, actionType, now, rulesConfig);
  }

  const pressureContext = {
    pressure: decision.pressure,
    cost: decision.cost,
    threshold: decision.threshold,
    projectedPressure: decision.projectedPressure,
    reason: decision.reason
  };

  await storage.insertEvent({
    userId,
    actionType,
    eventType: "check",
    decisionId,
    context: context
      ? { surface, ...context, ...pressureContext }
      : { surface, ...pressureContext },
    tenantId: tid
  });

  const body: Record<string, unknown> = {
    allowed: decision.allowed,
    reason: decision.reason,
    decisionId,
    cooldownUntil: decision.cooldownUntil,
    suggestedActionType: decision.suggestedActionType,
    suggestedFallback: decision.suggestedFallback,
    retryAfterMs: decision.retryAfterMs,
    pressure: decision.pressure,
    cost: decision.cost,
    threshold: decision.threshold,
    projectedPressure: decision.projectedPressure
  };
  if (reserveExpiresAt) {
    body.reserveExpiresAt = reserveExpiresAt;
    body.reserveTtlMs = ttlMs;
  }
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
  if (!isPolicyActionType(rulesConfig, actionType)) {
    return unknownActionTypeError(actionType);
  }
  const tid = tenantId ?? DEFAULT_TENANT;
  const now = new Date();
  const state = (await storage.getUserState(userId, tid)) ?? emptyState();
  const pressureBefore = decayedPressure(state, now, rulesConfig.decayPerHour);
  const cost = rulesConfig.costs[actionType];
  const reserveExpired = isStrictReserveExpired(
    state,
    decisionId,
    outcome as OutcomeType,
    rulesConfig,
    now
  );
  const applied = !reserveExpired;
  const nextState = applyOutcome(
    state,
    actionType,
    outcome as OutcomeType,
    signals,
    now,
    rulesConfig,
    { decisionId }
  );

  const eventContext: Record<string, unknown> = context ? { ...context, signals } : { signals };
  if (outcome === "blocked" && blockReason) {
    eventContext.blockReason = blockReason;
  }
  eventContext.pressure = pressureBefore;
  eventContext.cost = cost;
  eventContext.threshold = rulesConfig.threshold;
  eventContext.projectedPressure = pressureBefore + cost;
  if (outcome === "executed" || outcome === "downgraded") {
    eventContext.pressureAfter =
      typeof nextState.pressure === "number" ? nextState.pressure : pressureBefore;
    if (reserveExpired) {
      eventContext.reserveExpired = true;
      eventContext.applied = false;
    }
  }
  if (blockReason) {
    eventContext.reason = blockReason;
  }

  await storage.insertEvent({
    userId,
    actionType,
    eventType: outcome,
    decisionId,
    context: eventContext,
    tenantId: tid
  });

  const expectedVersion =
    typeof state.stateVersion === "number" ? state.stateVersion : 0;
  if (storage.tryUpsertUserState && reserveTtlMs(rulesConfig) > 0) {
    const result = await storage.tryUpsertUserState(
      userId,
      nextState,
      expectedVersion,
      tid
    );
    if (result === "conflict") {
      // Re-read and apply once more (bounded) for orphan hygiene
      const latest = (await storage.getUserState(userId, tid)) ?? emptyState();
      const retried = applyOutcome(
        latest,
        actionType,
        outcome as OutcomeType,
        signals,
        now,
        rulesConfig,
        { decisionId }
      );
      const latestVersion =
        typeof latest.stateVersion === "number" ? latest.stateVersion : 0;
      const retryResult = storage.tryUpsertUserState
        ? await storage.tryUpsertUserState(userId, retried, latestVersion, tid)
        : "ok";
      if (retryResult === "conflict") {
        await storage.upsertUserState(userId, retried, tid);
      }
    }
  } else {
    await storage.upsertUserState(userId, nextState, tid);
  }

  const body: Record<string, unknown> = {
    ok: true,
    applied,
    pressure:
      typeof nextState.pressure === "number"
        ? decayedPressure(nextState, now, rulesConfig.decayPerHour)
        : pressureBefore,
    threshold: rulesConfig.threshold
  };
  if (reserveExpired) {
    body.reserveExpired = true;
  }
  return { status: 200, body };
};

export const handleRelease = async (
  storage: Storage,
  payload: unknown,
  rulesConfig: GovernorRulesConfig = defaultRulesConfig
) => {
  if (reserveTtlMs(rulesConfig) <= 0) {
    return {
      status: 400,
      body: { error: "release requires reserve mode (reserveTtlMs > 0)" }
    };
  }
  const parsed = releaseSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 400, body: { error: parsed.error.flatten() } };
  }

  const { decisionId, userId, tenantId } = parsed.data;
  const tid = tenantId ?? DEFAULT_TENANT;
  const now = new Date();
  const state = (await storage.getUserState(userId, tid)) ?? emptyState();
  const had = hasActiveReserve(state, decisionId, now);
  const reserveEntry = (pruneExpiredReserves(state, now).reserves ?? []).find(
    (r) => r.decisionId === decisionId
  );
  const actionType: ActionType = reserveEntry?.actionType ?? "reminder";

  const cleared = clearReserveByDecisionId(state, decisionId, now);
  const version = typeof cleared.stateVersion === "number" ? cleared.stateVersion : 0;
  const nextState = {
    ...cleared,
    reserves: [...(cleared.reserves ?? [])],
    stateVersion: version + 1
  };
  const expectedVersion =
    typeof state.stateVersion === "number" ? state.stateVersion : 0;

  await storage.insertEvent({
    userId,
    actionType,
    eventType: "released",
    decisionId,
    context: {
      release: true,
      pressure: decayedPressure(state, now, rulesConfig.decayPerHour)
    },
    tenantId: tid
  });

  if (storage.tryUpsertUserState) {
    const result = await storage.tryUpsertUserState(
      userId,
      nextState,
      expectedVersion,
      tid
    );
    if (result === "conflict") {
      const latest = (await storage.getUserState(userId, tid)) ?? emptyState();
      const retryCleared = clearReserveByDecisionId(latest, decisionId, now);
      const latestVersion =
        typeof latest.stateVersion === "number" ? latest.stateVersion : 0;
      const retried = {
        ...retryCleared,
        reserves: [...(retryCleared.reserves ?? [])],
        stateVersion: latestVersion + 1
      };
      const retryResult = await storage.tryUpsertUserState(
        userId,
        retried,
        latestVersion,
        tid
      );
      if (retryResult === "conflict") {
        await storage.upsertUserState(userId, retried, tid);
      }
    }
  } else {
    await storage.upsertUserState(userId, nextState, tid);
  }

  return {
    status: 200,
    body: { ok: true, released: had }
  };
};

export const handleMerge = async (
  storage: Storage,
  payload: unknown,
  rulesConfig: GovernorRulesConfig = defaultRulesConfig
): Promise<{ status: number; body: unknown }> => {
  const parsed = mergeSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 400, body: { error: parsed.error.flatten() } };
  }

  const fromUserId = parsed.data.fromUserId.trim();
  const toUserId = parsed.data.toUserId.trim();
  const tid = parsed.data.tenantId ?? DEFAULT_TENANT;

  if (fromUserId === toUserId) {
    return { status: 400, body: { error: "fromUserId and toUserId must differ" } };
  }

  const now = new Date();
  const fromState = (await storage.getUserState(fromUserId, tid)) ?? emptyState();
  const toState = (await storage.getUserState(toUserId, tid)) ?? emptyState();

  if (fromState.mergedInto === toUserId) {
    const pressure = decayedPressure(toState, now, rulesConfig.decayPerHour);
    return {
      status: 200,
      body: {
        ok: true,
        alreadyMerged: true,
        fromUserId,
        toUserId,
        pressure,
        threshold: rulesConfig.threshold
      }
    };
  }

  if (fromState.mergedInto && fromState.mergedInto !== toUserId) {
    return {
      status: 409,
      body: {
        error: "fromUserId already merged into a different user",
        mergedInto: fromState.mergedInto
      }
    };
  }

  const merged = mergeUserStates(fromState, toState, now, rulesConfig);

  await storage.upsertUserState(toUserId, merged, tid);
  await storage.upsertUserState(fromUserId, tombstoneState(toUserId), tid);

  await storage.insertEvent({
    userId: toUserId,
    actionType: "reminder",
    eventType: "merged",
    context: {
      fromUserId,
      toUserId,
      pressure: merged.pressure ?? 0,
      pressureAfter: merged.pressure ?? 0,
      threshold: rulesConfig.threshold
    },
    tenantId: tid
  });

  return {
    status: 200,
    body: {
      ok: true,
      alreadyMerged: false,
      fromUserId,
      toUserId,
      pressure: merged.pressure ?? 0,
      threshold: rulesConfig.threshold
    }
  };
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
      "Another escalation occurred in the last 10 minutes; avoid stacking.",
    orphan_timeout:
      "Check had no record within the orphan window; closed as blocked by the orphan sweeper."
  };
  return known[reason] ?? reason;
}

export const handleDecisionLog = async (
  storage: Storage,
  from?: string,
  to?: string,
  limit?: number,
  tenantId?: string,
  userId?: string
): Promise<{ status: number; body: unknown }> => {
  if (!storage.getDecisionLog) {
    return {
      status: 200,
      body: { ok: false, error: "Decision log not available", decisions: [] }
    };
  }
  const { from: fromStr, to: toStr } = parseReportPeriod(from, to);
  const tid = tenantId ?? DEFAULT_TENANT;
  const entries = await storage.getDecisionLog(
    fromStr,
    toStr,
    limit ?? 200,
    tid,
    userId
  );
  const decisions = entries.map((e) => ({
    ...e,
    explanationPlain:
      e.eventType === "blocked"
        ? blockReasonToPlainLanguage(e.blockReason)
        : undefined
  }));
  return { status: 200, body: { ok: true, period: { from: fromStr, to: toStr }, decisions } };
};

export const handleGetActivity = async (
  storage: Storage,
  userId: string,
  limit?: number,
  tenantId?: string,
  rulesConfig: GovernorRulesConfig = defaultRulesConfig
): Promise<{ status: number; body: unknown }> => {
  if (!userId?.trim()) {
    return { status: 400, body: { error: "userId required" } };
  }
  const trimmed = userId.trim();
  const pressureResult = await handleGetPressure(storage, trimmed, tenantId, rulesConfig);
  if (pressureResult.status !== 200) {
    return pressureResult;
  }
  const pressureBody = pressureResult.body as {
    userId: string;
    pressure: number;
    threshold: number;
    decayPerHour: number;
    updatedAt: string | null;
    costs: Record<string, number>;
  };

  const tid = tenantId ?? DEFAULT_TENANT;
  const { from: fromStr, to: toStr } = parseReportPeriod(
    new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    new Date().toISOString()
  );

  let events: Array<Record<string, unknown>> = [];
  if (storage.getDecisionLog) {
    const entries = await storage.getDecisionLog(
      fromStr,
      toStr,
      limit ?? 50,
      tid,
      trimmed
    );
    events = entries.map((e) => {
      const ctx = (e.context ?? {}) as Record<string, unknown>;
      return {
        createdAt: e.createdAt,
        actionType: e.actionType,
        eventType: e.eventType,
        actor: typeof ctx.actor === "string" ? ctx.actor : null,
        pressure: typeof ctx.pressure === "number" ? ctx.pressure : null,
        cost: typeof ctx.cost === "number" ? ctx.cost : null,
        projectedPressure:
          typeof ctx.projectedPressure === "number" ? ctx.projectedPressure : null,
        pressureAfter:
          typeof ctx.pressureAfter === "number" ? ctx.pressureAfter : null,
        blockReason: e.blockReason ?? null,
        decisionId: e.decisionId ?? null
      };
    });
  }

  return {
    status: 200,
    body: {
      userId: pressureBody.userId,
      pressure: pressureBody.pressure,
      threshold: pressureBody.threshold,
      decayPerHour: pressureBody.decayPerHour,
      costs: pressureBody.costs,
      updatedAt: pressureBody.updatedAt,
      events
    }
  };
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
