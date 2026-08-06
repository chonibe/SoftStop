import { describe, expect, it } from "vitest";
import { createGovernor } from "@governor/core";
import { runGovernedTool } from "./mcp";

const request = {
  actor: { id: "agent_1", type: "agent" as const },
  tool: { server: "github", name: "delete_repo", risk: "critical" as const },
  context: { tenantId: "acme", environment: "production" as const }
};

describe("runGovernedTool", () => {
  it("does not execute denied tools", async () => {
    let executed = false;
    const governor = createGovernor({
      policies: [
        {
          name: "block-delete",
          match: { tool: "github.delete_repo" },
          action: "deny"
        }
      ]
    });

    const result = await runGovernedTool(governor, request, async () => {
      executed = true;
      return "deleted";
    });

    expect(executed).toBe(false);
    expect(result.error).toMatchObject({ code: "governor_denied" });
  });

  it("executes allowed tools", async () => {
    const governor = createGovernor({ policies: [] });
    const result = await runGovernedTool(governor, request, async () => "ok");

    expect(result.result).toBe("ok");
    expect(result.decision.allowed).toBe(true);
  });
});
