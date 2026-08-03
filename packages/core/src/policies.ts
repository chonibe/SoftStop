import type { AuthorizeRequest, DecisionAction, PolicyWindow, ToolRisk } from "./types";

export interface PolicyMatch {
  tool?: string;
  tools?: string[];
  toolRisk?: ToolRisk;
}

export interface LimitRule {
  count: number;
  window: PolicyWindow;
}

export interface RequireRule {
  approval?: boolean;
}

export interface GovernorPolicy {
  name: string;
  match: PolicyMatch;
  action?: DecisionAction;
  limit?: LimitRule;
  require?: RequireRule;
  condition?: (request: AuthorizeRequest) => boolean;
}
