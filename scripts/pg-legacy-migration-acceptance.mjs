#!/usr/bin/env node
/**
 * Migration safety on legacy-shaped data (pre-005).
 *
 * Seeds nullable/incomplete rows as they looked before decision lifecycle,
 * applies 001→005, then verifies RPCs work without manual cleanup.
 *
 * Usage:
 *   DATABASE_URL=postgres:///softstop_legacy_mig node scripts/pg-legacy-migration-acceptance.mjs
 */
import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS = path.join(ROOT, "governor/api/db/migrations");

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

function psql(url, sql) {
  return execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-tAc", sql], {
    encoding: "utf8"
  }).trim();
}

function ensureDb(url) {
  const m = url.match(/postgres(?:ql)?:\/\/\/([^/?]+)/);
  if (!m) return;
  const db = m[1];
  const exists = execFileSync(
    "psql",
    [
      "postgres:///postgres",
      "-tAc",
      `SELECT 1 FROM pg_database WHERE datname='${db.replace(/'/g, "''")}'`
    ],
    { encoding: "utf8" }
  ).trim();
  if (!exists) {
    execFileSync("createdb", [db], { encoding: "utf8" });
    console.log("created database", db);
  }
}

function resetSchema(url) {
  psql(
    url,
    `DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;`
  );
}

function applyFile(url, file) {
  const r = spawnSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-f", file], {
    encoding: "utf8"
  });
  if (r.status !== 0) {
    throw new Error(`Failed ${file}: ${r.stderr || r.stdout}`);
  }
  console.log("applied", path.basename(file));
}

function lit(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

ensureDb(databaseUrl);
resetSchema(databaseUrl);

const files = fs
  .readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const early = files.filter(
  (f) => !f.startsWith("005") && !f.startsWith("006")
);
const late = files.filter(
  (f) => f.startsWith("005") || f.startsWith("006")
);

for (const f of early) {
  applyFile(databaseUrl, path.join(MIGRATIONS, f));
}

const orphanDecision = randomUUID();
psql(
  databaseUrl,
  `
  INSERT INTO governor_user_state (tenant_id, user_id, state, updated_at)
  VALUES
    ('default', 'legacy_a', '{"pressure":12}'::jsonb, now()),
    ('default', 'legacy_b', '{"cooldowns":{},"windows":{}}'::jsonb, now()),
    ('default', 'legacy_c', '{"pressure":0,"pressureUpdatedAt":null}'::jsonb, now());

  INSERT INTO governor_events (user_id, action_type, event_type, decision_id, context, tenant_id)
  VALUES
    ('legacy_a', 'urgency', 'check', NULL, '{"legacy":true}'::jsonb, 'default'),
    ('legacy_a', 'urgency', 'executed', NULL, NULL, 'default'),
    ('legacy_b', 'reminder', 'check', ${lit(orphanDecision)}::uuid, '{}'::jsonb, 'default');
  `
);
console.log("seeded legacy-shaped rows");

for (const f of late) {
  applyFile(databaseUrl, path.join(MIGRATIONS, f));
}

const procs = psql(
  databaseUrl,
  `SELECT string_agg(proname, ',' ORDER BY proname) FROM pg_proc WHERE proname LIKE 'softstop_%'`
);
if (
  !procs.includes("softstop_check_and_reserve") ||
  !procs.includes("softstop_record_decision")
) {
  throw new Error("RPCs missing after 005: " + procs);
}

const legacyCount = Number(
  psql(
    databaseUrl,
    `SELECT count(*) FROM governor_user_state WHERE user_id LIKE 'legacy_%'`
  )
);
if (legacyCount !== 3) throw new Error("legacy rows lost: " + legacyCount);

const decisionId = randomUUID();
const expiresAt = new Date(Date.now() + 30_000).toISOString();
const nextState = {
  cooldowns: {},
  lastActionAt: {},
  lastAnyEscalationAt: null,
  windows: {},
  pressure: 12,
  pressureUpdatedAt: new Date().toISOString(),
  stateVersion: expectedVersionPlusOne(),
  reserves: [{ decisionId, actionType: "urgency", cost: 40, expiresAt }]
};

function expectedVersionPlusOne() {
  return 1;
}

const expectedVersion = Number(
  psql(
    databaseUrl,
    `SELECT coalesce((state->>'stateVersion')::int, 0)
     FROM governor_user_state WHERE tenant_id='default' AND user_id='legacy_a'`
  )
);
nextState.stateVersion = expectedVersion + 1;

const reserve = JSON.parse(
  psql(
    databaseUrl,
    `SELECT softstop_check_and_reserve(
      'default', 'legacy_a', ${lit(decisionId)}::uuid, 'urgency',
      ${expectedVersion},
      ${lit(JSON.stringify(nextState))}::jsonb,
      '{}'::jsonb, ${lit(expiresAt)}::timestamptz, 40
    )::text;`
  )
);
if (!reserve.ok) {
  throw new Error("reserve failed after migrate: " + JSON.stringify(reserve));
}

const executedState = {
  ...nextState,
  pressure: 52,
  stateVersion: nextState.stateVersion + 1,
  reserves: []
};
const record = JSON.parse(
  psql(
    databaseUrl,
    `SELECT softstop_record_decision(
      'default', 'legacy_a', ${lit(decisionId)}::uuid, 'urgency', 'executed', ${nextState.stateVersion},
      ${lit(JSON.stringify(executedState))}::jsonb,
      '{}'::jsonb
    )::text;`
  )
);
if (!record.ok) {
  throw new Error("record failed after migrate: " + JSON.stringify(record));
}

const status = psql(
  databaseUrl,
  `SELECT status FROM softstop_decisions WHERE decision_id=${lit(decisionId)}::uuid`
);
if (status !== "executed") throw new Error("expected executed, got " + status);

console.log("legacy migration acceptance OK");
