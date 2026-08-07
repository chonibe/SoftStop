#!/usr/bin/env node
/**
 * Validate SoftStop SQL migrations are present and syntactically sane enough
 * for CI (balanced dollars, CREATE FUNCTION / TABLE markers).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(
  __dirname,
  "../governor/api/db/migrations"
);

const required = [
  "001_init.sql",
  "003_tenants.sql",
  "004_api_keys.sql",
  "005_decision_lifecycle_and_scopes.sql",
  "006_advisory_lock_release_and_decision_binding.sql"
];

if (!fs.existsSync(migrationsDir)) {
  console.error("Missing migrations dir:", migrationsDir);
  process.exit(1);
}

const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
for (const req of required) {
  if (!files.includes(req)) {
    console.error("Missing required migration:", req);
    process.exit(1);
  }
}

for (const file of files.sort()) {
  const full = path.join(migrationsDir, file);
  const sql = fs.readFileSync(full, "utf8");
  if (!sql.trim()) {
    console.error("Empty migration:", file);
    process.exit(1);
  }
  const dollars = (sql.match(/\$\$/g) || []).length;
  if (dollars % 2 !== 0) {
    console.error("Unbalanced $$ in", file);
    process.exit(1);
  }
  if (file.startsWith("005") && !sql.includes("softstop_check_and_reserve")) {
    console.error("005 must define softstop_check_and_reserve");
    process.exit(1);
  }
  if (file.startsWith("005") && !sql.includes("softstop_record_decision")) {
    console.error("005 must define softstop_record_decision");
    process.exit(1);
  }
  if (file.startsWith("006") && !sql.includes("pg_advisory_xact_lock")) {
    console.error("006 must use pg_advisory_xact_lock for first-row race");
    process.exit(1);
  }
  if (file.startsWith("006") && !sql.includes("'released'")) {
    console.error("006 must allow released outcome");
    process.exit(1);
  }
  if (file.startsWith("006") && !sql.includes("decision_mismatch")) {
    console.error("006 must reject decision_mismatch");
    process.exit(1);
  }
  console.log("ok", file, `(${sql.length} bytes)`);
}

console.log("Migration validation passed.");
