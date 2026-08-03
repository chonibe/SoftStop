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
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
  }
  const { userId, ts, sessionId, eventType, context } = body || {};
  if (!userId || !sessionId || !eventType) {
    return res.status(400).json({ error: "Invalid payload: userId, sessionId, eventType required" });
  }
  try {
    const { error } = await client.from("analytics_events").insert({
      user_id: userId,
      ts: ts || new Date().toISOString(),
      session_id: sessionId,
      event_type: eventType,
      context: context || {},
    });
    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[analytics/event]", err);
    return res.status(500).json({ error: err.message || "Database error" });
  }
}

module.exports = handler;
