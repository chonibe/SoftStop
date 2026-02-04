/**
 * @governor/api - API Types
 * 
 * Cloudflare Workers environment and binding types.
 */

import { GovernorUserState, GovernorRulesConfig, WebhookSubscription } from '@governor/core';

// ============================================================================
// Cloudflare Environment Bindings
// ============================================================================

export interface Env {
  // KV Namespace for hot state
  GOVERNOR_KV: KVNamespace;
  
  // Durable Objects
  GOVERNOR_USER: DurableObjectNamespace;
  DECISION_STREAM: DurableObjectNamespace;
  PERMIT_NONCE: DurableObjectNamespace;
  
  // Queue for webhooks
  WEBHOOK_QUEUE: Queue<WebhookQueueMessage>;
  
  // Secrets
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  PERMIT_PRIVATE_KEY: string;
  PERMIT_PUBLIC_KEY: string;
  RESEND_API_KEY: string;
  
  // Optional API Key validation
  API_KEY_SECRET?: string;
}

// ============================================================================
// KV Key Patterns
// ============================================================================

export const KV_KEYS = {
  userState: (userId: string) => `state:${userId}`,
  tenetRules: (tenetId: string) => `rules:${tenetId}`,
  reservation: (reservationId: string) => `reservation:${reservationId}`,
  webhookSub: (subId: string) => `webhook:${subId}`,
  webhooksByTenet: (tenetId: string) => `webhooks:tenet:${tenetId}`
} as const;

// ============================================================================
// Durable Object Types
// ============================================================================

export interface DOAction {
  type: 'check' | 'record' | 'get_state' | 'set_state';
  actionType?: string;
  signals?: Record<string, boolean>;
  outcome?: string;
  state?: GovernorUserState;
}

export interface DOResponse {
  success: boolean;
  decision?: import('@governor/core').GovernorDecision;
  state?: GovernorUserState;
  error?: string;
}

// ============================================================================
// Webhook Queue Types
// ============================================================================

export interface WebhookQueueMessage {
  url: string;
  payload: {
    event: string;
    tenetId: string;
    userId?: string;
    data: Record<string, unknown>;
    timestamp: string;
  };
  secret: string;
  retryCount?: number;
}

// ============================================================================
// Reservation Types
// ============================================================================

export interface Reservation {
  id: string;
  userId: string;
  actionType: string;
  tenetId: string;
  createdAt: string;
  expiresAt: string;
}

// ============================================================================
// Request Context
// ============================================================================

export interface RequestContext {
  env: Env;
  request: Request;
  tenetId: string;
  apiKey?: string;
}

// ============================================================================
// API Error Types
// ============================================================================

export class APIError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'APIError';
  }

  toResponse(): Response {
    return Response.json(
      {
        error: this.message,
        code: this.code
      },
      { status: this.status }
    );
  }
}

export const createError = (status: number, message: string, code?: string): APIError => {
  return new APIError(status, message, code);
};

// ============================================================================
// Response Helpers
// ============================================================================

export const jsonResponse = <T>(data: T, status = 200): Response => {
  return Response.json(data, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
};

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};
