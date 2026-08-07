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

export type ExecutionStatus = "executed" | "blocked" | "failed";
export type RecordingStatus = "ok" | "failed" | "skipped";

export type BeforeContactAllowed<T> = {
  allowed: true;
  result: T;
  decision: CheckResponse;
  /** Side-effect status (send/tool). */
  execution: "executed" | "failed";
  /** Journal/record status — independent of execution. */
  recording: RecordingStatus;
  /** Never retry the side effect when execution succeeded. */
  retryExecution: boolean;
  /** Safe to retry SoftStop record only. */
  retryRecord: boolean;
  recordError?: unknown;
};

export type BeforeContactBlocked = {
  allowed: false;
  decision: CheckResponse;
  suggestedActionType?: ActionType;
  execution: "blocked";
  recording: RecordingStatus;
  retryExecution: false;
  retryRecord: boolean;
  recordError?: unknown;
};

export type BeforeContactResult<T> = BeforeContactAllowed<T> | BeforeContactBlocked;

async function recordSafe(
  client: SoftStopClient,
  payload: Parameters<SoftStopClient["record"]>[0]
): Promise<{ recording: RecordingStatus; recordError?: unknown }> {
  try {
    await client.record(payload);
    return { recording: "ok" };
  } catch (err) {
    return { recording: "failed", recordError: err };
  }
}

/**
 * Gate a user-facing escalation: check → run → record executed,
 * or record blocked and skip the run.
 *
 * When the side effect succeeds but record fails, returns a result with
 * `retryExecution: false` and `retryRecord: true` — never throw in a way
 * that implies it is safe to replay the send.
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
    const decisionId = decision.decisionId ?? "";
    const recorded = await recordSafe(client, {
      decisionId,
      userId: request.userId,
      actionType: request.actionType,
      outcome: "blocked",
      blockReason: decision.reason,
      context: actor ? { actor } : undefined
    });
    return {
      allowed: false,
      decision,
      suggestedActionType: decision.suggestedActionType,
      execution: "blocked",
      recording: recorded.recording,
      retryExecution: false,
      retryRecord: recorded.recording === "failed",
      ...(recorded.recordError !== undefined
        ? { recordError: recorded.recordError }
        : {})
    };
  }

  let result: T;
  try {
    result = await run();
  } catch (err) {
    // Side effect failed before completion — do not record executed.
    throw err;
  }

  // Explicit fail_open unavailable allow — no server decisionId; never invent a record.
  if (decision.reason === "softstop_unavailable") {
    return {
      allowed: true,
      result,
      decision,
      execution: "executed",
      recording: "skipped",
      retryExecution: false,
      retryRecord: false
    };
  }

  const decisionId = decision.decisionId ?? "";
  const recorded = await recordSafe(client, {
    decisionId,
    userId: request.userId,
    actionType: request.actionType,
    outcome: "executed",
    context: actor ? { actor } : undefined
  });

  return {
    allowed: true,
    result,
    decision,
    execution: "executed",
    recording: recorded.recording,
    retryExecution: false,
    retryRecord: recorded.recording === "failed",
    ...(recorded.recordError !== undefined
      ? { recordError: recorded.recordError }
      : {})
  };
}

export type UserFacingToolConfig = {
  userId: string | ((args: Record<string, unknown>) => string);
  actionType: ActionType;
  surface?: Surface;
  actor?: string;
  /** Optional operation id for audit context (not full tool args). */
  operationId?: string | ((args: Record<string, unknown>) => string | undefined);
  /**
   * Optional serializer for extra audit context. Default sends no toolArgs.
   * Prefer actor / toolName / operationId only.
   */
  serializeContext?: (
    args: Record<string, unknown>
  ) => Record<string, unknown> | undefined;
  /** Tool name for audit context. */
  toolName?: string;
};

/**
 * Wrap a tool/function that contacts a human so SoftStop runs first.
 * Framework-agnostic: OpenAI tools, LangChain tools, plain handlers.
 *
 * Context defaults to actor / toolName / operationId only — not raw toolArgs.
 */
export function wrapUserFacingTool<TArgs extends Record<string, unknown>, TResult>(
  client: SoftStopClient,
  config: UserFacingToolConfig,
  handler: (args: TArgs) => Promise<TResult> | TResult
): (args: TArgs) => Promise<
  | {
      ok: true;
      result: TResult;
      decision: CheckResponse;
      execution: "executed";
      recording: RecordingStatus;
      retryExecution: false;
      retryRecord: boolean;
      recordError?: unknown;
    }
  | {
      ok: false;
      reason: string;
      decision: CheckResponse;
      suggestedActionType?: ActionType;
      execution: "blocked";
      recording: RecordingStatus;
      retryExecution: false;
      retryRecord: boolean;
      recordError?: unknown;
    }
> {
  return async (args: TArgs) => {
    const userId =
      typeof config.userId === "function" ? config.userId(args) : config.userId;
    const operationId =
      typeof config.operationId === "function"
        ? config.operationId(args)
        : config.operationId;
    const extra = config.serializeContext?.(args as Record<string, unknown>);
    const gated = await beforeContact(
      client,
      {
        userId,
        actionType: config.actionType,
        surface: config.surface,
        actor: config.actor,
        context: {
          ...(config.toolName ? { toolName: config.toolName } : {}),
          ...(operationId ? { operationId } : {}),
          ...(extra ?? {})
        }
      },
      () => handler(args)
    );

    if (!gated.allowed) {
      return {
        ok: false,
        reason: gated.decision.reason,
        decision: gated.decision,
        suggestedActionType: gated.suggestedActionType,
        execution: "blocked",
        recording: gated.recording,
        retryExecution: false,
        retryRecord: gated.retryRecord,
        ...(gated.recordError !== undefined
          ? { recordError: gated.recordError }
          : {})
      };
    }

    return {
      ok: true,
      result: gated.result,
      decision: gated.decision,
      execution: "executed",
      recording: gated.recording,
      retryExecution: false,
      retryRecord: gated.retryRecord,
      ...(gated.recordError !== undefined
        ? { recordError: gated.recordError }
        : {})
    };
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
