/**
 * SoftStop agent touchpoint — beforeContact before escalating a user.
 * Run SoftStop: pnpm dev (repo root). Then: node index.js
 */

const { SoftStop } = require("../../packages/sdk-js/dist/index.cjs");

const base =
  process.env.SOFTSTOP_API_URL ||
  process.env.GOVERNOR_API_URL ||
  "http://localhost:3000";

async function main() {
  const ss = new SoftStop({ url: base });

  const result = await ss.beforeContact(
    {
      userId: "demo_agent_user",
      actionType: "discount",
      surface: "sms",
      actor: "support-agent"
    },
    async () => {
      console.log("Agent would send promo SMS here");
      return { channel: "sms" };
    }
  );

  if (!result.allowed) {
    console.log("Blocked:", result.decision.reason, result.suggestedActionType);
    return;
  }

  console.log("Allowed:", result.result, "pressure", result.decision.pressure);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
