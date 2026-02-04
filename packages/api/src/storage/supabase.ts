/**
 * @governor/api - Supabase Storage
 * 
 * Durable storage backend for Governor state and events.
 * Used for persistence and as fallback when edge cache misses.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  GovernorEvent,
  GovernorUserState,
  GovernorRulesConfig,
  WebhookSubscription
} from '@governor/core';
import { Storage } from './interface';
import { Reservation } from '../types';

export class SupabaseStorage implements Storage {
  private client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false }
    });
  }

  // ============================================================================
  // User State
  // ============================================================================

  async getUserState(userId: string): Promise<GovernorUserState | null> {
    const { data, error } = await this.client
      .from('governor_user_state')
      .select('state')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to read user state: ${error.message}`);
    }

    return data?.state as GovernorUserState | null;
  }

  async setUserState(userId: string, state: GovernorUserState): Promise<void> {
    return this.upsertUserState(userId, state);
  }

  async upsertUserState(userId: string, state: GovernorUserState): Promise<void> {
    const { error } = await this.client
      .from('governor_user_state')
      .upsert(
        {
          user_id: userId,
          state,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      throw new Error(`Failed to upsert user state: ${error.message}`);
    }
  }

  async getUserStates(userIds: string[]): Promise<Record<string, GovernorUserState>> {
    const { data, error } = await this.client
      .from('governor_user_state')
      .select('user_id, state')
      .in('user_id', userIds);

    if (error) {
      throw new Error(`Failed to batch read user states: ${error.message}`);
    }

    const result: Record<string, GovernorUserState> = {};
    for (const row of data ?? []) {
      result[row.user_id] = row.state as GovernorUserState;
    }
    return result;
  }

  async setUserStates(states: Array<{ userId: string; state: GovernorUserState }>): Promise<void> {
    const rows = states.map(({ userId, state }) => ({
      user_id: userId,
      state,
      updated_at: new Date().toISOString()
    }));

    const { error } = await this.client
      .from('governor_user_state')
      .upsert(rows, { onConflict: 'user_id' });

    if (error) {
      throw new Error(`Failed to batch upsert user states: ${error.message}`);
    }
  }

  // ============================================================================
  // Events
  // ============================================================================

  async insertEvent(event: GovernorEvent): Promise<void> {
    const { error } = await this.client.from('governor_events').insert({
      user_id: event.userId,
      action_type: event.actionType,
      event_type: event.eventType,
      decision_id: event.decisionId ?? null,
      context: event.context ?? null,
      created_at: event.createdAt ?? new Date().toISOString()
    });

    if (error) {
      throw new Error(`Failed to insert event: ${error.message}`);
    }
  }

  // ============================================================================
  // Tenet Rules
  // ============================================================================

  async getTenetRules(tenetId: string): Promise<GovernorRulesConfig | null> {
    const { data, error } = await this.client
      .from('governor_tenet_rules')
      .select('rules')
      .eq('tenet_id', tenetId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to read tenet rules: ${error.message}`);
    }

    return data?.rules as GovernorRulesConfig | null;
  }

  async upsertTenetRules(tenetId: string, rules: GovernorRulesConfig): Promise<void> {
    const { error } = await this.client
      .from('governor_tenet_rules')
      .upsert(
        {
          tenet_id: tenetId,
          rules,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'tenet_id' }
      );

    if (error) {
      throw new Error(`Failed to upsert tenet rules: ${error.message}`);
    }
  }

  // ============================================================================
  // Reservations (not stored in Supabase - KV only with TTL)
  // ============================================================================

  async createReservation(): Promise<string> {
    throw new Error('Reservations are handled by KV storage only');
  }

  async getReservation(): Promise<Reservation | null> {
    throw new Error('Reservations are handled by KV storage only');
  }

  async deleteReservation(): Promise<void> {
    throw new Error('Reservations are handled by KV storage only');
  }

  // ============================================================================
  // Webhooks
  // ============================================================================

  async getWebhookSubscriptions(tenetId: string, event?: string): Promise<WebhookSubscription[]> {
    let query = this.client
      .from('governor_webhook_subscriptions')
      .select('*')
      .eq('tenet_id', tenetId)
      .eq('active', true);

    if (event) {
      query = query.contains('events', [event]);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to read webhook subscriptions: ${error.message}`);
    }

    return (data ?? []).map(row => ({
      id: row.id,
      tenetId: row.tenet_id,
      url: row.url,
      events: row.events,
      secret: row.secret,
      active: row.active,
      createdAt: row.created_at
    }));
  }

  async createWebhookSubscription(
    subscription: Omit<WebhookSubscription, 'id' | 'createdAt'>
  ): Promise<WebhookSubscription> {
    const { data, error } = await this.client
      .from('governor_webhook_subscriptions')
      .insert({
        tenet_id: subscription.tenetId,
        url: subscription.url,
        events: subscription.events,
        secret: subscription.secret,
        active: subscription.active
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create webhook subscription: ${error.message}`);
    }

    return {
      id: data.id,
      tenetId: data.tenet_id,
      url: data.url,
      events: data.events,
      secret: data.secret,
      active: data.active,
      createdAt: data.created_at
    };
  }

  async updateWebhookSubscription(
    id: string,
    updates: Partial<WebhookSubscription>
  ): Promise<WebhookSubscription | null> {
    const updateData: Record<string, unknown> = {};
    if (updates.url !== undefined) updateData.url = updates.url;
    if (updates.events !== undefined) updateData.events = updates.events;
    if (updates.active !== undefined) updateData.active = updates.active;

    const { data, error } = await this.client
      .from('governor_webhook_subscriptions')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update webhook subscription: ${error.message}`);
    }

    if (!data) return null;

    return {
      id: data.id,
      tenetId: data.tenet_id,
      url: data.url,
      events: data.events,
      secret: data.secret,
      active: data.active,
      createdAt: data.created_at
    };
  }

  async deleteWebhookSubscription(id: string): Promise<void> {
    const { error } = await this.client
      .from('governor_webhook_subscriptions')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete webhook subscription: ${error.message}`);
    }
  }

  // ============================================================================
  // Permits
  // ============================================================================

  async insertPermit(permit: {
    nonce: string;
    userId: string;
    actionType: string;
    tenetId: string;
    issuedAt: Date;
    expiresAt: Date;
    decisionId: string;
    policyVersion: string;
    context?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.client
      .from('governor_permits')
      .insert({
        nonce: permit.nonce,
        user_id: permit.userId,
        action_type: permit.actionType,
        tenet_id: permit.tenetId,
        issued_at: permit.issuedAt.toISOString(),
        expires_at: permit.expiresAt.toISOString(),
        decision_id: permit.decisionId,
        policy_version: permit.policyVersion,
        context: permit.context
      });

    if (error) {
      console.error('Failed to insert permit:', error);
      throw error;
    }
  }

  async markPermitConsumed(nonce: string): Promise<void> {
    const { error } = await this.client
      .from('governor_permits')
      .update({ consumed_at: new Date().toISOString() })
      .eq('nonce', nonce);

    if (error) {
      console.error('Failed to mark permit consumed:', error);
    }
  }

  async logExecution(execution: {
    permitNonce: string;
    userId: string;
    actionType: string;
    surface?: string;
    outcome: 'executed' | 'rejected' | 'failed';
    gateway?: string;
    executionTimeMs?: number;
    error?: string;
    context?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.client
      .from('governor_execution_log')
      .insert({
        permit_nonce: execution.permitNonce,
        user_id: execution.userId,
        action_type: execution.actionType,
        surface: execution.surface,
        outcome: execution.outcome,
        gateway: execution.gateway,
        execution_time_ms: execution.executionTimeMs,
        error: execution.error,
        context: execution.context
      });

    if (error) {
      console.error('Failed to log execution:', error);
      throw error;
    }
  }
}
