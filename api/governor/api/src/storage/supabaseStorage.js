"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseStorage = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
class SupabaseStorage {
    constructor(url, serviceRoleKey) {
        this.client = (0, supabase_js_1.createClient)(url, serviceRoleKey, {
            auth: { persistSession: false }
        });
    }
    async getUserState(userId) {
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
        return data.state;
    }
    async upsertUserState(userId, state) {
        const { error } = await this.client
            .from("governor_user_state")
            .upsert({
            user_id: userId,
            state,
            updated_at: new Date().toISOString()
        }, { onConflict: "user_id" });
        if (error) {
            throw new Error(`Failed to upsert user state: ${error.message}`);
        }
    }
    async insertEvent(event) {
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
exports.SupabaseStorage = SupabaseStorage;
