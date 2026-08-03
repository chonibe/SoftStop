import { randomUUID } from "crypto";
import { toolId } from "./context";
import { allowDecision, denyDecision, escalateDecision, type GovernorDecision } from "./decisions";
import type { GovernorPolicy } from "./policies";
import type { AuthorizeRequest } from "./types";

export interface GovernorConfig {
  policies: GovernorPolicy[];
}

export interface Governor {
  authorize(request: AuthorizeRequest): Promise<GovernorDecision>;
}

export const createGovernor = (config: GovernorConfig): Governor => ({
  async authorize(request) {
    const id = toolId(request);

    for (const policy of config.policies) {
      const match = policy.match;
      const matchesTool = match.tool === id || match.tool === request.tool.name;
      const matchesTools = match.tools?.includes(id) || match.tools?.includes(request.tool.name);
      const matchesRisk = match.toolRisk && match.toolRisk === request.tool.risk;

      if (!matchesTool && !matchesTools && !matchesRisk) {
        continue;
      }

      if (policy.condition && !policy.condition(request)) {
        continue;
      }

      if (policy.action === "deny") {
        return denyDecision("policy_denied", policy.name);
      }

      if (policy.action === "escalate" || policy.require?.approval) {
        return escalateDecision("approval_required", policy.name, `esc_${randomUUID()}`);
      }

      if (policy.limit) {
        return allowDecision(policy.name);
      }
    }

    return allowDecision();
  }
});
