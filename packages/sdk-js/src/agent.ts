import type {
  ActionType,
  CheckRequest,
  CheckResponse,
  SoftStopClient,
  Surface
} from "./types";

export type BeforeContactRequest = CheckRequest & {
  /** Optional actor id for audit context (e.g. sales-agent). */
  actor?: string;
};

export type BeforeContactAllowed<T> = {
  allowed: true;
  result: T;
  decision: CheckResponse;
};

export type BeforeContactBlocked = {
  allowed: false;
  decision: CheckResponse;
  suggestedActionType?: ActionType;
};

export type BeforeContactResult<T> = BeforeContactAllowed<T> | BeforeContactBlocked;

/**
 * Gate a user-facing escalation: check → run → record executed,
 * or record blocked and skip the run.
 */
export async function beforeContact<T>(
  client: SoftStopClient,
  request: BeforeContactRequest,
  run: () => Promise<T> | T
): Promise<BeforeContactResult<T>> {
  const { actor, context, ...checkFields } = request;
  const decision = await client.check({
    ...checkFields,
    context: {
      ...(context ?? {}),
      ...(actor ? { actor } : {})
    }
  });

  if (!decision.allowed) {
    await client.record({
      decisionId: decision.decisionId,
      userId: request.userId,
      actionType: request.actionType,
      outcome: "blocked",
      blockReason: decision.reason,
      context: actor ? { actor } : undefined
    });
    return {
      allowed: false,
      decision,
      suggestedActionType: decision.suggestedActionType
    };
  }

  const result = await run();

  // Explicit fail_open unavailable allow — no server decisionId; never invent a record.
  if (decision.reason === "softstop_unavailable") {
    return { allowed: true, result, decision };
  }

  await client.record({
    decisionId: decision.decisionId,
    userId: request.userId,
    actionType: request.actionType,
    outcome: "executed",
    context: actor ? { actor } : undefined
  });

  return { allowed: true, result, decision };
}

export type UserFacingToolConfig = {
  userId: string | ((args: Record<string, unknown>) => string);
  actionType: ActionType;
  surface?: Surface;
  actor?: string;
};

/**
 * Wrap a tool/function that contacts a human so SoftStop runs first.
 * Framework-agnostic: OpenAI tools, LangChain tools, plain handlers.
 */
export function wrapUserFacingTool<TArgs extends Record<string, unknown>, TResult>(
  client: SoftStopClient,
  config: UserFacingToolConfig,
  handler: (args: TArgs) => Promise<TResult> | TResult
): (args: TArgs) => Promise<
  | { ok: true; result: TResult; decision: CheckResponse }
  | { ok: false; reason: string; decision: CheckResponse; suggestedActionType?: ActionType }
> {
  return async (args: TArgs) => {
    const userId =
      typeof config.userId === "function" ? config.userId(args) : config.userId;
    const gated = await beforeContact(
      client,
      {
        userId,
        actionType: config.actionType,
        surface: config.surface,
        actor: config.actor,
        context: { toolArgs: args }
      },
      () => handler(args)
    );

    if (!gated.allowed) {
      return {
        ok: false,
        reason: gated.decision.reason,
        decision: gated.decision,
        suggestedActionType: gated.suggestedActionType
      };
    }

    return { ok: true, result: gated.result, decision: gated.decision };
  };
}

/**
 * Stable JSON string for LLM / tool-result context when SoftStop blocks.
 * Omits pressure internals and decisionId — steers the model, not the journal.
 */
export function formatBlockedForLlm(decision: CheckResponse): string {
  const payload: Record<string, unknown> = {
    blocked: true,
    reason: decision.reason
  };
  if (decision.explanation != null) payload.explanation = decision.explanation;
  if (decision.suggestedActionType != null) {
    payload.suggestedActionType = decision.suggestedActionType;
  }
  if (decision.suggestedFallback != null) {
    payload.suggestedFallback = decision.suggestedFallback;
  }
  if (decision.retryAfterMs != null) payload.retryAfterMs = decision.retryAfterMs;
  return JSON.stringify(payload);
}

export type WithSoftStopConfig = UserFacingToolConfig & {
  client: SoftStopClient;
};

/**
 * Zero-boilerplate execute wrapper for Vercel AI SDK `tool({ execute })`
 * (and the same shape for LangChain JS tool handlers).
 *
 * Allowed → returns the execute result.
 * Blocked → returns `formatBlockedForLlm(decision)` (record already done).
 */
export function withSoftStop<TArgs extends Record<string, unknown>, TResult>(
  execute: (args: TArgs) => Promise<TResult> | TResult,
  config: WithSoftStopConfig
): (args: TArgs) => Promise<TResult | string> {
  const { client, ...toolConfig } = config;
  const wrapped = wrapUserFacingTool(client, toolConfig, execute);
  return async (args: TArgs) => {
    const result = await wrapped(args);
    if (!result.ok) {
      return formatBlockedForLlm(result.decision);
    }
    return result.result;
  };
}
