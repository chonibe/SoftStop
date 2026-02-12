import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  SUPABASE_URL: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  PORT: z.string().optional()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `Invalid environment variables: ${parsed.error.flatten().fieldErrors}`
  );
}

export const env = {
  supabaseUrl: parsed.data.SUPABASE_URL,
  supabaseServiceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
  port: parsed.data.PORT ? Number(parsed.data.PORT) : 3000
};
