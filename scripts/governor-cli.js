#!/usr/bin/env node
/**
 * SoftStop Pilot CLI – verify, health, check, test
 *
 * Usage:
 *   node scripts/governor-cli.js verify
 *   node scripts/governor-cli.js health
 *   node scripts/governor-cli.js check --userId test_123 --actionType urgency
 *   node scripts/governor-cli.js test --userId test_123 --actionType reminder
 *
 * Environment:
 *   SOFTSTOP_API_URL or GOVERNOR_API_URL  Base URL (default: http://localhost:3000)
 *   Hosted demo (optional): https://governer.vercel.app
 */

const BASE =
  process.env.SOFTSTOP_API_URL ||
  process.env.GOVERNOR_API_URL ||
  "http://localhost:3000";

function apiPath(path) {
  const u = new URL(BASE);
  const isLocal = /localhost|127\.0\.0\.1/.test(u.hostname);
  const prefix = isLocal ? "/v1" : "/api";
  return `${BASE.replace(/\/$/, "")}${prefix}${path}`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const cmd = args[0] || "help";
  const opts = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const k = args[i].slice(2).replace(/-/g, "").toLowerCase();
      opts[k] = args[i + 1] === undefined || args[i + 1].startsWith("--") ? true : args[++i];
    }
  }
  return { cmd, opts };
}

async function fetchJSON(url, opts = {}) {
  const { headers, ...rest } = opts;
  const res = await fetch(url, {
    ...rest,
    headers: { "Content-Type": "application/json", ...headers }
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON: ${text.slice(0, 100)}`);
  }
  return { ok: res.ok, status: res.status, data };
}

async function cmdVerify(opts) {
  const url = apiPath("/verify");
  const body = opts.tenantid ? JSON.stringify({ tenantId: opts.tenantid }) : undefined;
  const { ok, status, data } = await fetchJSON(url, {
    method: "POST",
    body: body || "{}"
  });
  if (!ok) {
    console.error("✗ Verify failed:", data.error || data);
    process.exit(1);
  }
  console.log("✓ Integration verification passed");
  console.log("  decisionId:", data.decisionId);
}

async function cmdHealth(opts) {
  let url = apiPath("/health");
  const params = new URLSearchParams();
  if (opts.hours) params.set("periodHours", opts.hours);
  if (opts.tenantid) params.set("tenantId", opts.tenantid);
  if (params.toString()) url += "?" + params.toString();
  const headers = opts.apikey ? { Authorization: `Bearer ${opts.apikey}` } : {};
  const { ok, status, data } = await fetchJSON(url, { headers });
  if (!ok) {
    console.error("✗ Health check failed:", data.error || data);
    process.exit(1);
  }
  const m = data.metrics || {};
  console.log("✓ Health:", m.healthScore ?? "—", "| Checks:", m.totalChecks ?? 0, "| Orphan rate:", ((m.orphanRate ?? 0) * 100).toFixed(1) + "%");
}

async function cmdCheck(opts) {
  const userId = opts.userid;
  const actionType = opts.actiontype || "urgency";
  if (!userId) {
    console.error("Missing --userId (or --user-id)");
    process.exit(1);
  }
  const body = { userId, actionType };
  if (opts.surface) body.surface = opts.surface;
  if (opts.tenantid) body.tenantId = opts.tenantid;
  const url = apiPath("/check");
  const headers = opts.apikey ? { Authorization: `Bearer ${opts.apikey}` } : {};
  const { ok, status, data } = await fetchJSON(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers
  });
  if (!ok) {
    console.error("✗ Check failed:", data.error || data);
    process.exit(1);
  }
  console.log(data.allowed ? "✓ Allowed" : `✗ Blocked (${data.reason})`);
  console.log("  decisionId:", data.decisionId);
  if (data.cooldownUntil) console.log("  cooldownUntil:", data.cooldownUntil);
  if (data.explanation) console.log("  explanation:", data.explanation);
  return data.decisionId;
}

async function cmdRecord(opts) {
  const decisionId = opts.decisionid;
  const userId = opts.userid;
  const actionType = opts.actiontype || "urgency";
  const outcome = opts.outcome || "executed";
  if (!decisionId || !userId) {
    console.error("Missing --decisionId and --userId");
    process.exit(1);
  }
  const body = { decisionId, userId, actionType, outcome };
  if (opts.tenantid) body.tenantId = opts.tenantid;
  if (opts.blockreason) body.blockReason = opts.blockreason;
  const url = apiPath("/record");
  const headers = opts.apikey ? { Authorization: `Bearer ${opts.apikey}` } : {};
  const { ok, status, data } = await fetchJSON(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers
  });
  if (!ok) {
    console.error("✗ Record failed:", data.error || data);
    process.exit(1);
  }
  console.log("✓ Recorded");
}

async function cmdTest(opts) {
  const userId = opts.userid || `cli_test_${Date.now()}`;
  const actionType = opts.actiontype || "reminder";
  console.log("Running check...");
  const decisionId = await cmdCheck(opts);
  if (!decisionId) return;
  console.log("\nRecording outcome...");
  await cmdRecord({ ...opts, decisionid: decisionId, userid: userId });
  console.log("\n✓ Test passed (check → record)");
}

function help() {
  console.log(`
Governor Pilot CLI

Usage:
  governor verify                    Verify integration (check/record flow)
  governor health                    Health metrics
  governor check --userId X [opts]   Run check
  governor record --decisionId X --userId Y [opts]  Record outcome
  governor test [opts]               Check + record (full flow)

Options:
  --userId, --user-id      User identifier (required for check/record/test)
  --actionType, --action-type  urgency|discount|interruption|reminder (default: urgency)
  --surface                email|sms|push|in-app
  --outcome                executed|blocked|downgraded (record)
  --tenantId, --tenant-id  Pilot tenant ID
  --apiKey, --api-key      API key for scoped access
  --hours                  Health period hours (default: 24)

Environment:
  SOFTSTOP_API_URL or GOVERNOR_API_URL  Base URL (default: http://localhost:3000)
  Optional hosted demo: https://governer.vercel.app

Examples (local first):
  pnpm dev
  pnpm governor verify
  pnpm governor health
  pnpm governor check --userId u123 --actionType urgency
  pnpm governor test --userId u123 --actionType reminder
  GOVERNOR_API_URL=https://governer.vercel.app pnpm governor verify
`);
}

async function main() {
  const { cmd, opts } = parseArgs();
  try {
    switch (cmd.toLowerCase()) {
      case "verify":
        await cmdVerify(opts);
        break;
      case "health":
        await cmdHealth(opts);
        break;
      case "check":
        await cmdCheck(opts);
        break;
      case "record":
        await cmdRecord(opts);
        break;
      case "test":
        await cmdTest(opts);
        break;
      case "help":
      case "-h":
      case "--help":
      default:
        help();
    }
  } catch (err) {
    console.error("Error:", err.message);
    if (err.cause) console.error(err.cause);
    process.exit(1);
  }
}

main();
