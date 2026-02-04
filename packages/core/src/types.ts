/**
 * @governor/core - Type definitions
 * 
 * Core type definitions for the Governor rules engine.
 * These types are shared across the SDK and API packages.
 */

// ============================================================================
// Action Types
// ============================================================================

export const ACTION_TYPES = [
  "urgency",
  "discount",
  "interruption",
  "reminder"
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

// ============================================================================
// Event Types
// ============================================================================

export type GovernorEventType =
  | "check"
  | "executed"
  | "blocked"
  | "downgraded";

export type DecisionReason =
  | "allowed"
  | "cooldown_active"
  | "type_cap_reached"
  | "global_cap_reached"
  | "recent_escalation";

export type OutcomeType = "executed" | "blocked" | "downgraded";

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * Event record for tracking decisions and outcomes
 */
export interface GovernorEvent {
  userId: string;
  actionType: ActionType;
  eventType: GovernorEventType;
  decisionId?: string;
  context?: Record<string, unknown>;
  createdAt?: string;
}

/**
 * User state tracking windows, cooldowns, and action history
 */
export interface GovernorUserState {
  cooldowns: Record<string, string | null>;
  lastActionAt: Record<string, string | null>;
  lastAnyEscalationAt: string | null;
  windows: Record<
    string,
    {
      windowStart: string;
      count: number;
    }
  >;
}

/**
 * Decision result from check evaluation
 */
export interface GovernorDecision {
  allowed: boolean;
  reason: DecisionReason;
  cooldownUntil?: string;
  suggestedActionType?: ActionType;
}

// ============================================================================
// Signals Interface
// ============================================================================

/**
 * Behavioral signals that affect outcome processing
 */
export interface GovernorSignals {
  hesitated?: boolean;
  ignored?: boolean;
  dismissed?: boolean;
}

// ============================================================================
// Permit Types
// ============================================================================

/**
 * Permit token payload (JWT claims)
 */
export interface GovernorPermit {
  userId: string;
  actionType: ActionType;
  surface?: string;
  tenetId: string;
  issuedAt: number;      // Unix timestamp
  expiresAt: number;     // Unix timestamp
  nonce: string;         // Single-use identifier
  policyVersion: string; // For audit trail
  decisionId: string;    // Link to decision log
}

/**
 * Permit verification result
 */
export interface PermitVerificationResult {
  valid: boolean;
  reason?: 'valid' | 'expired' | 'invalid_signature' | 'nonce_used' | 'nonce_not_found';
  permit?: GovernorPermit;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface CheckRequest {
  tenetId?: string;
  userId: string;
  actionType: ActionType;
  surface?: string;
  context?: Record<string, unknown>;
}

export interface CheckResponse {
  allowed: boolean;
  reason: DecisionReason;
  decisionId: string;
  permit?: string;  // JWT token when allowed
  cooldownUntil?: string;
  suggestedActionType?: ActionType;
}

export interface RecordRequest {
  decisionId?: string;
  userId: string;
  actionType: ActionType;
  outcome: OutcomeType;
  signals?: GovernorSignals;
  context?: Record<string, unknown>;
}

export interface RecordResponse {
  ok: boolean;
}

// ============================================================================
// Batch API Types
// ============================================================================

export interface CheckBatchRequest {
  tenetId?: string;
  userId: string;
  actions: ActionType[];
}

export interface CheckBatchResponse {
  decisions: Record<ActionType, GovernorDecision>;
}

// ============================================================================
// Decide API Types (Combined Endpoint)
// ============================================================================

export type DecideIntent = 'check' | 'check_and_reserve' | 'execute' | 'cancel';

export interface DecideRequest {
  tenetId?: string;
  userId: string;
  actionType: ActionType;
  intent: DecideIntent;
  reservationId?: string;
  signals?: GovernorSignals;
  context?: Record<string, unknown>;
}

export interface DecideResponse {
  decision: GovernorDecision;
  reserved: boolean;
  reservationId?: string;
}

// ============================================================================
// Tenet Configuration Types
// ============================================================================

export interface TenetRulesConfig {
  tenetId: string;
  rules: GovernorRulesConfig;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// Rules Configuration (re-exported from config)
// ============================================================================

export interface GovernorRulesConfig {
  cooldownHours: Record<ActionType, number>;
  typeCap: Record<ActionType, number>;
  globalCap: number;
  windowHours: number;
  stackingWindowMinutes: number;
}

// ============================================================================
// Webhook Types
// ============================================================================

export type WebhookEvent = 
  | 'decision.blocked'
  | 'state.cooldown_started'
  | 'state.cap_reached'
  | 'rules.updated';

export interface WebhookPayload {
  event: WebhookEvent;
  tenetId: string;
  userId?: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface WebhookSubscription {
  id: string;
  tenetId: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  active: boolean;
  createdAt: string;
}

// ============================================================================
// Real-time Stream Types
// ============================================================================

export interface DecisionStreamEvent {
  type: 'decision' | 'state' | 'error';
  tenetId: string;
  userId?: string;
  actionType?: ActionType;
  decision?: GovernorDecision;
  state?: Partial<GovernorUserState>;
  error?: string;
  timestamp: string;
}

export interface SubscribeOptions {
  tenetId: string;
  userId?: string;
  events?: ('decision' | 'state')[];
}

// ============================================================================
// Message Execution Types
// ============================================================================

/**
 * Message payload for execution
 */
export interface MessagePayload {
  to: string;
  from?: string;
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
}

/**
 * Execute message request with permit
 */
export interface ExecuteMessageRequest {
  permit: string;  // JWT from /api/check
  message: MessagePayload;
}

/**
 * Execution receipt returned on success
 */
export interface ExecutionReceipt {
  success: boolean;
  executionId: string;
  permitNonce: string;
  provider: string;
  providerMessageId?: string;
  executedAt: string;
  executionTimeMs: number;
}

/**
 * Execution error response
 */
export interface ExecutionError {
  success: false;
  error: string;
  details?: string;
}
