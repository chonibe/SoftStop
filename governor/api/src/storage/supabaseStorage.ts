import { createHash, randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { GovernorEvent, GovernorUserState } from "../types";
import { DecisionLogEntry, HealthMetrics, ReportMetrics, Storage } from "./storage";

function hashKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export class SupabaseStorage implements Storage {
  private client;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false }
    });
  }

  async getUserState(userId: string, tenantId = "default"): Promise<GovernorUserState | null> {
    const { data, error } = await this.client
      .from("governor_user_state")
      .select("state")
      .eq("tenant_id", tenantId)
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
    state: GovernorUserState,
    tenantId = "default"
  ): Promise<void> {
    const { error } = await this.client
      .from("governor_user_state")
      .upsert(
        {
          tenant_id: tenantId,
          user_id: userId,
          state,
          updated_at: new Date().toISOString()
        },
        { onConflict: "tenant_id,user_id" }
      );

    if (error) {
      throw new Error(`Failed to upsert user state: ${error.message}`);
    }
  }

  /**
   * OCC via read-compare-write on state.stateVersion in the JSON document.
   * Concurrent writers may still race between read and write; callers should
   * retry evaluate on conflict. Prefer a DB column/RPC for multi-region later.
   */
  async tryUpsertUserState(
    userId: string,
    state: GovernorUserState,
    expectedVersion: number,
    tenantId = "default"
  ): Promise<"ok" | "conflict"> {
    const current = await this.getUserState(userId, tenantId);
    const currentVersion =
      current && typeof current.stateVersion === "number" ? current.stateVersion : 0;
    if (currentVersion !== expectedVersion) {
      return "conflict";
    }

    if (!current) {
      const { error } = await this.client.from("governor_user_state").insert({
        tenant_id: tenantId,
        user_id: userId,
        state,
        updated_at: new Date().toISOString()
      });
      if (error) {
        // Unique violation → another writer inserted first
        if (error.code === "23505") return "conflict";
        throw new Error(`Failed to insert user state: ${error.message}`);
      }
      return "ok";
    }

    // Conditional update: only if JSON stateVersion still matches expected.
    const { data, error } = await this.client
      .from("governor_user_state")
      .update({
        state,
        updated_at: new Date().toISOString()
      })
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .filter("state->>stateVersion", "eq", String(expectedVersion))
      .select("user_id");

    if (error) {
      throw new Error(`Failed to CAS upsert user state: ${error.message}`);
    }
    if (!data || data.length === 0) {
      // Row may lack stateVersion key (legacy) — fall back to eq on missing as 0
      if (expectedVersion === 0) {
        const { data: legacyData, error: legacyError } = await this.client
          .from("governor_user_state")
          .update({
            state,
            updated_at: new Date().toISOString()
          })
          .eq("tenant_id", tenantId)
          .eq("user_id", userId)
          .is("state->>stateVersion", null)
          .select("user_id");
        if (legacyError) {
          throw new Error(`Failed to CAS upsert user state: ${legacyError.message}`);
        }
        if (legacyData && legacyData.length > 0) return "ok";
      }
      return "conflict";
    }
    return "ok";
  }

  async insertEvent(event: GovernorEvent): Promise<void> {
    const tenantId = event.tenantId ?? "default";
    const { error } = await this.client.from("governor_events").insert({
      tenant_id: tenantId,
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

  async getHealthMetrics(
    periodHours = 24,
    tenantId = "default",
    reserveTtlMs = 0
  ): Promise<HealthMetrics> {
    const periodStart = new Date(Date.now() - periodHours * 60 * 60 * 1000).toISOString();

    const [checksRes, outcomesRes, closingRes, orphanIds] = await Promise.all([
      this.client
        .from("governor_events")
        .select("decision_id, created_at", { count: "exact" })
        .eq("tenant_id", tenantId)
        .eq("event_type", "check")
        .not("decision_id", "is", null)
        .gte("created_at", periodStart),
      this.client
        .from("governor_events")
        .select("decision_id, action_type, event_type", { count: "exact" })
        .eq("tenant_id", tenantId)
        .in("event_type", ["executed", "blocked", "downgraded"])
        .gte("created_at", periodStart),
      this.client
        .from("governor_events")
        .select("decision_id")
        .eq("tenant_id", tenantId)
        .in("event_type", ["executed", "blocked", "downgraded", "released"])
        .gte("created_at", periodStart),
      this.getOrphanedDecisionIds(periodHours, 1000, tenantId)
    ]);

    const checksData = checksRes as {
      count?: number;
      data?: { decision_id: string; created_at: string }[];
    };
    const totalChecks = checksData.count ?? checksData.data?.length ?? 0;
    const outcomesData = outcomesRes as {
      count?: number;
      data?: { decision_id: string; action_type: string; event_type: string }[];
    };
    const totalOutcomes = outcomesData.count ?? outcomesData.data?.length ?? 0;
    const orphanCount = orphanIds.length;

    const orphanRate = totalChecks > 0 ? orphanCount / totalChecks : 0;

    const outcomes = outcomesData.data ?? [];
    const blockedCount = outcomes.filter((o) => o.event_type === "blocked").length;
    const blockRate = totalOutcomes > 0 ? blockedCount / totalOutcomes : 0;

    const closingIds = new Set(
      ((closingRes as { data?: { decision_id: string }[] }).data ?? [])
        .map((o) => o.decision_id)
        .filter(Boolean)
    );

    let expiredReserveCount = 0;
    if (reserveTtlMs > 0) {
      const now = Date.now();
      for (const c of checksData.data ?? []) {
        if (!c.decision_id || closingIds.has(c.decision_id)) continue;
        const created = new Date(c.created_at).getTime();
        if (now - created >= reserveTtlMs) expiredReserveCount += 1;
      }
    }
    const expiredReserveRate =
      reserveTtlMs > 0 && totalChecks > 0 ? expiredReserveCount / totalChecks : 0;

    const actionTypeDistribution: Record<string, number> = {};
    for (const o of outcomes) {
      actionTypeDistribution[o.action_type] =
        (actionTypeDistribution[o.action_type] ?? 0) + 1;
    }

    const healthScore = this.computeHealthScore({
      orphanRate,
      blockRate,
      totalChecks,
      totalOutcomes,
      actionTypeDistribution
    });

    return {
      periodHours,
      totalChecks,
      totalOutcomes,
      orphanCount,
      orphanRate,
      expiredReserveCount,
      expiredReserveRate,
      blockRate,
      actionTypeDistribution,
      healthScore
    };
  }

  async getOrphanedDecisionIds(
    periodHours = 24,
    limit = 100,
    tenantId = "default"
  ): Promise<string[]> {
    const orphans = await this.getOrphanedChecks(periodHours, limit, tenantId);
    return orphans.map((o) => o.decisionId);
  }

  async getOrphanedChecks(
    periodHours = 24,
    limit = 100,
    tenantId = "default"
  ): Promise<
    { decisionId: string; userId: string; actionType: string; createdAt: string }[]
  > {
    const periodStart = new Date(Date.now() - periodHours * 60 * 60 * 1000).toISOString();

    const { data: checks } = await this.client
      .from("governor_events")
      .select("decision_id, user_id, action_type, created_at")
      .eq("tenant_id", tenantId)
      .eq("event_type", "check")
      .not("decision_id", "is", null)
      .gte("created_at", periodStart)
      .limit(limit * 2);

    const { data: outcomes } = await this.client
      .from("governor_events")
      .select("decision_id")
      .eq("tenant_id", tenantId)
      .in("event_type", ["executed", "blocked", "downgraded", "released"])
      .gte("created_at", periodStart);

    const outcomeIds = new Set(
      (outcomes ?? []).map((o: { decision_id: string }) => o.decision_id)
    );

    const orphaned: {
      decisionId: string;
      userId: string;
      actionType: string;
      createdAt: string;
    }[] = [];
    for (const c of checks ?? []) {
      const row = c as {
        decision_id: string;
        user_id: string;
        action_type: string;
        created_at: string;
      };
      if (!row.decision_id || outcomeIds.has(row.decision_id)) continue;
      orphaned.push({
        decisionId: row.decision_id,
        userId: row.user_id,
        actionType: row.action_type,
        createdAt: row.created_at
      });
      if (orphaned.length >= limit) break;
    }
    return orphaned;
  }

  private computeHealthScore(params: {
    orphanRate: number;
    blockRate: number;
    totalChecks: number;
    totalOutcomes: number;
    actionTypeDistribution: Record<string, number>;
  }): number {
    const { orphanRate, blockRate, totalChecks, totalOutcomes } = params;
    const typeCount = Object.keys(params.actionTypeDistribution).length;

    let score = 100;
    if (orphanRate > 0.5) score -= 40;
    else if (orphanRate > 0.2) score -= 20;
    else if (orphanRate > 0.05) score -= 10;

    if (totalChecks > 0 && totalOutcomes === 0) score -= 30;
    else if (totalChecks > 10 && totalOutcomes / totalChecks < 0.5) score -= 20;

    if (typeCount === 1 && totalOutcomes > 5) score -= 15;

    if (blockRate > 0.8) score -= 10;
    else if (blockRate < 0.01 && totalOutcomes > 20) score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  async getReportMetrics(from: string, to: string, tenantId = "default"): Promise<ReportMetrics> {
    const [checksRes, outcomesRes, orphanIds] = await Promise.all([
      this.client
        .from("governor_events")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("event_type", "check")
        .not("decision_id", "is", null)
        .gte("created_at", from)
        .lte("created_at", to),
      this.client
        .from("governor_events")
        .select("event_type, action_type, context")
        .eq("tenant_id", tenantId)
        .in("event_type", ["executed", "blocked", "downgraded"])
        .gte("created_at", from)
        .lte("created_at", to),
      this.getOrphanedDecisionIdsInRange(from, to, 5000, tenantId)
    ]);

    const totalChecks = (checksRes as { count?: number }).count ?? 0;
    const outcomes = (outcomesRes as { data?: { event_type: string; action_type: string; context?: { blockReason?: string } }[] }).data ?? [];
    const totalOutcomes = outcomes.length;
    const orphanCount = orphanIds.length;
    const orphanRate = totalChecks > 0 ? orphanCount / totalChecks : 0;

    const outcomesByType = {
      executed: outcomes.filter((o) => o.event_type === "executed").length,
      blocked: outcomes.filter((o) => o.event_type === "blocked").length,
      downgraded: outcomes.filter((o) => o.event_type === "downgraded").length
    };

    const blocksByReason: Record<string, number> = {};
    for (const o of outcomes) {
      if (o.event_type === "blocked") {
        const reason = (o.context as { blockReason?: string })?.blockReason ?? "unknown";
        blocksByReason[reason] = (blocksByReason[reason] ?? 0) + 1;
      }
    }

    const actionTypeDistribution: Record<string, number> = {};
    for (const o of outcomes) {
      actionTypeDistribution[o.action_type] =
        (actionTypeDistribution[o.action_type] ?? 0) + 1;
    }

    return {
      period: { from, to },
      totalChecks,
      totalOutcomes,
      orphanCount,
      orphanRate,
      blocksByReason,
      outcomesByType,
      actionTypeDistribution
    };
  }

  async getDecisionLog(
    from: string,
    to: string,
    limit = 200,
    tenantId = "default",
    userId?: string
  ): Promise<DecisionLogEntry[]> {
    let query = this.client
      .from("governor_events")
      .select("id, created_at, user_id, action_type, event_type, decision_id, context")
      .eq("tenant_id", tenantId)
      .in("event_type", ["executed", "blocked", "downgraded"])
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch decision log: ${error.message}`);
    }

    return (data ?? []).map((row: {
      id: string;
      created_at: string;
      user_id: string;
      action_type: string;
      event_type: string;
      decision_id?: string;
      context?: { blockReason?: string };
    }) => ({
      id: row.id,
      createdAt: row.created_at,
      userId: row.user_id,
      actionType: row.action_type,
      eventType: row.event_type as "executed" | "blocked" | "downgraded",
      blockReason: row.context?.blockReason,
      decisionId: row.decision_id,
      context: row.context
    }));
  }

  private async getOrphanedDecisionIdsInRange(
    from: string,
    to: string,
    limit: number,
    tenantId = "default"
  ): Promise<string[]> {
    const { data: checks } = await this.client
      .from("governor_events")
      .select("decision_id")
      .eq("tenant_id", tenantId)
      .eq("event_type", "check")
      .not("decision_id", "is", null)
      .gte("created_at", from)
      .lte("created_at", to)
      .limit(limit * 2);

    const { data: outcomes } = await this.client
      .from("governor_events")
      .select("decision_id")
      .eq("tenant_id", tenantId)
      .in("event_type", ["executed", "blocked", "downgraded"])
      .gte("created_at", from)
      .lte("created_at", to);

    const checkIds = new Set(
      (checks ?? []).map((c: { decision_id: string }) => c.decision_id).filter(Boolean)
    );
    const outcomeIds = new Set(
      (outcomes ?? []).map((o: { decision_id: string }) => o.decision_id)
    );

    const orphaned: string[] = [];
    for (const id of checkIds) {
      if (!outcomeIds.has(id)) {
        orphaned.push(id);
        if (orphaned.length >= limit) break;
      }
    }
    return orphaned;
  }

  async getTenantByApiKey(key: string): Promise<string | null> {
    const keyHash = hashKey(key);
    const { data, error } = await this.client
      .from("tenant_api_keys")
      .select("tenant_id")
      .eq("key_hash", keyHash)
      .maybeSingle();

    if (error || !data?.tenant_id) return null;
    return data.tenant_id as string;
  }

  async createApiKey(tenantId: string, name?: string): Promise<{ key: string }> {
    const rawKey = `gov_${randomBytes(32).toString("hex")}`;
    const keyHash = hashKey(rawKey);

    const { error } = await this.client.from("tenant_api_keys").insert({
      tenant_id: tenantId,
      key_hash: keyHash,
      name: name ?? null
    });

    if (error) {
      throw new Error(`Failed to create API key: ${error.message}`);
    }

    return { key: rawKey };
  }
}
