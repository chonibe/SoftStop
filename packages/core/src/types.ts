export type ToolRisk = "low" | "medium" | "high" | "critical";
export type DecisionAction = "allow" | "deny" | "escalate";
export type PolicyWindow = "minute" | "hourly" | "daily";

export interface ActorContext {
  id: string;
  type?: "agent" | "user" | "system" | "service";
  tenantId?: string;
  roles?: string[];
}

export interface ToolContext {
  name: string;
  server?: string;
  risk?: ToolRisk;
  arguments?: Record<string, unknown>;
}

export interface AuthorizationContext {
  tenantId: string;
  environment: "development" | "staging" | "production";
  metadata?: Record<string, unknown>;
}

export interface AuthorizeRequest {
  actor: ActorContext;
  tool: ToolContext;
  context: AuthorizationContext;
}
