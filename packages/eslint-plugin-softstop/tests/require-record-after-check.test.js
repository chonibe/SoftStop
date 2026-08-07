"use strict";

const { RuleTester } = require("eslint");
const rule = require("../lib/rules/require-record-after-check");

const tester = new RuleTester({
  parserOptions: { ecmaVersion: 2022, sourceType: "module" }
});

tester.run("require-record-after-check", rule, {
  valid: [
    {
      name: "beforeContact wraps the escalation",
      code: `
        import { SoftStop } from 'softstop';
        const ss = new SoftStop({ url: 'http://localhost:3000' });
        export async function sendPromo(userId) {
          return ss.beforeContact(
            { userId, actionType: 'urgency', surface: 'email' },
            () => sendEmail(userId)
          );
        }
      `
    },
    {
      name: "withSoftStop wraps the escalation",
      code: `
        import { SoftStop, withSoftStop } from 'softstop';
        const ss = new SoftStop();
        export const tool = withSoftStop(ss, { userId: 'u1', actionType: 'reminder' }, handler);
      `
    },
    {
      name: "check in try/finally with record",
      code: `
        async function escalate(ss, userId) {
          const decision = await ss.check({ userId, actionType: 'urgency' });
          try {
            if (!decision.allowed) return;
            await sendEmail(userId);
          } finally {
            await ss.record({
              decisionId: decision.decisionId,
              userId,
              actionType: 'urgency',
              outcome: decision.allowed ? 'executed' : 'blocked',
              blockReason: decision.reason
            });
          }
        }
      `
    },
    {
      name: "blocked path records without bare orphan check",
      code: `
        async function escalate(client, userId) {
          const decision = await client.check({ userId, actionType: 'reminder' });
          if (!decision.allowed) {
            await client.record({
              decisionId: decision.decisionId,
              userId,
              actionType: 'reminder',
              outcome: 'blocked',
              blockReason: decision.reason
            });
            return;
          }
          try {
            await sendSms(userId);
          } finally {
            await client.record({
              decisionId: decision.decisionId,
              userId,
              actionType: 'reminder',
              outcome: 'executed'
            });
          }
        }
      `
    }
  ],
  invalid: [
    {
      name: "bare check with no record",
      code: `
        async function escalate(ss, userId) {
          const decision = await ss.check({ userId, actionType: 'urgency' });
          if (decision.allowed) await sendEmail(userId);
        }
      `,
      errors: [{ messageId: "missingRecord" }]
    },
    {
      name: "check then send without record",
      code: `
        export async function nudge(client, userId) {
          await client.check({ userId, actionType: 'interruption' });
          await showModal(userId);
        }
      `,
      errors: [{ messageId: "missingRecord" }]
    }
  ]
});
