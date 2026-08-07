import path from "path";
import express from "express";
import { createApp } from "./app";
import { env } from "./env";
import { loadPolicyFromEnv } from "./rules/loadPolicy";
import { MemoryStorage } from "./storage/memoryStorage";
import { SupabaseStorage } from "./storage/supabaseStorage";

const storage = env.useSupabase
  ? new SupabaseStorage(env.supabaseUrl, env.supabaseKey)
  : new MemoryStorage();

if (!env.useSupabase) {
  console.log(
    "SoftStop using in-memory storage. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) for persistence."
  );
}

const loaded = loadPolicyFromEnv(process.env, process.cwd());
console.log(`SoftStop policy: ${loaded.source}`);
if ((loaded.config.reserveTtlMs ?? 0) > 0) {
  console.log(`SoftStop check-and-reserve TTL: ${loaded.config.reserveTtlMs}ms`);
}

const app = createApp(storage, {
  rulesConfig: loaded.config,
  policySource: loaded.source
});

const demoPath = path.resolve("demo");
app.use("/demo", express.static(demoPath));
app.get("/", (_req, res) => res.redirect("/demo"));

app.listen(env.port, () => {
  console.log(`SoftStop API listening on http://localhost:${env.port}`);
});
