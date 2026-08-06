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
