import path from "path";
import dotenv from "dotenv";
import { z } from "zod";

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
  GOVERNOR_POLICY: z.preprocess(emptyToUndefined, z.string().min(1).optional())
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

export const env = {
  useSupabase,
  supabaseUrl: data.SUPABASE_URL ?? "",
  supabaseKey,
  port: data.PORT ? Number(data.PORT) : 3000,
  adminSecret: data.GOVERNOR_ADMIN_SECRET ?? ""
};
