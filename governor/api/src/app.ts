import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { z } from "zod";
import { ACTION_TYPES, ActionType, OutcomeType } from "./types";
import { Storage } from "./storage/storage";
import { applyOutcome, emptyState, evaluateCheck } from "./rules/engine";

const actionTypeSchema = z.enum(ACTION_TYPES);

const checkSchema = z.object({
  userId: z.string().min(1),
  actionType: actionTypeSchema,
  surface: z.string().optional(),
  context: z.record(z.unknown()).optional()
});

const recordSchema = z.object({
  decisionId: z.string().uuid().optional(),
  userId: z.string().min(1),
  actionType: actionTypeSchema,
  outcome: z.enum(["executed", "blocked", "downgraded"]),
  signals: z
    .object({
      hesitated: z.boolean().optional(),
      ignored: z.boolean().optional(),
      dismissed: z.boolean().optional()
    })
    .optional(),
  context: z.record(z.unknown()).optional()
});

export const createApp = (storage: Storage) => {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.post("/v1/check", async (req, res) => {
    const parsed = checkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
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

    return res.json({
      allowed: decision.allowed,
      reason: decision.reason,
      decisionId,
      cooldownUntil: decision.cooldownUntil,
      suggestedActionType: decision.suggestedActionType
    });
  });

  app.post("/v1/record", async (req, res) => {
    const parsed = recordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
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

    return res.json({ ok: true });
  });

  return app;
};
