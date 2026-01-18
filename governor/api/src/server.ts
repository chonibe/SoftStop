import path from "path";
import express from "express";
import { createApp } from "./app";
import { env } from "./env";
import { SupabaseStorage } from "./storage/supabaseStorage";

const storage = new SupabaseStorage(
  env.supabaseUrl,
  env.supabaseServiceRoleKey
);

const app = createApp(storage);

const demoPath = path.resolve("demo");
app.use("/demo", express.static(demoPath));
app.get("/", (_req, res) => res.redirect("/demo"));

app.listen(env.port, () => {
  console.log(`Governor API listening on http://localhost:${env.port}`);
});
