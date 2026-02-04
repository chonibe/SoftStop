/**
 * @governor/core - Rules Schema (Zod Validation)
 * 
 * Zod schemas for validating rules configuration.
 * Used for API input validation and type-safe parsing.
 */

import { z } from 'zod';
import { ACTION_TYPES } from '../types';

// ============================================================================
// Base Schemas
// ============================================================================

export const actionTypeSchema = z.enum(ACTION_TYPES);

export const actionTypeRecordSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.object({
    urgency: valueSchema,
    discount: valueSchema,
    interruption: valueSchema,
    reminder: valueSchema
  });

// ============================================================================
// Rules Configuration Schema
// ============================================================================

export const rulesConfigSchema = z.object({
  cooldownHours: actionTypeRecordSchema(z.number().nonnegative()),
  typeCap: actionTypeRecordSchema(z.number().nonnegative().int()),
  globalCap: z.number().nonnegative().int(),
  windowHours: z.number().positive(),
  stackingWindowMinutes: z.number().nonnegative()
});

export type RulesConfigSchema = z.infer<typeof rulesConfigSchema>;

/**
 * Partial rules config for PATCH operations
 */
export const partialRulesConfigSchema = z.object({
  cooldownHours: z.object({
    urgency: z.number().nonnegative().optional(),
    discount: z.number().nonnegative().optional(),
    interruption: z.number().nonnegative().optional(),
    reminder: z.number().nonnegative().optional()
  }).optional(),
  typeCap: z.object({
    urgency: z.number().nonnegative().int().optional(),
    discount: z.number().nonnegative().int().optional(),
    interruption: z.number().nonnegative().int().optional(),
    reminder: z.number().nonnegative().int().optional()
  }).optional(),
  globalCap: z.number().nonnegative().int().optional(),
  windowHours: z.number().positive().optional(),
  stackingWindowMinutes: z.number().nonnegative().optional()
});

export type PartialRulesConfigSchema = z.infer<typeof partialRulesConfigSchema>;

// ============================================================================
// API Request Schemas
// ============================================================================

export const checkRequestSchema = z.object({
  tenetId: z.string().optional(),
  userId: z.string().min(1),
  actionType: actionTypeSchema,
  surface: z.string().optional(),
  context: z.record(z.unknown()).optional()
});

export const recordRequestSchema = z.object({
  decisionId: z.string().uuid().optional(),
  userId: z.string().min(1),
  actionType: actionTypeSchema,
  outcome: z.enum(['executed', 'blocked', 'downgraded']),
  signals: z.object({
    hesitated: z.boolean().optional(),
    ignored: z.boolean().optional(),
    dismissed: z.boolean().optional()
  }).optional(),
  context: z.record(z.unknown()).optional()
});

export const checkBatchRequestSchema = z.object({
  tenetId: z.string().optional(),
  userId: z.string().min(1),
  actions: z.array(actionTypeSchema).min(1).max(10)
});

export const decideRequestSchema = z.object({
  tenetId: z.string().optional(),
  userId: z.string().min(1),
  actionType: actionTypeSchema,
  intent: z.enum(['check', 'check_and_reserve', 'execute', 'cancel']),
  reservationId: z.string().optional(),
  signals: z.object({
    hesitated: z.boolean().optional(),
    ignored: z.boolean().optional(),
    dismissed: z.boolean().optional()
  }).optional(),
  context: z.record(z.unknown()).optional()
});

// ============================================================================
// Webhook Schemas
// ============================================================================

export const webhookEventSchema = z.enum([
  'decision.blocked',
  'state.cooldown_started',
  'state.cap_reached',
  'rules.updated'
]);

export const webhookSubscriptionCreateSchema = z.object({
  url: z.string().url(),
  events: z.array(webhookEventSchema).min(1),
  secret: z.string().min(16).optional()
});

export const webhookSubscriptionUpdateSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(webhookEventSchema).min(1).optional(),
  active: z.boolean().optional()
});

// ============================================================================
// State Schemas
// ============================================================================

export const userStateSchema = z.object({
  cooldowns: z.record(z.string().nullable()),
  lastActionAt: z.record(z.string().nullable()),
  lastAnyEscalationAt: z.string().nullable(),
  windows: z.record(z.object({
    windowStart: z.string(),
    count: z.number().int().nonnegative()
  }))
});

// ============================================================================
// Decision Schema
// ============================================================================

export const decisionSchema = z.object({
  allowed: z.boolean(),
  reason: z.enum([
    'allowed',
    'cooldown_active',
    'type_cap_reached',
    'global_cap_reached',
    'recent_escalation'
  ]),
  cooldownUntil: z.string().optional(),
  suggestedActionType: actionTypeSchema.optional()
});

// ============================================================================
// Export Types
// ============================================================================

export type CheckRequest = z.infer<typeof checkRequestSchema>;
export type RecordRequest = z.infer<typeof recordRequestSchema>;
export type CheckBatchRequest = z.infer<typeof checkBatchRequestSchema>;
export type DecideRequest = z.infer<typeof decideRequestSchema>;
export type WebhookSubscriptionCreate = z.infer<typeof webhookSubscriptionCreateSchema>;
export type WebhookSubscriptionUpdate = z.infer<typeof webhookSubscriptionUpdateSchema>;

// ============================================================================
// Message Execution Schemas
// ============================================================================

export const messagePayloadSchema = z.object({
  to: z.string().email(),
  from: z.string().email().optional(),
  subject: z.string().min(1).max(200),
  text: z.string().optional(),
  html: z.string().optional(),
  replyTo: z.string().email().optional()
}).refine(data => data.text || data.html, {
  message: "Either text or html must be provided"
});

export const executeMessageSchema = z.object({
  permit: z.string().min(1),
  message: messagePayloadSchema
});

export type MessagePayload = z.infer<typeof messagePayloadSchema>;
export type ExecuteMessageRequest = z.infer<typeof executeMessageSchema>;
