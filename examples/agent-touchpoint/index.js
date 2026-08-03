/**
 * SoftStop agent touchpoint — call check/record before escalating a user.
 * Run SoftStop: pnpm dev (repo root). Then: node index.js
 */

const base =
  process.env.SOFTSTOP_API_URL ||
  process.env.GOVERNOR_API_URL ||
  "http://localhost:3000";

function prefix(url) {
  try {
    const host = new URL(url).hostname;
    return /localhost|127\.0\.0\.1/.test(host) ? "/v1" : "/api";
  } catch {
    return "/v1";
  }
}

async function agentEscalateUser({ userId, actionType, surface, escalate }) {
  const p = prefix(base);
  const check = await fetch(`${base}${p}/check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, actionType, surface })
  }).then((r) => r.json());

  if (!check.allowed) {
    await fetch(`${base}${p}/record`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        decisionId: check.decisionId,
        userId,
        actionType,
        outcome: "blocked",
        blockReason: check.reason
      })
    });
    return { ok: false, reason: check.reason, suggested: check.suggestedActionType };
  }

  await escalate();

  await fetch(`${base}${p}/record`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      decisionId: check.decisionId,
      userId,
      actionType,
      outcome: "executed"
    })
  });

  return { ok: true };
}

async function main() {
  const result = await agentEscalateUser({
    userId: "demo_agent_user",
    actionType: "discount",
    surface: "sms",
    escalate: async () => {
      console.log("Agent would send promo SMS here");
    }
  });
  console.log(result);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
