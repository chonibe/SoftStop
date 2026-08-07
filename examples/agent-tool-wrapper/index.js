/**
 * Framework-agnostic agent tool wrapper + withSoftStop.
 *
 * Pattern: wrap any user-facing tool (email, SMS, notify) so SoftStop
 * runs before the side effect. Drop this into OpenAI tools, LangChain,
 * Mastra, Vercel AI SDK tool({ execute }), or plain handlers.
 *
 * Run SoftStop: pnpm dev. Then: node index.js
 */

const {
  SoftStop,
  wrapUserFacingTool,
  withSoftStop,
  formatBlockedForLlm
} = require("../../packages/sdk-js/dist/index.cjs");

const base =
  process.env.SOFTSTOP_API_URL ||
  process.env.GOVERNOR_API_URL ||
  "http://localhost:3000";

const ss = new SoftStop({ url: base });

/** Fake send — replace with Resend / Twilio / etc. */
async function sendFollowUpEmail({ userId, subject }) {
  console.log(`  → FAKE email to ${userId}: ${subject}`);
  return { messageId: `msg_${Date.now()}` };
}

const sendFollowUp = wrapUserFacingTool(
  ss,
  {
    userId: (args) => String(args.userId),
    actionType: "urgency",
    surface: "email",
    actor: "openai-style-agent"
  },
  sendFollowUpEmail
);

/** Same gate shaped for Vercel AI SDK: tool({ execute: withSoftStop(...) }) */
const executeFollowUp = withSoftStop(sendFollowUpEmail, {
  client: ss,
  userId: (args) => String(args.userId),
  actionType: "urgency",
  surface: "email",
  actor: "vercel-ai-style-agent"
});

async function main() {
  const userId = process.env.SOFTSTOP_DEMO_USER || `tool_user_${Date.now()}`;

  console.log("=== wrapUserFacingTool ===");
  console.log(`userId=${userId}\n`);

  const first = await sendFollowUp({
    userId,
    subject: "Quick follow-up on your trial"
  });
  console.log("first:", first.ok ? "sent" : first.reason, first.decision?.pressure);

  const second = await sendFollowUp({
    userId,
    subject: "Still interested?"
  });
  console.log(
    "second:",
    second.ok ? "sent" : `${second.reason} (blocked)`,
    second.decision?.pressure ?? second.decision?.projectedPressure
  );
  if (!second.ok) {
    console.log("  LLM payload:", formatBlockedForLlm(second.decision));
  }

  console.log("\n=== withSoftStop (execute-shaped) ===");
  const userId2 = `${userId}_ws`;
  const a = await executeFollowUp({
    userId: userId2,
    subject: "First withSoftStop send"
  });
  console.log("first:", typeof a === "string" ? a : a);
  const b = await executeFollowUp({
    userId: userId2,
    subject: "Second withSoftStop send"
  });
  console.log("second:", typeof b === "string" ? b : b);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
