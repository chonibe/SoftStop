import { createClient } from "@supabase/supabase-js";
import { GovernorEvent, GovernorUserState } from "../types";
import { Storage } from "./storage";

export class SupabaseStorage implements Storage {
  private client;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false }
    });
  }

  async getUserState(userId: string): Promise<GovernorUserState | null> {
    const { data, error } = await this.client
      .from("governor_user_state")
      .select("state")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to read user state: ${error.message}`);
    }

    if (!data?.state) {
      return null;
    }

    return data.state as GovernorUserState;
  }

  async upsertUserState(
    userId: string,
    state: GovernorUserState
  ): Promise<void> {
    const { error } = await this.client
      .from("governor_user_state")
      .upsert(
        {
          user_id: userId,
          state,
          updated_at: new Date().toISOString()
        },
        { onConflict: "user_id" }
      );

    if (error) {
      throw new Error(`Failed to upsert user state: ${error.message}`);
    }
  }

  async insertEvent(event: GovernorEvent): Promise<void> {
    const { error } = await this.client.from("governor_events").insert({
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
}
