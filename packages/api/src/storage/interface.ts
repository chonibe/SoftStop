/**
 * @governor/api - Storage Interface
 * 
 * Abstract storage interface for Governor API.
 * Implemented by EdgeKVStorage and SupabaseStorage.
 */

import {
  GovernorEvent,
  GovernorUserState,
  GovernorRulesConfig,
  WebhookSubscription
} from '@governor/core';
import { Reservation } from '../types';

export interface Storage {
  // User State
  getUserState(userId: string): Promise<GovernorUserState | null>;
  setUserState(userId: string, state: GovernorUserState): Promise<void>;
  upsertUserState(userId: string, state: GovernorUserState): Promise<void>;
  
  // Batch State Operations
  getUserStates(userIds: string[]): Promise<Record<string, GovernorUserState>>;
  setUserStates(states: Array<{ userId: string; state: GovernorUserState }>): Promise<void>;
  
  // Events
  insertEvent(event: GovernorEvent): Promise<void>;
  
  // Tenet Rules
  getTenetRules(tenetId: string): Promise<GovernorRulesConfig | null>;
  upsertTenetRules(tenetId: string, rules: GovernorRulesConfig): Promise<void>;
  
  // Reservations
  createReservation(
    userId: string,
    actionType: string,
    tenetId: string,
    ttlSeconds: number
  ): Promise<string>;
  getReservation(reservationId: string): Promise<Reservation | null>;
  deleteReservation(reservationId: string): Promise<void>;
  
  // Webhooks
  getWebhookSubscriptions(tenetId: string, event?: string): Promise<WebhookSubscription[]>;
  createWebhookSubscription(subscription: Omit<WebhookSubscription, 'id' | 'createdAt'>): Promise<WebhookSubscription>;
  updateWebhookSubscription(id: string, updates: Partial<WebhookSubscription>): Promise<WebhookSubscription | null>;
  deleteWebhookSubscription(id: string): Promise<void>;
  
  // Permit Execution
  markPermitConsumed(nonce: string): Promise<void>;
  
  // Execution Logging
  logExecution(execution: {
    permitNonce: string;
    userId: string;
    actionType: string;
    surface?: string;
    outcome: 'executed' | 'rejected' | 'failed';
    gateway?: string;
    executionTimeMs?: number;
    error?: string;
    context?: Record<string, unknown>;
  }): Promise<void>;
}
