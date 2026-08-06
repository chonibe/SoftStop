import type { DecisionAction } from "./types";

export interface GovernorDecision {
  allowed: boolean;
  action: DecisionAction;
  reason: string;
  policy?: string;
  retryAfter?: string;
  escalationId?: string;
  metadata?: Record<string, unknown>;
}

export const allowDecision = (policy?: string): GovernorDecision => ({
  allowed: true,
  action: "allow",
  reason: "allowed",
  policy
});

export const denyDecision = (
  reason: string,
  policy?: string,
  metadata?: Record<string, unknown>
): GovernorDecision => ({
  allowed: false,
  action: "deny",
  reason,
  policy,
  metadata
});

export const escalateDecision = (
  reason: string,
  policy?: string,
  escalationId?: string,
  metadata?: Record<string, unknown>
): GovernorDecision => ({
  allowed: false,
  action: "escalate",
  reason,
  policy,
  escalationId,
  metadata
});
