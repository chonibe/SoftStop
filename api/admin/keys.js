"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const supabaseStorage_1 = require("../../dist/governor/api/src/storage/supabaseStorage");
const storage = new supabaseStorage_1.SupabaseStorage(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
const ADMIN_SECRET = process.env.GOVERNOR_ADMIN_SECRET ?? "";
async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "method_not_allowed" });
    }
    if (!ADMIN_SECRET) {
        return res.status(501).json({ error: "Admin keys not configured (GOVERNOR_ADMIN_SECRET)" });
    }
    const auth = req.headers?.authorization;
    const secret = typeof auth === "string" && auth.startsWith("Bearer ")
        ? auth.slice(7)
        : req.headers?.["x-admin-secret"];
    const received = typeof secret === "string" ? secret : Array.isArray(secret) ? secret[0] : undefined;
    if (received !== ADMIN_SECRET) {
        return res.status(401).json({ error: "unauthorized" });
    }
    if (!storage.createApiKey) {
        return res.status(501).json({ error: "Key creation not available" });
    }
    const { tenantId: tid, name } = req.body || {};
    if (!tid || typeof tid !== "string" || !tid.trim()) {
        return res.status(400).json({ error: "tenantId required" });
    }
    try {
        const { key } = await storage.createApiKey(tid.trim(), name?.trim() || undefined);
        return res.status(201).json({
            key,
            tenantId: tid.trim(),
            message: "Key created. Store it securely; it cannot be retrieved again."
        });
    }
    catch (err) {
        console.error("[admin/keys]", err);
        return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to create key" });
    }
}
