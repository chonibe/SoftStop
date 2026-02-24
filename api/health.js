"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const supabaseStorage_1 = require("../dist/governor/api/src/storage/supabaseStorage");
const handlers_1 = require("../dist/governor/api/src/handlers");
const keys_1 = require("../dist/governor/api/src/keys");
const storage = new supabaseStorage_1.SupabaseStorage(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "method_not_allowed" });
    }
    const periodHours = req.query.periodHours
        ? parseInt(String(req.query.periodHours), 10)
        : undefined;
    const tenantId = await (0, keys_1.resolveTenantId)(storage, req, "query");
    const result = await (0, handlers_1.handleHealth)(storage, periodHours, tenantId);
    return res.status(result.status).json(result.body);
}
