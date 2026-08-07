import path from "path";
import dotenv from "dotenv";
import { z } from "zod";
import { resolveAuthMode, resolveFixedTenantId, type AuthMode } from "./keys";

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const envSchema = z.object({
  SUPABASE_URL: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional()
  ),
  SUPABASE_ANON_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  PORT: z.preprocess(emptyToUndefined, z.string().optional()),
  GOVERNOR_ADMIN_SECRET: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional()
  ),
  /** Force in-memory storage even if Supabase env vars are present (local/CI). */
  GOVERNOR_STORAGE: z.preprocess(emptyToUndefined, z.enum(["memory", "supabase"]).optional()),
  /** Policy JSON path (overrides preset). */
  SOFTSTOP_POLICY_FILE: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  GOVERNOR_POLICY_FILE: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  /** Preset: default | strict | lenient */
  SOFTSTOP_POLICY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  GOVERNOR_POLICY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  /**
   * Check-and-reserve TTL in ms. Explicit value always wins.
   * Production (Supabase) defaults to 20000 unless SOFTSTOP_RESERVE=off
   * or SOFTSTOP_UNSAFE_LEGACY_CHECK is set.
   */
  SOFTSTOP_RESERVE_TTL_MS: z.preprocess(emptyToUndefined, z.string().optional()),
  /** on/true enables 20s TTL; off/false forces legacy read-only check. */
  SOFTSTOP_RESERVE: z.preprocess(emptyToUndefined, z.string().optional()),
  /**
   * Explicit unsafe flag for legacy read-only check (no reserve).
   * Required to disable reserve on production/Supabase paths.
   */
  SOFTSTOP_UNSAFE_LEGACY_CHECK: z.preprocess(emptyToUndefined, z.string().optional()),
  SOFTSTOP_AUTH: z.preprocess(emptyToUndefined, z.string().optional()),
  SOFTSTOP_TENANT_ID: z.preprocess(emptyToUndefined, z.string().optional())
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `Invalid environment variables: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`
  );
}

const data = parsed.data;
const supabaseKey = data.SUPABASE_SERVICE_ROLE_KEY ?? data.SUPABASE_ANON_KEY ?? "";
const useSupabase =
  data.GOVERNOR_STORAGE !== "memory" && Boolean(data.SUPABASE_URL && supabaseKey);

const DEFAULT_RESERVE_TTL_MS = 20_000;

function isTruthyFlag(raw: string | undefined): boolean {
  const flag = raw?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes" || flag === "on";
}

function isOffFlag(raw: string | undefined): boolean {
  const flag = raw?.trim().toLowerCase();
  return flag === "0" || flag === "false" || flag === "no" || flag === "off";
}

/**
 * Resolve reserve TTL.
 * - Explicit SOFTSTOP_RESERVE_TTL_MS always wins
 * - SOFTSTOP_RESERVE=off / SOFTSTOP_UNSAFE_LEGACY_CHECK → 0
 * - SOFTSTOP_RESERVE=on → 20000
 * - Supabase/production path → 20000 unless explicitly off/unsafe
 * - Memory/dev → 0 unless explicitly on (keeps unit-test defaults)
 */
export function resolveReserveTtlMs(
  envVars: {
    SOFTSTOP_RESERVE_TTL_MS?: string;
    SOFTSTOP_RESERVE?: string;
    SOFTSTOP_UNSAFE_LEGACY_CHECK?: string;
    GOVERNOR_STORAGE?: string;
  } = data,
  opts: { useSupabase?: boolean } = { useSupabase }
): number {
  const raw = envVars.SOFTSTOP_RESERVE_TTL_MS?.trim();
  if (raw !== undefined && raw !== "") {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error("SOFTSTOP_RESERVE_TTL_MS must be a non-negative number");
    }
    return Math.floor(n);
  }

  if (
    isOffFlag(envVars.SOFTSTOP_RESERVE) ||
    isTruthyFlag(envVars.SOFTSTOP_UNSAFE_LEGACY_CHECK)
  ) {
    return 0;
  }

  if (isTruthyFlag(envVars.SOFTSTOP_RESERVE)) {
    return DEFAULT_RESERVE_TTL_MS;
  }

  const production =
    opts.useSupabase === true ||
    String(envVars.GOVERNOR_STORAGE ?? "").trim().toLowerCase() === "supabase";
  if (production) {
    return DEFAULT_RESERVE_TTL_MS;
  }

  return 0;
}

const authMode: AuthMode = resolveAuthMode({
  GOVERNOR_STORAGE: data.GOVERNOR_STORAGE,
  SOFTSTOP_AUTH: data.SOFTSTOP_AUTH
});

export const env = {
  useSupabase,
  supabaseUrl: data.SUPABASE_URL ?? "",
  supabaseKey,
  port: data.PORT ? Number(data.PORT) : 3000,
  adminSecret: data.GOVERNOR_ADMIN_SECRET ?? "",
  reserveTtlMs: resolveReserveTtlMs(),
  authMode,
  fixedTenantId: resolveFixedTenantId({
    SOFTSTOP_TENANT_ID: data.SOFTSTOP_TENANT_ID
  })
};
