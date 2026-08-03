import type { DecisionListOptions, DecisionRecord, GovernorStorage } from "../interface";

export interface SupabaseGovernorStorageOptions {
  url: string;
  serviceRoleKey: string;
}

const windowSeconds = (window: "minute" | "hourly" | "daily"): number => {
  if (window === "minute") return 60;
  if (window === "hourly") return 60 * 60;
  return 24 * 60 * 60;
};

export class SupabaseGovernorStorage implements GovernorStorage {
  private readonly client;

  constructor(options: SupabaseGovernorStorageOptions) {
    this.client = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(options.url, options.serviceRoleKey, {
        auth: { persistSession: false }
      })
    );
  }

  async recordDecision(record: DecisionRecord): Promise<void> {
    const client = await this.client;
    const { request, decision } = record;
    const { error } = await client.from("governor_decisions").insert({
      id: record.id,
      tenant_id: request.context.tenantId,
      actor_id: request.actor.id,
      actor_type: request.actor.type ?? null,
      tool_server: request.tool.server ?? null,
      tool_name: request.tool.name,
      tool_risk: request.tool.risk ?? null,
      action: decision.action,
      allowed: decision.allowed,
      reason: decision.reason,
      policy: decision.policy ?? null,
      escalation_id: decision.escalationId ?? null,
      request,
      decision,
      created_at: record.createdAt
    });

    if (error) {
      throw new Error(`Failed to record Governor decision: ${error.message}`);
    }

    if (decision.escalationId) {
      await this.recordApproval(decision.escalationId, "pending", request.context.tenantId, {
        decisionId: record.id,
        policy: decision.policy
      });
    }
  }

  async listDecisions(options: DecisionListOptions): Promise<DecisionRecord[]> {
    const client = await this.client;
    const { data, error } = await client
      .from("governor_decisions")
      .select("id, request, decision, created_at")
      .eq("tenant_id", options.tenantId)
      .order("created_at", { ascending: false })
      .limit(options.limit ?? 100);

    if (error) {
      throw new Error(`Failed to list Governor decisions: ${error.message}`);
    }

    return (data ?? []).map((row: {
      id: string;
      request: DecisionRecord["request"];
      decision: DecisionRecord["decision"];
      created_at: string;
    }) => ({
      id: row.id as string,
      request: row.request as DecisionRecord["request"],
      decision: row.decision as DecisionRecord["decision"],
      createdAt: row.created_at as string
    }));
  }

  async incrementLimit(
    key: string,
    window: "minute" | "hourly" | "daily",
    limit: number
  ): Promise<{ allowed: boolean; count: number; retryAfter?: string }> {
    const client = await this.client;
    const { data, error } = await client.rpc("governor_increment_counter", {
      counter_key: key,
      window_seconds: windowSeconds(window),
      max_count: limit
    });

    if (error) {
      throw new Error(`Failed to increment Governor counter: ${error.message}`);
    }

    const row = (Array.isArray(data) ? data[0] : data) as {
      allowed: boolean;
      current_count: number;
      retry_after?: string;
    };
    return {
      allowed: Boolean(row.allowed),
      count: Number(row.current_count),
      retryAfter: row.retry_after ?? undefined
    };
  }

  async getApproval(
    escalationId: string,
    tenantId?: string
  ): Promise<"pending" | "approved" | "denied" | "expired" | null> {
    const client = await this.client;
    let query = client
      .from("governor_approvals")
      .select("status")
      .eq("escalation_id", escalationId);

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data?.status) return null;
    return data.status as "pending" | "approved" | "denied" | "expired";
  }

  async recordApproval(
    escalationId: string,
    status: "pending" | "approved" | "denied" | "expired",
    tenantId = "default",
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const client = await this.client;
    const { error } = await client.from("governor_approvals").upsert(
      {
        escalation_id: escalationId,
        tenant_id: tenantId,
        status,
        metadata: metadata ?? null,
        updated_at: new Date().toISOString()
      },
      { onConflict: "escalation_id" }
    );

    if (error) {
      throw new Error(`Failed to record Governor approval: ${error.message}`);
    }
  }
}
