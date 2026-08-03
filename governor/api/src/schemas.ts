import { z } from "zod";
import { ACTION_TYPES } from "./types";

export const actionTypeSchema = z.enum(ACTION_TYPES);

export const checkSchema = z.object({
  userId: z.string().min(1),
  actionType: actionTypeSchema,
  surface: z.string().optional(),
  context: z.record(z.unknown()).optional(),
  tenantId: z.string().min(1).optional()
});

const blockReasonSchema = z
  .enum(["cooldown_active", "type_cap_reached", "global_cap_reached", "recent_escalation"])
  .optional();

export const recordSchema = z.object({
  decisionId: z.string().uuid().optional(),
  userId: z.string().min(1),
  tenantId: z.string().min(1).optional(),
  actionType: actionTypeSchema,
  outcome: z.enum(["executed", "blocked", "downgraded"]),
  blockReason: blockReasonSchema,
  signals: z
    .object({
      hesitated: z.boolean().optional(),
      ignored: z.boolean().optional(),
      dismissed: z.boolean().optional()
    })
    .optional(),
  context: z.record(z.unknown()).optional()
});
