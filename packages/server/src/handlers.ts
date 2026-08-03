import { randomUUID } from "crypto";
import type { Governor, AuthorizeRequest } from "@governor/core";
import type { GovernorStorage } from "@governor/storage";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

export const isAuthorizeRequest = (value: unknown): value is AuthorizeRequest => {
  if (!isRecord(value) || !isRecord(value.actor) || !isRecord(value.tool) || !isRecord(value.context)) {
    return false;
  }

  return (
    typeof value.actor.id === "string" &&
    typeof value.tool.name === "string" &&
    typeof value.context.tenantId === "string" &&
    typeof value.context.environment === "string"
  );
};

export const handleAuthorize = async (
  governor: Governor,
  request: unknown,
  storage?: GovernorStorage
): Promise<{ status: number; body: unknown }> => {
  if (!isAuthorizeRequest(request)) {
    return {
      status: 400,
      body: {
        error: "invalid_authorization_request",
        message: "Expected actor.id, tool.name, context.tenantId, and context.environment."
      }
    };
  }

  const decision = await governor.authorize(request);
  const decisionId = `dec_${randomUUID()}`;

  if (storage) {
    await storage.recordDecision({
      id: decisionId,
      request,
      decision,
      createdAt: new Date().toISOString()
    });
  }

  return {
    status: 200,
    body: {
      ...decision,
      decisionId
    }
  };
};

export const handleDecisionList = async (
  storage: GovernorStorage | undefined,
  tenantId: string,
  limit?: number
): Promise<{ status: number; body: unknown }> => {
  if (!storage?.listDecisions) {
    return {
      status: 501,
      body: { error: "decision_storage_not_configured" }
    };
  }

  const decisions = await storage.listDecisions({ tenantId, limit });
  return {
    status: 200,
    body: { decisions }
  };
};
