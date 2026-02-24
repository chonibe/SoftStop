import { Storage } from "./storage/storage";

export interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
}

function extractApiKey(req: RequestLike): string | null {
  const auth = req.headers?.["authorization"];
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    const key = auth.slice(7).trim();
    if (key) return key;
  }
  const header = req.headers?.["x-governor-key"];
  if (typeof header === "string" && header.trim()) return header.trim();
  if (Array.isArray(header) && header[0]?.trim()) return header[0].trim();
  return null;
}

/**
 * Resolve tenantId from API key (if valid) or from query/body.
 * When an API key is present and valid, it takes precedence over tenantId in query/body.
 */
export async function resolveTenantId(
  storage: Storage,
  req: RequestLike,
  source: "query" | "body"
): Promise<string | undefined> {
  const key = extractApiKey(req);
  if (key && storage.getTenantByApiKey) {
    const tid = await storage.getTenantByApiKey(key);
    if (tid) return tid;
  }
  if (source === "query") {
    const t = req.query?.tenantId;
    return typeof t === "string" ? t : Array.isArray(t) ? t[0] : undefined;
  }
  const t = req.body?.tenantId;
  return typeof t === "string" ? t : undefined;
}
