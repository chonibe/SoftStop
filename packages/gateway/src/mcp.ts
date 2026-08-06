import type { AuthorizeRequest, Governor, GovernorDecision, ToolRisk } from "@governor/core";

/**
 * Experimental MCP helper — not the v0.1 pressure product.
 * Prefer check/record against the governor HTTP API for escalation permits.
 */

export interface McpToolDescriptor {
  name: string;
  server?: string;
  risk?: ToolRisk;
}

export interface GovernedToolResult<T> {
  decision: GovernorDecision;
  result?: T;
  error?: {
    code: "governor_denied" | "governor_pending_approval";
    message: string;
    escalationId?: string;
  };
}

export const runGovernedTool = async <T>(
  governor: Governor,
  request: AuthorizeRequest,
  execute: () => Promise<T>
): Promise<GovernedToolResult<T>> => {
  const decision = await governor.authorize(request);

  if (decision.action === "deny") {
    return {
      decision,
      error: {
        code: "governor_denied",
        message: decision.reason
      }
    };
  }

  if (decision.action === "escalate") {
    return {
      decision,
      error: {
        code: "governor_pending_approval",
        message: decision.reason,
        escalationId: decision.escalationId
      }
    };
  }

  return {
    decision,
    result: await execute()
  };
};
