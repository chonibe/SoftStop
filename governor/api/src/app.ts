import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { Storage } from "./storage/storage";
import { env } from "./env";
import {
  resolveAuthMode,
  resolveFixedTenantId,
  resolveRequestTenant,
  type AuthMode
} from "./keys";
import type { ApiKeyScope } from "./storage/storage";
import { defaultRulesConfig, GovernorRulesConfig } from "./rules/config";
import {
  handleCheck,
  handleRecord,
  handleRelease,
  handleMerge,
  handleHealth,
  handleVerify,
  handleReport,
  handleAuditReport,
  handleDecisionLog,
  handleInsights,
  handleGetPressure,
  handleGetActivity
} from "./handlers";

export interface CreateAppOptions {
  rulesConfig?: GovernorRulesConfig;
  policySource?: string;
  /** Override auth mode (tests). Defaults from env. */
  authMode?: AuthMode;
  /** Fixed tenant when authMode is off. */
  fixedTenantId?: string;
}

declare global {
  namespace Express {
    interface Request {
      softstopTenantId?: string;
      softstopScopes?: ApiKeyScope[];
    }
  }
}

function withTrustedTenant(
  body: unknown,
  tenantId: string
): Record<string, unknown> {
  const base =
    body && typeof body === "object" && !Array.isArray(body)
      ? { ...(body as Record<string, unknown>) }
      : {};
  // Strip client-supplied tenantId; trusted middleware owns the namespace.
  delete base.tenantId;
  return { ...base, tenantId };
}

const mountRoutes = (
  app: express.Express,
  storage: Storage,
  prefix: "/v1" | "/api",
  rulesConfig: GovernorRulesConfig,
  policySource: string,
  authMode: AuthMode,
  fixedTenantId: string
) => {
  const requireTenant = (
    requiredScope?: ApiKeyScope
  ): express.RequestHandler => {
    return async (req, res, next) => {
      const resolved = await resolveRequestTenant(storage, req, {
        authMode,
        fixedTenantId,
        requiredScope
      });
      if (!resolved.ok) {
        return res.status(resolved.status).json(resolved.body);
      }
      req.softstopTenantId = resolved.tenantId;
      req.softstopScopes = resolved.scopes;
      return next();
    };
  };

  app.post(`${prefix}/check`, requireTenant("check"), async (req, res) => {
    const result = await handleCheck(
      storage,
      withTrustedTenant(req.body, req.softstopTenantId!),
      rulesConfig
    );
    return res.status(result.status).json(result.body);
  });

  app.post(`${prefix}/record`, requireTenant("record"), async (req, res) => {
    const result = await handleRecord(
      storage,
      withTrustedTenant(req.body, req.softstopTenantId!),
      rulesConfig
    );
    return res.status(result.status).json(result.body);
  });

  app.post(`${prefix}/release`, requireTenant("record"), async (req, res) => {
    const result = await handleRelease(
      storage,
      withTrustedTenant(req.body, req.softstopTenantId!),
      rulesConfig
    );
    return res.status(result.status).json(result.body);
  });

  app.post(`${prefix}/users/merge`, requireTenant("merge:users"), async (req, res) => {
    const result = await handleMerge(
      storage,
      withTrustedTenant(req.body, req.softstopTenantId!),
      rulesConfig
    );
    return res.status(result.status).json(result.body);
  });

  app.get(`${prefix}/health`, requireTenant("read:audit"), async (req, res) => {
    const periodHours = req.query.periodHours
      ? parseInt(String(req.query.periodHours), 10)
      : undefined;
    const includeOrphans =
      req.query.includeOrphans === "1" ||
      req.query.includeOrphans === "true";
    const result = await handleHealth(
      storage,
      periodHours,
      req.softstopTenantId,
      rulesConfig,
      includeOrphans
    );
    return res.status(result.status).json(result.body);
  });

  app.post(`${prefix}/verify`, requireTenant("check"), async (req, res) => {
    const result = await handleVerify(storage, req.softstopTenantId, rulesConfig);
    return res.status(result.status).json(result.body);
  });

  app.get(`${prefix}/users/:userId/pressure`, requireTenant("read:pressure"), async (req, res) => {
    const result = await handleGetPressure(
      storage,
      String(req.params.userId ?? ""),
      req.softstopTenantId,
      rulesConfig
    );
    return res.status(result.status).json(result.body);
  });

  app.get(`${prefix}/users/:userId/activity`, requireTenant("read:audit"), async (req, res) => {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
    const result = await handleGetActivity(
      storage,
      String(req.params.userId ?? ""),
      limit,
      req.softstopTenantId,
      rulesConfig
    );
    return res.status(result.status).json(result.body);
  });

  app.get(`${prefix}/policy`, (_req, res) => {
    return res.status(200).json({
      ok: true,
      source: policySource,
      policy: rulesConfig
    });
  });
};

export const createApp = (storage: Storage, options: CreateAppOptions = {}) => {
  const rulesConfig = options.rulesConfig ?? defaultRulesConfig;
  const policySource = options.policySource ?? "builtin:defaultRulesConfig";
  const authMode = options.authMode ?? env.authMode ?? resolveAuthMode();
  const fixedTenantId =
    options.fixedTenantId ?? env.fixedTenantId ?? resolveFixedTenantId();
  const app = express();
  app.use(cors());
  app.use(express.json());

  const requireTenant = (
    requiredScope?: ApiKeyScope
  ): express.RequestHandler => {
    return async (req, res, next) => {
      const resolved = await resolveRequestTenant(storage, req, {
        authMode,
        fixedTenantId,
        requiredScope
      });
      if (!resolved.ok) {
        return res.status(resolved.status).json(resolved.body);
      }
      req.softstopTenantId = resolved.tenantId;
      req.softstopScopes = resolved.scopes;
      return next();
    };
  };

  // Local and self-host use /v1; hosted demo and some examples use /api.
  mountRoutes(app, storage, "/v1", rulesConfig, policySource, authMode, fixedTenantId);
  mountRoutes(app, storage, "/api", rulesConfig, policySource, authMode, fixedTenantId);

  /** Process alive — no storage dependency. */
  app.get("/livez", (_req, res) => {
    return res.status(200).json({ ok: true, status: "live" });
  });

  /** Ready to serve — storage probe when available. */
  app.get("/readyz", async (_req, res) => {
    try {
      if (storage.getHealthMetrics) {
        await storage.getHealthMetrics(1, fixedTenantId, 0);
      }
      return res.status(200).json({ ok: true, status: "ready" });
    } catch (err) {
      return res.status(503).json({
        ok: false,
        status: "not_ready",
        error: err instanceof Error ? err.message : "storage_unavailable"
      });
    }
  });

  app.get("/v1/report", requireTenant("read:audit"), async (req, res) => {
    const from = req.query.from ? String(req.query.from) : undefined;
    const to = req.query.to ? String(req.query.to) : undefined;
    const result = await handleReport(storage, from, to, req.softstopTenantId);
    return res.status(result.status).json(result.body);
  });

  app.get("/v1/report/audit", requireTenant("read:audit"), async (req, res) => {
    const from = req.query.from ? String(req.query.from) : undefined;
    const to = req.query.to ? String(req.query.to) : undefined;
    const format = req.query.format as "json" | "csv" | undefined;
    const result = await handleAuditReport(
      storage,
      from,
      to,
      format,
      req.softstopTenantId
    );
    if (result.headers) {
      res.set(result.headers);
    }
    if (typeof result.body === "string") {
      return res.status(result.status).send(result.body);
    }
    return res.status(result.status).json(result.body);
  });

  app.get("/v1/report/decisions", requireTenant("read:audit"), async (req, res) => {
    const from = req.query.from ? String(req.query.from) : undefined;
    const to = req.query.to ? String(req.query.to) : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
    const userId = req.query.userId ? String(req.query.userId) : undefined;
    const result = await handleDecisionLog(
      storage,
      from,
      to,
      limit,
      req.softstopTenantId,
      userId
    );
    return res.status(result.status).json(result.body);
  });

  app.get("/v1/report/insights", requireTenant("read:audit"), async (req, res) => {
    const from = req.query.from ? String(req.query.from) : undefined;
    const to = req.query.to ? String(req.query.to) : undefined;
    const periodHours = req.query.periodHours
      ? parseInt(String(req.query.periodHours), 10)
      : undefined;
    const result = await handleInsights(
      storage,
      from,
      to,
      periodHours,
      req.softstopTenantId
    );
    return res.status(result.status).json(result.body);
  });

  // Admin: create API key (requires GOVERNOR_ADMIN_SECRET)
  if (env.adminSecret && storage.createApiKey) {
    app.post("/v1/admin/keys", async (req, res) => {
      const auth = req.headers?.authorization;
      const secret =
        typeof auth === "string" && auth.startsWith("Bearer ")
          ? auth.slice(7)
          : req.headers?.["x-admin-secret"];
      const received =
        typeof secret === "string"
          ? secret
          : Array.isArray(secret)
            ? secret[0]
            : undefined;
      if (received !== env.adminSecret) {
        return res.status(401).json({ error: "unauthorized" });
      }
      const { tenantId: tid, name } = req.body || {};
      if (!tid || typeof tid !== "string" || !tid.trim()) {
        return res.status(400).json({ error: "tenantId required" });
      }
      try {
        const { key } = await storage.createApiKey!(
          tid.trim(),
          name?.trim() || undefined
        );
        return res.status(201).json({
          key,
          tenantId: tid.trim(),
          message: "Key created. Store it securely; it cannot be retrieved again."
        });
      } catch (err) {
        console.error("[admin/keys]", err);
        return res.status(500).json({ error: (err as Error).message });
      }
    });
  }

  // Analytics (validity test) - same Supabase, separate tables
  if (env.supabaseUrl && env.supabaseKey) {
    const analyticsClient = createClient(env.supabaseUrl, env.supabaseKey, {
      auth: { persistSession: false }
    });

    app.post("/v1/analytics/user", async (req, res) => {
      try {
        const { userId, variant } = req.body || {};
        if (!userId || !variant || !["A", "B"].includes(variant)) {
          return res
            .status(400)
            .json({ error: "Invalid payload: userId and variant (A|B) required" });
        }
        const { error } = await analyticsClient
          .from("analytics_users")
          .upsert(
            { user_id: userId, variant, created_at: new Date().toISOString() },
            { onConflict: "user_id", ignoreDuplicates: true }
          );
        if (error) throw error;
        return res.status(200).json({ ok: true });
      } catch (err: unknown) {
        console.error("[analytics/user]", err);
        return res.status(500).json({ error: (err as Error).message || "Database error" });
      }
    });

    app.post("/v1/analytics/event", async (req, res) => {
      try {
        let body = req.body;
        if (typeof body === "string") {
          try {
            body = JSON.parse(body);
          } catch {
            return res.status(400).json({ error: "Invalid JSON body" });
          }
        }
        const { userId, ts, sessionId, eventType, context } = body || {};
        if (!userId || !sessionId || !eventType) {
          return res
            .status(400)
            .json({ error: "Invalid payload: userId, sessionId, eventType required" });
        }
        const { error } = await analyticsClient.from("analytics_events").insert({
          user_id: userId,
          ts: ts || new Date().toISOString(),
          session_id: sessionId,
          event_type: eventType,
          context: context || {}
        });
        if (error) throw error;
        return res.status(200).json({ ok: true });
      } catch (err: unknown) {
        console.error("[analytics/event]", err);
        return res.status(500).json({ error: (err as Error).message || "Database error" });
      }
    });
  }

  return app;
};
