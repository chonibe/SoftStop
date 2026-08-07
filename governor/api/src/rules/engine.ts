import { ActionType, GovernorDecision, GovernorUserState } from "../types";
import { defaultRulesConfig, GovernorRulesConfig } from "./config";

const GLOBAL_KEY = "global";

export const emptyState = (): GovernorUserState => ({
  cooldowns: {},
  lastActionAt: {},
  lastAnyEscalationAt: null,
  windows: {},
  pressure: 0,
  pressureUpdatedAt: null
});

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
  const pressure = decayedPressure(state, now, config.decayPerHour);
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

  const cooldownUntil = state.cooldowns[actionType];
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
    state,
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
    state,
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

  if (state.lastAnyEscalationAt) {
    const diffMinutes =
      (now.getTime() - new Date(state.lastAnyEscalationAt).getTime()) / 6e4;
    if (
      diffMinutes < config.stackingWindowMinutes &&
      (actionType === "urgency" || actionType === "interruption")
    ) {
      return attach({
        allowed: false,
        reason: "recent_escalation",
        retryAfterMs: retryAfterFromStacking(
          state.lastAnyEscalationAt,
          now,
          config.stackingWindowMinutes
        ),
        ...reminderFallback()
      });
    }
  }

  return attach({ allowed: true, reason: "allowed" });
};

export const applyOutcome = (
  state: GovernorUserState,
  actionType: ActionType,
  outcome: "executed" | "downgraded" | "blocked",
  signals: { hesitated?: boolean; ignored?: boolean; dismissed?: boolean } = {},
  now: Date,
  config: GovernorRulesConfig = defaultRulesConfig
): GovernorUserState => {
  const next = { ...state };
  next.cooldowns = { ...state.cooldowns };
  next.lastActionAt = { ...state.lastActionAt };
  next.windows = { ...state.windows };

  const hasHesitation =
    signals.hesitated || signals.ignored || signals.dismissed;

  if (hasHesitation) {
    const cooldownUntil = new Date(
      now.getTime() + config.cooldownHours[actionType] * 36e5
    ).toISOString();
    next.cooldowns[actionType] = cooldownUntil;
  }

  if (outcome === "executed" || outcome === "downgraded") {
    const pressure = decayedPressure(state, now, config.decayPerHour);
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
  const fromPressure = decayedPressure(from, now, config.decayPerHour);
  const toPressure = decayedPressure(to, now, config.decayPerHour);
  const pressure = Math.min(config.threshold, fromPressure + toPressure);

  const cooldowns: Record<string, string | null> = { ...to.cooldowns };
  for (const [key, value] of Object.entries(from.cooldowns ?? {})) {
    cooldowns[key] = maxIso(cooldowns[key], value);
  }

  const lastActionAt: Record<string, string | null> = { ...to.lastActionAt };
  for (const [key, value] of Object.entries(from.lastActionAt ?? {})) {
    lastActionAt[key] = maxIso(lastActionAt[key], value);
  }

  const windows: GovernorUserState["windows"] = {};
  const keys = new Set([
    ...Object.keys(from.windows ?? {}),
    ...Object.keys(to.windows ?? {}),
    GLOBAL_KEY,
    ...Object.keys(config.typeCap)
  ]);
  for (const key of keys) {
    const fromWin = from.windows?.[key];
    const toWin = to.windows?.[key];
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

  return {
    cooldowns,
    lastActionAt,
    lastAnyEscalationAt: maxIso(from.lastAnyEscalationAt, to.lastAnyEscalationAt),
    windows,
    pressure,
    pressureUpdatedAt: now.toISOString(),
    mergedInto: null
  };
};

/** Empty journal pointing at the surviving identity after merge. */
export const tombstoneState = (mergedInto: string): GovernorUserState => ({
  ...emptyState(),
  mergedInto
});
