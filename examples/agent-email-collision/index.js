/**
 * SoftStop golden path: sales agent email + marketing SMS on the same human.
 *
 * Shows numeric user pressure. Fake sends only (no Resend).
 *
 * Usage (SoftStop API must be running: `pnpm dev` from repo root):
 *   node index.js
 */

const base =
  process.env.SOFTSTOP_API_URL ||
  process.env.GOVERNOR_API_URL ||
  "http://localhost:3000";

const userId = process.env.SOFTSTOP_DEMO_USER || `lead_${Date.now()}`;

function apiPrefix(url) {
  try {
    const host = new URL(url).hostname;
    return /localhost|127\.0\.0\.1/.test(host) ? "/v1" : "/api";
  } catch {
    return "/v1";
  }
}

const prefix = apiPrefix(base);

async function post(path, body) {
  const res = await fetch(`${base}${prefix}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`${path} failed: ${JSON.stringify(data)}`);
  }
  return data;
}

async function get(path) {
  const res = await fetch(`${base}${prefix}${path}`);
  return res.json();
}

function printPressure(label, check) {
  console.log(
    `  [${label}] pressure=${check.pressure} cost=${check.cost} projected=${check.projectedPressure} threshold=${check.threshold} → ${check.allowed ? "ALLOW" : "BLOCK " + check.reason}`
  );
}

async function contact(actor, actionType, surface, fakeSend) {
  const check = await post("/check", {
    userId,
    actionType,
    surface,
    context: { actor }
  });
  printPressure(actor, check);

  if (!check.allowed) {
    await post("/record", {
      decisionId: check.decisionId,
      userId,
      actionType,
      outcome: "blocked",
      blockReason: check.reason,
      context: { actor }
    });
    console.log(`  ✗ ${actor} did not send (${check.reason})\n`);
    return { allowed: false, reason: check.reason };
  }

  fakeSend();
  await post("/record", {
    decisionId: check.decisionId,
    userId,
    actionType,
    outcome: "executed",
    context: { actor }
  });
  console.log(`  ✓ ${actor} sent\n`);
  return { allowed: true };
}

async function main() {
  try {
    await get("/health");
  } catch {
    console.error(`Cannot reach SoftStop at ${base}. Start it with: pnpm dev`);
    process.exit(1);
  }

  console.log("=== SoftStop agent + email collision ===");
  console.log(`userId=${userId}`);
  console.log(`api=${base}${prefix}\n`);

  // Sales agent: high-pressure urgency email (+40)
  await contact("sales-agent", "urgency", "email", () => {
    console.log('  → FAKE email: “Quick follow-up — pricing expires tonight”');
  });

  let status = await get(`/users/${encodeURIComponent(userId)}/pressure`);
  console.log(
    `Current pressure: ${status.pressure} / ${status.threshold} (decay ${status.decayPerHour}/h)\n`
  );

  // Marketing automation: discount SMS (+30) — may still allow under threshold
  await contact("marketing-automation", "discount", "sms", () => {
    console.log('  → FAKE SMS: “20% off — today only”');
  });

  status = await get(`/users/${encodeURIComponent(userId)}/pressure`);
  console.log(
    `Current pressure: ${status.pressure} / ${status.threshold}\n`
  );

  // Support bot: interruption (+25) — may hit pressure or stacking
  await contact("support-bot", "interruption", "in-app", () => {
    console.log('  → FAKE modal: “Still need help with checkout?”');
  });

  status = await get(`/users/${encodeURIComponent(userId)}/pressure`);
  console.log("=== Final ===");
  console.log(JSON.stringify(status, null, 2));
  console.log(
    "\nTip: with default costs (40+30+25=95), a fourth high-cost hit often returns pressure_exceeded."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
