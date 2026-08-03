"use strict";
const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }
  if (!client) {
    return res.status(503).json({ error: "Analytics not configured" });
  }
  const { userId, variant } = req.body || {};
  if (!userId || !variant || !["A", "B"].includes(variant)) {
    return res.status(400).json({ error: "Invalid payload: userId and variant (A|B) required" });
  }
  try {
    const { error } = await client
      .from("analytics_users")
      .upsert(
        { user_id: userId, variant, created_at: new Date().toISOString() },
        { onConflict: "user_id", ignoreDuplicates: true }
      );
    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[analytics/user]", err);
    return res.status(500).json({ error: err.message || "Database error" });
  }
}

module.exports = handler;
