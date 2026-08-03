import { describe, expect, it } from "vitest";
import { createGovernor } from "./engine";
import type { AuthorizeRequest } from "./types";

const baseRequest: AuthorizeRequest = {
  actor: {
    id: "support_bot_v2",
    type: "agent"
  },
  tool: {
    server: "gmail",
    name: "send",
    risk: "medium",
    arguments: {
      to: "customer@example.com"
    }
  },
  context: {
    tenantId: "acme",
    environment: "production"
  }
};

describe("createGovernor", () => {
  it("denies matching tools", async () => {
    const governor = createGovernor({
      policies: [
        {
          name: "block-email",
          match: { tool: "gmail.send" },
          action: "deny"
        }
      ]
    });

    await expect(governor.authorize(baseRequest)).resolves.toMatchObject({
      allowed: false,
      action: "deny",
      policy: "block-email"
    });
  });

  it("escalates requests that require approval", async () => {
    const governor = createGovernor({
      policies: [
        {
          name: "approval-for-medium-tools",
          match: { toolRisk: "medium" },
          require: { approval: true }
        }
      ]
    });

    const decision = await governor.authorize(baseRequest);

    expect(decision).toMatchObject({
      allowed: false,
      action: "escalate",
      policy: "approval-for-medium-tools"
    });
    expect(decision.escalationId).toMatch(/^esc_/);
  });

  it("supports argument-aware policy conditions", async () => {
    const governor = createGovernor({
      policies: [
        {
          name: "external-email-approval",
          match: { tool: "gmail.send" },
          require: { approval: true },
          condition: (request) => {
            return String(request.tool.arguments?.to ?? "").endsWith("@external.com");
          }
        }
      ]
    });

    await expect(governor.authorize(baseRequest)).resolves.toMatchObject({
      allowed: true,
      action: "allow"
    });

    await expect(
      governor.authorize({
        ...baseRequest,
        tool: {
          ...baseRequest.tool,
          arguments: { to: "competitor@external.com" }
        }
      })
    ).resolves.toMatchObject({
      allowed: false,
      action: "escalate",
      policy: "external-email-approval"
    });
  });
});
