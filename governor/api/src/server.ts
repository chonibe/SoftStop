import path from "path";
import express from "express";
import { createApp } from "./app";
import { env } from "./env";
import { MemoryStorage } from "./storage/memoryStorage";
import { SupabaseStorage } from "./storage/supabaseStorage";

const storage = env.useSupabase
  ? new SupabaseStorage(env.supabaseUrl, env.supabaseKey)
  : new MemoryStorage();

if (!env.useSupabase) {
  console.log("Governor using in-memory storage. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) for persistence.");
}

const app = createApp(storage);

const demoPath = path.resolve("demo");
app.use("/demo", express.static(demoPath));
app.get("/", (_req, res) => res.redirect("/demo"));

app.listen(env.port, () => {
  console.log(`Governor API listening on http://localhost:${env.port}`);
});
