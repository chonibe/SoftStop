#!/usr/bin/env node
/**
 * SoftStop Pilot CLI – verify, health, check, test, policy
 *
 * Usage:
 *   node scripts/governor-cli.js verify
 *   node scripts/governor-cli.js policy show
 *   node scripts/governor-cli.js policy validate --file policies/strict.json
 *
 * Environment:
 *   SOFTSTOP_API_URL or GOVERNOR_API_URL  Base URL (default: http://localhost:3000)
 */

const fs = require("fs");
const path = require("path");

const BASE =
  process.env.SOFTSTOP_API_URL ||
  process.env.GOVERNOR_API_URL ||
  "http://localhost:3000";

const ACTION_TYPES = ["urgency", "discount", "interruption", "reminder"];

function apiPath(p) {
  const u = new URL(BASE);
  const isLocal = /localhost|127\.0\.0\.1/.test(u.hostname);
  const prefix = isLocal ? "/v1" : "/api";
  return `${BASE.replace(/\/$/, "")}${prefix}${p}`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const cmd = args[0] || "help";
  const sub = args[1] && !args[1].startsWith("--") ? args[1] : undefined;
  const opts = {};
  const start = sub ? 2 : 1;
  for (let i = start; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const k = args[i].slice(2).replace(/-/g, "").toLowerCase();
      opts[k] =
        args[i + 1] === undefined || args[i + 1].startsWith("--")
          ? true
          : args[++i];
    }
  }
  return { cmd, sub, opts };
}

function isNonNeg(n) {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

function validatePolicyObject(raw) {
  if (!raw || typeof raw !== "object") throw new Error("Policy must be a JSON object");
  for (const field of ["cooldownHours", "typeCap"]) {
    if (!raw[field] || typeof raw[field] !== "object") {
      throw new Error(`Policy.${field} must map action types to numbers`);
    }
    for (const t of ACTION_TYPES) {
      if (!isNonNeg(raw[field][t])) {
        throw new Error(`Policy.${field}.${t} must be a non-negative number`);
      }
    }
  }
  if (!isNonNeg(raw.globalCap)) throw new Error("Policy.globalCap must be a non-negative number");
  if (!isNonNeg(raw.windowHours) || raw.windowHours <= 0) {
    throw new Error("Policy.windowHours must be a positive number");
  }
  if (!isNonNeg(raw.stackingWindowMinutes)) {
    throw new Error("Policy.stackingWindowMinutes must be a non-negative number");
  }
  return raw;
}

function resolvePresetPath(preset) {
  const file = path.resolve(process.cwd(), "policies", `${preset}.json`);
  if (!fs.existsSync(file)) throw new Error(`Preset file not found: ${file}`);
  return file;
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
  const { ok, data } = await fetchJSON(url, {
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
  const { ok, data } = await fetchJSON(url, { headers });
  if (!ok) {
    console.error("✗ Health check failed:", data.error || data);
    process.exit(1);
  }
  const m = data.metrics || {};
  console.log(
    "✓ Health:",
    m.healthScore ?? "—",
    "| Checks:",
    m.totalChecks ?? 0,
    "| Orphan rate:",
    ((m.orphanRate ?? 0) * 100).toFixed(1) + "%"
  );
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
  const headers = opts.apikey ? { Authorization: `Bearer ${opts.apikey}` } : {};
  const { ok, data } = await fetchJSON(apiPath("/check"), {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!ok) {
    console.error("✗ Check failed:", data.error || data);
    process.exit(1);
  }
  if (data.allowed) {
    console.log("✓ Allowed");
    console.log("  decisionId:", data.decisionId);
  } else {
    console.log("✗ Blocked (" + data.reason + ")");
    console.log("  decisionId:", data.decisionId);
    if (data.explanation) console.log("  explanation:", data.explanation);
  }
}

async function cmdRecord(opts) {
  const userId = opts.userid;
  const decisionId = opts.decisionid;
  const actionType = opts.actiontype || "urgency";
  const outcome = opts.outcome || "executed";
  if (!userId || !decisionId) {
    console.error("Missing --userId and --decisionId");
    process.exit(1);
  }
  const body = { userId, decisionId, actionType, outcome };
  if (opts.tenantid) body.tenantId = opts.tenantid;
  const headers = opts.apikey ? { Authorization: `Bearer ${opts.apikey}` } : {};
  const { ok, data } = await fetchJSON(apiPath("/record"), {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!ok) {
    console.error("✗ Record failed:", data.error || data);
    process.exit(1);
  }
  console.log("✓ Recorded");
}

async function cmdTest(opts) {
  const userId = opts.userid || "cli_test_user";
  const actionType = opts.actiontype || "reminder";
  console.log("Running check...");
  const checkBody = {
    userId,
    actionType,
    ...(opts.surface ? { surface: opts.surface } : {})
  };
  const headers = opts.apikey ? { Authorization: `Bearer ${opts.apikey}` } : {};
  const checkRes = await fetchJSON(apiPath("/check"), {
    method: "POST",
    headers,
    body: JSON.stringify(checkBody)
  });
  if (!checkRes.ok || !checkRes.data.allowed) {
    console.error("✗ Check not allowed:", checkRes.data);
    process.exit(1);
  }
  console.log("✓ Allowed");
  console.log("  decisionId:", checkRes.data.decisionId);
  console.log("\nRecording outcome...");
  const rec = await fetchJSON(apiPath("/record"), {
    method: "POST",
    headers,
    body: JSON.stringify({
      userId,
      actionType,
      outcome: "executed",
      decisionId: checkRes.data.decisionId
    })
  });
  if (!rec.ok) {
    console.error("✗ Record failed:", rec.data);
    process.exit(1);
  }
  console.log("✓ Recorded");
  console.log("\n✓ Test passed (check → record)");
}

async function cmdPolicy(sub, opts) {
  const action = (sub || "show").toLowerCase();

  if (action === "validate") {
    const file = opts.file;
    if (!file) {
      console.error("Usage: governor policy validate --file policies/strict.json");
      process.exit(1);
    }
    const resolved = path.resolve(file);
    if (!fs.existsSync(resolved)) {
      console.error("✗ File not found:", resolved);
      process.exit(1);
    }
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(resolved, "utf8"));
    } catch (err) {
      console.error("✗ Invalid JSON:", err.message);
      process.exit(1);
    }
    try {
      validatePolicyObject(raw);
    } catch (err) {
      console.error("✗ Invalid policy:", err.message);
      process.exit(1);
    }
    console.log("✓ Policy valid:", resolved);
    return;
  }

  if (action === "show") {
    if (opts.file) {
      const resolved = path.resolve(opts.file);
      const raw = JSON.parse(fs.readFileSync(resolved, "utf8"));
      validatePolicyObject(raw);
      console.log(JSON.stringify({ source: resolved, policy: raw }, null, 2));
      return;
    }

    const preset =
      opts.preset || process.env.SOFTSTOP_POLICY || process.env.GOVERNOR_POLICY;
    const policyFile =
      process.env.SOFTSTOP_POLICY_FILE || process.env.GOVERNOR_POLICY_FILE;

    if (policyFile) {
      const resolved = path.resolve(policyFile);
      const raw = JSON.parse(fs.readFileSync(resolved, "utf8"));
      validatePolicyObject(raw);
      console.log(JSON.stringify({ source: resolved, policy: raw }, null, 2));
      return;
    }

    if (preset) {
      const resolved = resolvePresetPath(preset);
      const raw = JSON.parse(fs.readFileSync(resolved, "utf8"));
      validatePolicyObject(raw);
      console.log(JSON.stringify({ source: resolved, policy: raw }, null, 2));
      return;
    }

    try {
      const { ok, data } = await fetchJSON(apiPath("/policy"));
      if (ok && data.policy) {
        console.log(
          JSON.stringify({ source: data.source, policy: data.policy }, null, 2)
        );
        return;
      }
    } catch {
      /* server not running */
    }

    const resolved = resolvePresetPath("default");
    const raw = JSON.parse(fs.readFileSync(resolved, "utf8"));
    console.log(JSON.stringify({ source: resolved, policy: raw }, null, 2));
    return;
  }

  console.error("Unknown policy subcommand. Use: policy show | policy validate");
  process.exit(1);
}

function help() {
  console.log(`
SoftStop Pilot CLI

Usage:
  governor verify
  governor health
  governor check --userId X [opts]
  governor record --decisionId X --userId Y [opts]
  governor test [opts]
  governor policy show
  governor policy validate --file policies/strict.json

Environment:
  SOFTSTOP_API_URL / GOVERNOR_API_URL
  SOFTSTOP_POLICY / GOVERNOR_POLICY     default|strict|lenient
  SOFTSTOP_POLICY_FILE / GOVERNOR_POLICY_FILE

Examples:
  SOFTSTOP_POLICY=strict pnpm dev
  pnpm governor policy validate --file policies/strict.json
  pnpm governor policy show
`);
}

async function main() {
  const { cmd, sub, opts } = parseArgs();
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
      case "policy":
        await cmdPolicy(sub, opts);
        break;
      case "help":
      case "-h":
      case "--help":
        help();
        break;
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
