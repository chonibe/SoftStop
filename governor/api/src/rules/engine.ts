import { ActionType, GovernorDecision, GovernorUserState, PressureReserve } from "../types";
import { defaultRulesConfig, GovernorRulesConfig } from "./config";

const GLOBAL_KEY = "global";

export const emptyState = (): GovernorUserState => ({
  cooldowns: {},
  lastActionAt: {},
  lastAnyEscalationAt: null,
  windows: {},
  pressure: 0,
  pressureUpdatedAt: null,
  stateVersion: 0,
  reserves: []
});

/** Drop reserves whose expiresAt is at or before now. */
export const pruneExpiredReserves = (
  state: GovernorUserState,
  now: Date
): GovernorUserState => {
  const reserves = state.reserves ?? [];
  if (reserves.length === 0) return state;
  const active = reserves.filter((r) => new Date(r.expiresAt).getTime() > now.getTime());
  if (active.length === reserves.length) return state;
  return { ...state, reserves: active };
};

/** Sum of costs for non-expired reserves. */
export const activeReserveCost = (state: GovernorUserState, now: Date): number => {
  const reserves = state.reserves ?? [];
  let sum = 0;
  for (const r of reserves) {
    if (new Date(r.expiresAt).getTime() > now.getTime()) {
      sum += r.cost;
    }
  }
  return sum;
};

/** Decayed ledger pressure plus active reserve holds. */
export const effectivePressure = (
  state: GovernorUserState,
  now: Date,
  decayPerHour: number
): number => decayedPressure(state, now, decayPerHour) + activeReserveCost(state, now);

export const clearReserveByDecisionId = (
  state: GovernorUserState,
  decisionId: string | undefined,
  now: Date
): GovernorUserState => {
  const pruned = pruneExpiredReserves(state, now);
  if (!decisionId || !(pruned.reserves?.length)) return pruned;
  return {
    ...pruned,
    reserves: (pruned.reserves ?? []).filter((r) => r.decisionId !== decisionId)
  };
};

/** True when decisionId has a non-expired reserve hold. */
export const hasActiveReserve = (
  state: GovernorUserState,
  decisionId: string | undefined,
  now: Date
): boolean => {
  if (!decisionId) return false;
  const pruned = pruneExpiredReserves(state, now);
  return (pruned.reserves ?? []).some((r) => r.decisionId === decisionId);
};

/**
 * Under opt-in reserve, late executed/downgraded after lease expiry must not
 * apply cost. Callers use this for `applied` / `reserveExpired` on record.
 */
export const isStrictReserveExpired = (
  state: GovernorUserState,
  decisionId: string | undefined,
  outcome: "executed" | "downgraded" | "blocked",
  config: GovernorRulesConfig,
  now: Date
): boolean => {
  if ((config.reserveTtlMs ?? 0) <= 0) return false;
  if (outcome !== "executed" && outcome !== "downgraded") return false;
  if (!decisionId) return false;
  return !hasActiveReserve(state, decisionId, now);
};

export const appendReserve = (
  state: GovernorUserState,
  reserve: PressureReserve,
  now: Date
): GovernorUserState => {
  const pruned = pruneExpiredReserves(state, now);
  const version = typeof pruned.stateVersion === "number" ? pruned.stateVersion : 0;
  return {
    ...pruned,
    reserves: [...(pruned.reserves ?? []), reserve],
    stateVersion: version + 1
  };
};

/** Apply linear decay from pressureUpdatedAt to now; floor at 0. */
export const decayedPressure = (
  state: GovernorUserState,
  now: Date,
  decayPerHour: number
): number => {
  const raw = typeof state.pressure === "number" ? state.pressure : 0;
  if (raw <= 0) return 0;
  if (!state.pressureUpdatedAt || decayPerHour <= 0) return raw;
  const updatedAt = new Date(state.pressureUpdatedAt);
  if (Number.isNaN(updatedAt.getTime())) return raw;
  const hours = Math.max(0, (now.getTime() - updatedAt.getTime()) / 36e5);
  const next = Math.max(0, raw - hours * decayPerHour);
  return Math.round(next * 100) / 100;
};

const ensureWindow = (
  state: GovernorUserState,
  key: string,
  nowIso: string
) => {
  if (!state.windows[key]) {
    state.windows[key] = { windowStart: nowIso, count: 0 };
  }
};

const rollWindowIfNeeded = (
  state: GovernorUserState,
  key: string,
  windowHours: number,
  now: Date
) => {
  ensureWindow(state, key, now.toISOString());
  const windowStart = new Date(state.windows[key].windowStart);
  const diffHours = (now.getTime() - windowStart.getTime()) / 36e5;
  if (diffHours >= windowHours) {
    state.windows[key] = { windowStart: now.toISOString(), count: 0 };
  }
};

const incrementWindow = (
  state: GovernorUserState,
  key: string,
  windowHours: number,
  now: Date
) => {
  rollWindowIfNeeded(state, key, windowHours, now);
  state.windows[key].count += 1;
};

const getWindowCount = (
  state: GovernorUserState,
  key: string,
  windowHours: number,
  now: Date
) => {
  rollWindowIfNeeded(state, key, windowHours, now);
  return state.windows[key].count;
};

const withPressureFields = (
  decision: GovernorDecision,
  pressure: number,
  cost: number,
  threshold: number
): GovernorDecision => ({
  ...decision,
  pressure,
  cost,
  threshold,
  projectedPressure: pressure + cost
});

const reminderFallback = (): Pick<
  GovernorDecision,
  "suggestedActionType" | "suggestedFallback"
> => ({
  suggestedActionType: "reminder",
  suggestedFallback: {
    strategy: "downgrade",
    actionType: "reminder",
    message:
      "Prefer a softer reminder path; do not retry the same actionType immediately."
  }
});

const softDowngradeHints = (
  actionType: ActionType
): Pick<GovernorDecision, "suggestedActionType" | "suggestedFallback"> =>
  actionType === "urgency" || actionType === "interruption"
    ? reminderFallback()
    : {};

const retryAfterFromCooldown = (
  cooldownUntil: string,
  now: Date
): number => Math.max(0, new Date(cooldownUntil).getTime() - now.getTime());

const retryAfterFromStacking = (
  lastAnyEscalationAt: string,
  now: Date,
  stackingWindowMinutes: number
): number => {
  const windowMs = stackingWindowMinutes * 60_000;
  const elapsed =
    now.getTime() - new Date(lastAnyEscalationAt).getTime();
  return Math.max(0, Math.ceil(windowMs - elapsed));
};

export const evaluateCheck = (
  state: GovernorUserState,
  actionType: ActionType,
  now: Date,
  config: GovernorRulesConfig = defaultRulesConfig
): GovernorDecision => {
  const reserveEnabled = (config.reserveTtlMs ?? 0) > 0;
  const working = reserveEnabled ? pruneExpiredReserves(state, now) : state;
  const pressure = reserveEnabled
    ? effectivePressure(working, now, config.decayPerHour)
    : decayedPressure(working, now, config.decayPerHour);
  const cost = config.costs[actionType];
  const threshold = config.threshold;
  const attach = (d: GovernorDecision) =>
    withPressureFields(d, pressure, cost, threshold);

  if (pressure + cost > threshold) {
    return attach({
      allowed: false,
      reason: "pressure_exceeded",
      ...softDowngradeHints(actionType)
    });
  }

  const cooldownUntil = working.cooldowns[actionType];
  if (cooldownUntil && new Date(cooldownUntil) > now) {
    return attach({
      allowed: false,
      reason: "cooldown_active",
      cooldownUntil,
      retryAfterMs: retryAfterFromCooldown(cooldownUntil, now),
      ...softDowngradeHints(actionType)
    });
  }

  const typeCount = getWindowCount(
    working,
    actionType,
    config.windowHours,
    now
  );
  if (typeCount >= config.typeCap[actionType]) {
    return attach({
      allowed: false,
      reason: "type_cap_reached",
      ...softDowngradeHints(actionType)
    });
  }

  const globalCount = getWindowCount(
    working,
    GLOBAL_KEY,
    config.windowHours,
    now
  );
  if (globalCount >= config.globalCap) {
    return attach({
      allowed: false,
      reason: "global_cap_reached"
    });
  }

  if (working.lastAnyEscalationAt) {
    const diffMinutes =
      (now.getTime() - new Date(working.lastAnyEscalationAt).getTime()) / 6e4;
    if (
      diffMinutes < config.stackingWindowMinutes &&
      (actionType === "urgency" || actionType === "interruption")
    ) {
      return attach({
        allowed: false,
        reason: "recent_escalation",
        retryAfterMs: retryAfterFromStacking(
          working.lastAnyEscalationAt,
          now,
          config.stackingWindowMinutes
        ),
        ...reminderFallback()
      });
    }
  }

  return attach({ allowed: true, reason: "allowed" });
};

export interface ApplyOutcomeOptions {
  decisionId?: string;
}

export const applyOutcome = (
  state: GovernorUserState,
  actionType: ActionType,
  outcome: "executed" | "downgraded" | "blocked",
  signals: { hesitated?: boolean; ignored?: boolean; dismissed?: boolean } = {},
  now: Date,
  config: GovernorRulesConfig = defaultRulesConfig,
  options: ApplyOutcomeOptions = {}
): GovernorUserState => {
  const skipCost = isStrictReserveExpired(
    state,
    options.decisionId,
    outcome,
    config,
    now
  );
  const cleared = clearReserveByDecisionId(state, options.decisionId, now);
  const next = { ...cleared };
  next.cooldowns = { ...cleared.cooldowns };
  next.lastActionAt = { ...cleared.lastActionAt };
  next.windows = { ...cleared.windows };
  next.reserves = [...(cleared.reserves ?? [])];
  const version = typeof cleared.stateVersion === "number" ? cleared.stateVersion : 0;
  next.stateVersion = version + 1;

  const hasHesitation =
    signals.hesitated || signals.ignored || signals.dismissed;

  if (hasHesitation) {
    const cooldownUntil = new Date(
      now.getTime() + config.cooldownHours[actionType] * 36e5
    ).toISOString();
    next.cooldowns[actionType] = cooldownUntil;
  }

  if ((outcome === "executed" || outcome === "downgraded") && !skipCost) {
    const pressure = decayedPressure(cleared, now, config.decayPerHour);
    const cost = config.costs[actionType];
    next.pressure = pressure + cost;
    next.pressureUpdatedAt = now.toISOString();
    next.lastAnyEscalationAt = now.toISOString();
    next.lastActionAt[actionType] = now.toISOString();
    incrementWindow(next, actionType, config.windowHours, now);
    incrementWindow(next, GLOBAL_KEY, config.windowHours, now);
  }

  return next;
};

const maxIso = (a: string | null | undefined, b: string | null | undefined): string | null => {
  if (!a) return b ?? null;
  if (!b) return a;
  return new Date(a) >= new Date(b) ? a : b;
};

/**
 * Merge identity journals: sum decayed pressure (capped), max cooldowns,
 * sum window counts (capped per type / global). Caller tombstones `from`.
 */
export const mergeUserStates = (
  from: GovernorUserState,
  to: GovernorUserState,
  now: Date,
  config: GovernorRulesConfig = defaultRulesConfig
): GovernorUserState => {
  const fromPruned = pruneExpiredReserves(from, now);
  const toPruned = pruneExpiredReserves(to, now);
  const fromPressure = decayedPressure(fromPruned, now, config.decayPerHour);
  const toPressure = decayedPressure(toPruned, now, config.decayPerHour);
  const pressure = Math.min(config.threshold, fromPressure + toPressure);

  const cooldowns: Record<string, string | null> = { ...toPruned.cooldowns };
  for (const [key, value] of Object.entries(fromPruned.cooldowns ?? {})) {
    cooldowns[key] = maxIso(cooldowns[key], value);
  }

  const lastActionAt: Record<string, string | null> = { ...toPruned.lastActionAt };
  for (const [key, value] of Object.entries(fromPruned.lastActionAt ?? {})) {
    lastActionAt[key] = maxIso(lastActionAt[key], value);
  }

  const windows: GovernorUserState["windows"] = {};
  const keys = new Set([
    ...Object.keys(fromPruned.windows ?? {}),
    ...Object.keys(toPruned.windows ?? {}),
    GLOBAL_KEY,
    ...Object.keys(config.typeCap)
  ]);
  for (const key of keys) {
    const fromWin = fromPruned.windows?.[key];
    const toWin = toPruned.windows?.[key];
    if (!fromWin && !toWin) continue;
    const windowStart =
      maxIso(fromWin?.windowStart, toWin?.windowStart) ?? now.toISOString();
    const rawCount = (fromWin?.count ?? 0) + (toWin?.count ?? 0);
    const cap =
      key === GLOBAL_KEY
        ? config.globalCap
        : (config.typeCap[key as ActionType] ?? rawCount);
    windows[key] = {
      windowStart,
      count: Math.min(cap, rawCount)
    };
  }

  const reserves = [
    ...(fromPruned.reserves ?? []),
    ...(toPruned.reserves ?? [])
  ];
  const toVersion = typeof toPruned.stateVersion === "number" ? toPruned.stateVersion : 0;

  return {
    cooldowns,
    lastActionAt,
    lastAnyEscalationAt: maxIso(fromPruned.lastAnyEscalationAt, toPruned.lastAnyEscalationAt),
    windows,
    pressure,
    pressureUpdatedAt: now.toISOString(),
    mergedInto: null,
    reserves,
    stateVersion: toVersion + 1
  };
};

/** Empty journal pointing at the surviving identity after merge. */
export const tombstoneState = (mergedInto: string): GovernorUserState => ({
  ...emptyState(),
  mergedInto
});
