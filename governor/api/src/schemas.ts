import { z } from "zod";
import { ACTION_TYPES } from "./types";

export const actionTypeSchema = z.enum(ACTION_TYPES);

export const checkSchema = z.object({
  userId: z.string().min(1),
  actionType: actionTypeSchema,
  surface: z.string().optional(),
  context: z.record(z.unknown()).optional()
});

export const recordSchema = z.object({
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
