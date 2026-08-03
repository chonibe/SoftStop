/**
 * SoftStop sample shop — realistic escalation stacking.
 *
 * Simulates three systems that each push the same shopper:
 *   1. Abandoned-cart urgency email
 *   2. Upgrade / interrupt modal
 *   3. Flash-sale discount SMS
 *
 * Usage (SoftStop API must be running: `pnpm dev` from repo root):
 *   node index.js --mode=chaos      # no SoftStop — all three fire
 *   node index.js --mode=softstop   # SoftStop soft-stops stacking
 *   node index.js --mode=compare    # run both, then print /health
 */

const base =
  process.env.SOFTSTOP_API_URL ||
  process.env.GOVERNOR_API_URL ||
  "http://localhost:3000";

const userId = process.env.SOFTSTOP_DEMO_USER || `shopper_${Date.now()}`;

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

/** Fake product actions — in a real app these call Resend / UI / Twilio */
const actions = {
  async urgencyEmail() {
    console.log("  → SENT urgency email: “Cart expires in 2 hours”");
    return { channel: "email", actionType: "urgency" };
  },
  async interruptModal() {
    console.log("  → SHOWED interruption modal: “Upgrade to VIP now”");
    return { channel: "in-app", actionType: "interruption" };
  },
  async discountSms() {
    console.log("  → SENT discount SMS: “20% off — today only”");
    return { channel: "sms", actionType: "discount" };
  }
};

async function runChaos() {
  console.log("\n=== CHAOS (no SoftStop) ===");
  console.log(`userId=${userId}`);
  await actions.urgencyEmail();
  await actions.interruptModal();
  await actions.discountSms();
  console.log("Result: 3/3 escalations fired. User felt stacked pressure.\n");
  return { fired: 3, blocked: 0 };
}

async function withSoftStop(actionType, surface, fn) {
  const check = await post("/check", { userId, actionType, surface });
  if (!check.allowed) {
    await post("/record", {
      decisionId: check.decisionId,
      userId,
      actionType,
      outcome: "blocked",
      blockReason: check.reason
    });
    console.log(
      `  ✗ BLOCKED ${actionType} (${check.reason})` +
        (check.suggestedActionType
          ? ` — try ${check.suggestedActionType}`
          : "")
    );
    return { fired: false, reason: check.reason };
  }

  await fn();
  await post("/record", {
    decisionId: check.decisionId,
    userId,
    actionType,
    outcome: "executed"
  });
  return { fired: true };
}

async function runSoftStop() {
  console.log("\n=== SOFTSTOP (wired) ===");
  console.log(`userId=${userId}  api=${base}${prefix}`);
  let fired = 0;
  let blocked = 0;

  const steps = [
    ["urgency", "email", actions.urgencyEmail],
    ["interruption", "in-app", actions.interruptModal],
    ["discount", "sms", actions.discountSms]
  ];

  for (const [actionType, surface, fn] of steps) {
    const result = await withSoftStop(actionType, surface, fn);
    if (result.fired) fired += 1;
    else blocked += 1;
  }

  console.log(
    `Result: ${fired} fired, ${blocked} soft-stopped. Pressure capped by policy.\n`
  );
  return { fired, blocked };
}

async function printHealth() {
  const health = await get("/health?periodHours=1");
  const m = health.metrics || {};
  console.log("=== SoftStop /health (last 1h) ===");
  console.log(
    JSON.stringify(
      {
        totalChecks: m.totalChecks,
        totalOutcomes: m.totalOutcomes,
        orphanRate: m.orphanRate,
        blockRate: m.blockRate,
        healthScore: m.healthScore,
        actionTypeDistribution: m.actionTypeDistribution
      },
      null,
      2
    )
  );
  console.log(
    "\nAdoption tip: orphanRate should stay low (<0.05). Every check needs a matching record."
  );
}

async function main() {
  const mode =
    (process.argv.find((a) => a.startsWith("--mode=")) || "--mode=compare").split(
      "="
    )[1] || "compare";

  try {
    await get("/health");
  } catch {
    console.error(
      `Cannot reach SoftStop at ${base}. Start it with: pnpm dev`
    );
    process.exit(1);
  }

  if (mode === "chaos") {
    await runChaos();
    return;
  }
  if (mode === "softstop") {
    await runSoftStop();
    await printHealth();
    return;
  }

  await runChaos();
  await runSoftStop();
  await printHealth();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
