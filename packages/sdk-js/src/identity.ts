import type { ActionType, CheckResponse, Surface } from "./types";

export type SoftStopKnownIdentity =
  | { kind: "sc"; id: string }
  | { kind: "email"; id: string };

export type PostHogDistinctSource = {
  get_distinct_id(): string;
};

/**
 * SoftStop userId conventions for PostHog + Street Collector:
 * - anonymous: `ph:<distinct_id>`
 * - logged-in: `sc:<supabase_uuid>`
 * - guest email: `email:<normalized_email>`
 */
export function toSoftStopUserId(
  ph: PostHogDistinctSource,
  known?: SoftStopKnownIdentity
): string {
  if (known?.kind === "sc") {
    const id = known.id.trim();
    return id.startsWith("sc:") ? id : `sc:${id}`;
  }
  if (known?.kind === "email") {
    const normalized = known.id.toLowerCase().trim();
    return normalized.startsWith("email:") ? normalized : `email:${normalized}`;
  }
  const distinct = String(ph.get_distinct_id() ?? "").trim();
  if (!distinct) return "ph:unknown";
  return distinct.startsWith("ph:") ? distinct : `ph:${distinct}`;
}

export interface SoftStopObservePayload {
  softstopUserId: string;
  actionType: ActionType;
  surface?: Surface;
  actor?: string;
  decision: Pick<
    CheckResponse,
    | "allowed"
    | "reason"
    | "decisionId"
    | "pressure"
    | "cost"
    | "threshold"
    | "projectedPressure"
    | "explanation"
  >;
}

type CaptureFn = (event: string, properties?: Record<string, unknown>) => void;

/** Emit SoftStop allow/block outcomes as PostHog (or any) analytics events. */
export function emitSoftStopDecisionToPostHog(
  capture: CaptureFn,
  payload: SoftStopObservePayload
): void {
  const { softstopUserId, actionType, surface, actor, decision } = payload;
  const base: Record<string, unknown> = {
    softstop_user_id: softstopUserId,
    action_type: actionType,
    surface: surface ?? null,
    actor: actor ?? null,
    decision_id: decision.decisionId ?? null,
    pressure: decision.pressure ?? null,
    cost: decision.cost ?? null,
    projected_pressure: decision.projectedPressure ?? null,
    threshold: decision.threshold ?? null
  };
  if (decision.allowed) {
    capture("softstop_allowed", base);
    return;
  }
  capture("softstop_blocked", {
    ...base,
    block_reason: decision.reason,
    explanation: decision.explanation ?? null
  });
}

export interface SoftStopMergeObservePayload {
  fromUserId: string;
  toUserId: string;
  pressureAfter?: number;
}

export function emitSoftStopMergedToPostHog(
  capture: CaptureFn,
  payload: SoftStopMergeObservePayload
): void {
  capture("softstop_merged", {
    from_user_id: payload.fromUserId,
    to_user_id: payload.toUserId,
    pressure_after: payload.pressureAfter ?? null
  });
}

export interface SoftStopUnavailableObservePayload {
  actor?: string;
  actionType?: ActionType;
  softstopUserId?: string;
}

/**
 * SoftStop outage / fail-open path. Never invents a decision_id —
 * callers must skip record() when SoftStop is unavailable.
 */
export function emitSoftStopUnavailableToPostHog(
  capture: CaptureFn,
  payload: SoftStopUnavailableObservePayload = {}
): void {
  capture("softstop_unavailable", {
    actor: payload.actor ?? null,
    action_type: payload.actionType ?? null,
    softstop_user_id: payload.softstopUserId ?? null,
    decision_id: null
  });
}
