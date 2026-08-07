import { Storage } from "./storage/storage";
import type { ApiKeyScope } from "./storage/storage";

export type AuthMode = "required" | "off";

export interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
}

export interface TenantOk {
  ok: true;
  tenantId: string;
  scopes: ApiKeyScope[];
  apiKey?: string;
}

export interface TenantDenied {
  ok: false;
  status: 401 | 403;
  body: { error: string };
}

export type TenantResolution = TenantOk | TenantDenied;

const DEFAULT_SCOPES: ApiKeyScope[] = [
  "check",
  "record",
  "read:pressure",
  "read:audit",
  "merge:users"
];

function extractApiKey(req: RequestLike): string | null {
  const auth = req.headers?.["authorization"];
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    const key = auth.slice(7).trim();
    if (key) return key;
  }
  const header = req.headers?.["x-governor-key"] ?? req.headers?.["x-softstop-key"];
  if (typeof header === "string" && header.trim()) return header.trim();
  if (Array.isArray(header) && header[0]?.trim()) return header[0].trim();
  return null;
}

/**
 * Auth mode:
 * - Authenticated when GOVERNOR_STORAGE=supabase or SOFTSTOP_AUTH=required
 * - Private single-tenant when SOFTSTOP_AUTH=off (memory/dev default)
 */
export function resolveAuthMode(
  envVars: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): AuthMode {
  const flag = String(envVars.SOFTSTOP_AUTH ?? "")
    .trim()
    .toLowerCase();
  if (flag === "off" || flag === "0" || flag === "false") return "off";
  if (flag === "required" || flag === "1" || flag === "true" || flag === "on") {
    return "required";
  }
  if (String(envVars.GOVERNOR_STORAGE ?? "").trim().toLowerCase() === "supabase") {
    return "required";
  }
  return "off";
}

export function resolveFixedTenantId(
  envVars: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): string {
  const tid = envVars.SOFTSTOP_TENANT_ID?.trim();
  return tid && tid.length > 0 ? tid : "default";
}

/**
 * Trusted tenant resolution. Never falls back from invalid/missing keys to body/query tenantId.
 */
export async function resolveRequestTenant(
  storage: Storage,
  req: RequestLike,
  options: {
    authMode: AuthMode;
    fixedTenantId?: string;
    requiredScope?: ApiKeyScope;
  }
): Promise<TenantResolution> {
  if (options.authMode === "off") {
    return {
      ok: true,
      tenantId: options.fixedTenantId ?? resolveFixedTenantId(),
      scopes: [...DEFAULT_SCOPES, "admin:keys"]
    };
  }

  const key = extractApiKey(req);
  if (!key) {
    return {
      ok: false,
      status: 401,
      body: { error: "unauthorized: API key required" }
    };
  }

  let info =
    storage.resolveApiKey != null
      ? await storage.resolveApiKey(key)
      : null;
  if (!info && storage.getTenantByApiKey) {
    const tid = await storage.getTenantByApiKey(key);
    if (tid) {
      info = { tenantId: tid, scopes: DEFAULT_SCOPES };
    }
  }
  if (!info) {
    return {
      ok: false,
      status: 401,
      body: { error: "unauthorized: invalid API key" }
    };
  }

  if (options.requiredScope && !info.scopes.includes(options.requiredScope)) {
    return {
      ok: false,
      status: 403,
      body: { error: `forbidden: missing scope ${options.requiredScope}` }
    };
  }

  if (storage.touchApiKey) {
    void storage.touchApiKey(key).catch(() => undefined);
  }

  return {
    ok: true,
    tenantId: info.tenantId,
    scopes: info.scopes,
    apiKey: key
  };
}

/**
 * @deprecated Prefer resolveRequestTenant. Never returns a client-supplied tenant
 * when a key was presented but invalid.
 */
export async function resolveTenantId(
  storage: Storage,
  req: RequestLike,
  _source: "query" | "body",
  options?: { authMode?: AuthMode; fixedTenantId?: string }
): Promise<string | undefined> {
  const resolved = await resolveRequestTenant(storage, req, {
    authMode: options?.authMode ?? resolveAuthMode(),
    fixedTenantId: options?.fixedTenantId
  });
  if (!resolved.ok) return undefined;
  return resolved.tenantId;
}
