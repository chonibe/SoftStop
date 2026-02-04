/**
 * @governor/core
 * 
 * Core rules engine and types for the Governor permission system.
 * 
 * This package provides:
 * - Type definitions shared across SDK and API
 * - Rules engine for evaluating permission checks
 * - Configuration schemas and validation
 * 
 * @example
 * ```typescript
 * import { 
 *   evaluateCheck, 
 *   emptyState, 
 *   defaultRulesConfig 
 * } from '@governor/core';
 * 
 * const state = emptyState();
 * const decision = evaluateCheck(state, 'urgency', new Date());
 * 
 * if (decision.allowed) {
 *   console.log('Action allowed');
 * } else {
 *   console.log(`Blocked: ${decision.reason}`);
 * }
 * ```
 * 
 * @packageDocumentation
 */

// ============================================================================
// Types
// ============================================================================

export {
  // Constants
  ACTION_TYPES,
  
  // Core Types
  type ActionType,
  type GovernorEventType,
  type DecisionReason,
  type OutcomeType,
  
  // Interfaces
  type GovernorEvent,
  type GovernorUserState,
  type GovernorDecision,
  type GovernorSignals,
  type GovernorRulesConfig,
  
  // Permit Types
  type GovernorPermit,
  type PermitVerificationResult,
  
  // API Types
  type CheckRequest,
  type CheckResponse,
  type RecordRequest,
  type RecordResponse,
  type CheckBatchRequest,
  type CheckBatchResponse,
  type DecideIntent,
  type DecideRequest,
  type DecideResponse,
  type TenetRulesConfig,
  
  // Webhook Types
  type WebhookEvent,
  type WebhookPayload,
  type WebhookSubscription,
  
  // Stream Types
  type DecisionStreamEvent,
  type SubscribeOptions,
  
  // Message Execution Types
  type MessagePayload,
  type ExecuteMessageRequest,
  type ExecutionReceipt,
  type ExecutionError
} from './types';

// ============================================================================
// Rules Engine
// ============================================================================

export {
  // State Management
  emptyState,
  cloneState,
  
  // Core Functions
  evaluateCheck,
  applyOutcome,
  evaluateCheckBatch,
  
  // Query Functions
  getRemainingQuota,
  getGlobalRemainingQuota,
  getActiveCooldowns
} from './rules/engine';

// ============================================================================
// Configuration
// ============================================================================

export {
  defaultRulesConfig,
  mergeWithDefaults,
  validateRulesConfig
} from './rules/config';

// ============================================================================
// Schemas (Zod)
// ============================================================================

export {
  actionTypeSchema,
  rulesConfigSchema,
  partialRulesConfigSchema,
  checkRequestSchema,
  recordRequestSchema,
  checkBatchRequestSchema,
  decideRequestSchema,
  webhookEventSchema,
  webhookSubscriptionCreateSchema,
  webhookSubscriptionUpdateSchema,
  userStateSchema,
  decisionSchema,
  messagePayloadSchema,
  executeMessageSchema
} from './rules/schema';

// ============================================================================
// Permit Signing
// ============================================================================

export {
  mintPermit,
  verifyPermit,
  type SigningConfig
} from './permit';
