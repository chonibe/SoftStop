#!/usr/bin/env node
/**
 * Governor Tenet Check
 * Enforces TENETS.md policy on Core code (governor/api/src, packages/api/src).
 * Required markers (for CI integrity check): FORBIDDEN_IMPORT, FORBIDDEN_FUNCTION,
 * TENET_VIOLATION, TENET CHECK FAILED, DYNAMIC_IMPORT_EVASION
 */

const fs = require("fs");
const path = require("path");

const FORBIDDEN_IMPORT = /from\s+['"].*?(?:ecosystem|gateway|sendgrid|twilio|postmark|mailchimp|nodemailer|resend)/;
const FORBIDDEN_FUNCTION = /\b(?:eval|Function)\s*\(/;
const DYNAMIC_IMPORT_EVASION = /(?:await\s+)?import\s*\(\s*[^'"\s]|require\s*\(\s*[^'"\s]/;

const CORE_DIRS = ["governor/api/src", "packages/api/src"].filter((d) =>
  fs.existsSync(path.join(process.cwd(), d))
);

function collectFiles(dir, ext = /\.(ts|tsx|js|jsx)$/) {
  const results = [];
  const full = path.join(process.cwd(), dir);
  if (!fs.existsSync(full)) return results;
  const entries = fs.readdirSync(full, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(full, e.name);
    if (e.isDirectory()) results.push(...collectFiles(path.join(dir, e.name), ext));
    else if (ext.test(e.name)) results.push(p);
  }
  return results;
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const rel = path.relative(process.cwd(), filePath);
  const violations = [];

  if (FORBIDDEN_IMPORT.test(content)) {
    violations.push({ rule: "FORBIDDEN_IMPORT", msg: "Core must not import from ecosystem/sendgrid/twilio/postmark/mailchimp/nodemailer/resend" });
  }
  if (FORBIDDEN_FUNCTION.test(content)) {
    violations.push({ rule: "FORBIDDEN_FUNCTION", msg: "eval/Function not allowed in Core" });
  }
  if (DYNAMIC_IMPORT_EVASION.test(content)) {
    violations.push({ rule: "DYNAMIC_IMPORT_EVASION", msg: "Dynamic import/require with variable may evade static checks" });
  }

  return violations.map((v) => ({ file: rel, ...v }));
}

function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose");
  const all = args.includes("--all");
  const filesArg = args.find((a) => a.startsWith("--files=")) || (args[0] === "--files" && args[1]);
  const filesList = filesArg ? (filesArg.includes("=") ? filesArg.split("=")[1] : args[1]) : null;

  let files = [];
  if (all) {
    for (const dir of CORE_DIRS) {
      files.push(...collectFiles(dir));
    }
  } else if (filesList) {
    files = filesList.split(",").map((f) => path.resolve(f.trim())).filter((f) => fs.existsSync(f));
  }

  const allViolations = [];
  for (const f of files) {
    const v = checkFile(f);
    allViolations.push(...v);
  }

  if (allViolations.length > 0) {
    console.error("TENET_VIOLATION: Governor Core tenet check found violations.");
    allViolations.forEach((v) => {
      console.error(`  ${v.file}: [${v.rule}] ${v.msg}`);
    });
    console.error("\nTENET CHECK FAILED");
    process.exit(1);
  }

  if (verbose && files.length) {
    console.log("Tenet check passed for", files.length, "file(s).");
  }
  console.log("✅ Tenet check passed");
}

main();
