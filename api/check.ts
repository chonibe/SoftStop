import { SupabaseStorage } from "../governor/api/src/storage/supabaseStorage";
import { handleCheck } from "../governor/api/src/handlers";

const storage = new SupabaseStorage(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const result = await handleCheck(storage, req.body);
  return res.status(result.status).json(result.body);
}
