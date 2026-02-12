import { randomUUID } from "crypto";
import { checkSchema, recordSchema } from "./schemas";
import { Storage } from "./storage/storage";
import { applyOutcome, emptyState, evaluateCheck } from "./rules/engine";
import { OutcomeType } from "./types";

export const handleCheck = async (
  storage: Storage,
  payload: unknown
) => {
  const parsed = checkSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 400, body: { error: parsed.error.flatten() } };
  }

  const { userId, actionType, surface, context } = parsed.data;
  const now = new Date();
  const state = (await storage.getUserState(userId)) ?? emptyState();
  const decision = evaluateCheck(state, actionType, now);
  const decisionId = randomUUID();

  await storage.insertEvent({
    userId,
    actionType,
    eventType: "check",
    decisionId,
    context: context ? { surface, ...context } : { surface }
  });

  return {
    status: 200,
    body: {
      allowed: decision.allowed,
      reason: decision.reason,
      decisionId,
      cooldownUntil: decision.cooldownUntil,
      suggestedActionType: decision.suggestedActionType
    }
  };
};

export const handleRecord = async (
  storage: Storage,
  payload: unknown
) => {
  const parsed = recordSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 400, body: { error: parsed.error.flatten() } };
  }

  const { decisionId, userId, actionType, outcome, signals, context } =
    parsed.data;
  const now = new Date();
  const state = (await storage.getUserState(userId)) ?? emptyState();
  const nextState = applyOutcome(
    state,
    actionType,
    outcome as OutcomeType,
    signals,
    now
  );

  await storage.insertEvent({
    userId,
    actionType,
    eventType: outcome,
    decisionId,
    context: context ? { ...context, signals } : { signals }
  });

  await storage.upsertUserState(userId, nextState);

  return { status: 200, body: { ok: true } };
};
