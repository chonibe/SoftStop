import type {
  ActionType,
  GovernorRulesConfig,
  GovernorUserState,
  PressureDecision
} from "./types";
import { defaultRulesConfig } from "./types";

const GLOBAL_KEY = "global";

export const emptyState = (): GovernorUserState => ({
  cooldowns: {},
  lastActionAt: {},
  lastAnyEscalationAt: null,
  windows: {}
});

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

export const evaluateCheck = (
  state: GovernorUserState,
  actionType: ActionType,
  now: Date,
  config: GovernorRulesConfig = defaultRulesConfig
): PressureDecision => {
  const cooldownUntil = state.cooldowns[actionType];
  if (cooldownUntil && new Date(cooldownUntil) > now) {
    return {
      allowed: false,
      reason: "cooldown_active",
      cooldownUntil,
      suggestedActionType:
        actionType === "urgency" || actionType === "interruption"
          ? "reminder"
          : undefined
    };
  }

  const typeCount = getWindowCount(state, actionType, config.windowHours, now);
  if (typeCount >= config.typeCap[actionType]) {
    return {
      allowed: false,
      reason: "type_cap_reached",
      suggestedActionType:
        actionType === "urgency" || actionType === "interruption"
          ? "reminder"
          : undefined
    };
  }

  const globalCount = getWindowCount(state, GLOBAL_KEY, config.windowHours, now);
  if (globalCount >= config.globalCap) {
    return {
      allowed: false,
      reason: "global_cap_reached"
    };
  }

  if (state.lastAnyEscalationAt) {
    const diffMinutes =
      (now.getTime() - new Date(state.lastAnyEscalationAt).getTime()) / 6e4;
    if (
      diffMinutes < config.stackingWindowMinutes &&
      (actionType === "urgency" || actionType === "interruption")
    ) {
      return {
        allowed: false,
        reason: "recent_escalation",
        suggestedActionType: "reminder"
      };
    }
  }

  return { allowed: true, reason: "allowed" };
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
    next.lastAnyEscalationAt = now.toISOString();
    next.lastActionAt[actionType] = now.toISOString();
    incrementWindow(next, actionType, config.windowHours, now);
    incrementWindow(next, GLOBAL_KEY, config.windowHours, now);
  }

  return next;
};
