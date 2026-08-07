import { z } from "zod";
import { ACTION_TYPE_SLUG_RE } from "./types";

export const actionTypeSchema = z
  .string()
  .min(1)
  .regex(ACTION_TYPE_SLUG_RE, {
    message:
      "actionType must be a lowercase slug (e.g. urgency, legal_notice)"
  });

export const checkSchema = z.object({
  userId: z.string().min(1),
  actionType: actionTypeSchema,
  surface: z.string().optional(),
  context: z.record(z.unknown()).optional(),
  tenantId: z.string().min(1).optional()
});

const blockReasonSchema = z
  .enum([
    "cooldown_active",
    "type_cap_reached",
    "global_cap_reached",
    "recent_escalation",
    "pressure_exceeded",
    "orphan_timeout"
  ])
  .optional();

export const recordSchema = z.object({
  decisionId: z.string().uuid(),
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

export const mergeSchema = z.object({
  fromUserId: z.string().min(1),
  toUserId: z.string().min(1),
  tenantId: z.string().min(1).optional()
});

export const releaseSchema = z.object({
  decisionId: z.string().uuid(),
  userId: z.string().min(1),
  tenantId: z.string().min(1).optional()
});
