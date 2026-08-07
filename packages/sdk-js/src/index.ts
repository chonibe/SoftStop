export type {
  ActionType,
  BuiltinActionType,
  Surface,
  Outcome,
  SoftStopOptions,
  OnUnavailable,
  CheckRequest,
  CheckResponse,
  PressureResponse,
  RecordRequest,
  SoftStopClient,
  MergeRequest,
  MergeResponse,
  SuggestedFallback,
  FallbackStrategy
} from "./types";

import type {
  SoftStopOptions,
  OnUnavailable,
  CheckRequest,
  CheckResponse,
  PressureResponse,
  RecordRequest,
  MergeRequest,
  MergeResponse
} from "./types";

import {
  readJsonOrThrow,
  SoftStopHttpError,
  SoftStopUnavailableError,
  failOpenCheckResponse
} from "./httpError";
export {
  SoftStopHttpError,
  SoftStopUnavailableError,
  failOpenCheckResponse
} from "./httpError";

/** @deprecated Prefer SoftStopOptions */
export type GovernorClientOptions = SoftStopOptions;

import {
  beforeContact,
  type BeforeContactRequest,
  type BeforeContactResult
} from "./agent";

const DEFAULT_TIMEOUT_MS = 500;

function defaultPrefix(baseUrl: string): "/v1" | "/api" {
  try {
    const host = new URL(baseUrl).hostname;
    return /localhost|127\.0\.0\.1/.test(host) ? "/v1" : "/api";
  } catch {
    return "/v1";
  }
}

/**
 * SoftStop client — authorize-only pressure permit.
 *
 * ```js
 * import { SoftStop } from 'softstop'
 * const ss = new SoftStop({ url: 'http://localhost:3000' })
 * const decision = await ss.check({ userId: 'u1', actionType: 'urgency' })
 * await ss.beforeContact({ userId, actionType, actor: 'sales-agent' }, sendEmail)
 * ```
 */
export class SoftStop {
  private readonly baseUrl: string;
  private readonly prefix: "/v1" | "/api";
  private readonly apiKey?: string;
  private readonly onUnavailable: OnUnavailable;
  private readonly timeoutMs: number;

  constructor(options: SoftStopOptions = {}) {
    const raw = options.url ?? options.baseUrl ?? "http://localhost:3000";
    this.baseUrl = String(raw).replace(/\/$/, "");
    this.prefix = options.prefix ?? defaultPrefix(this.baseUrl);
    this.apiKey = options.apiKey;
    this.onUnavailable = options.onUnavailable ?? "fail_closed";
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private headers(): Record<string, string> {
    return {
      "content-type": "application/json",
      ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {})
    };
  }

  private async fetchJson<T>(
    operation: string,
    path: string,
    init: RequestInit
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${this.prefix}${path}`, {
        ...init,
        signal: controller.signal
      });
      return await readJsonOrThrow<T>(operation, response);
    } catch (err) {
      if (err instanceof SoftStopHttpError) throw err;
      if (operation === "check" && this.onUnavailable === "fail_open") {
        return failOpenCheckResponse() as T;
      }
      throw new SoftStopUnavailableError(operation, err);
    } finally {
      clearTimeout(timer);
    }
  }

  async check(payload: CheckRequest): Promise<CheckResponse> {
    return this.fetchJson<CheckResponse>("check", "/check", {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(payload)
    });
  }

  async record(payload: RecordRequest): Promise<{ ok?: boolean }> {
    return this.fetchJson<{ ok?: boolean }>("record", "/record", {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(payload)
    });
  }

  async merge(payload: MergeRequest): Promise<MergeResponse> {
    return this.fetchJson<MergeResponse>("merge", "/users/merge", {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(payload)
    });
  }

  async getPressure(
    userId: string,
    tenantId?: string
  ): Promise<PressureResponse> {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
    return this.fetchJson<PressureResponse>(
      "getPressure",
      `/users/${encodeURIComponent(userId)}/pressure${qs}`,
      {
        method: "GET",
        headers: this.headers()
      }
    );
  }

  async verify(): Promise<{ ok?: boolean; message?: string }> {
    return this.fetchJson<{ ok?: boolean; message?: string }>("verify", "/verify", {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({})
    });
  }

  async health(): Promise<Record<string, unknown>> {
    return this.fetchJson<Record<string, unknown>>("health", "/health", {
      method: "GET",
      headers: this.headers()
    });
  }

  /**
   * Gate a user-facing escalation (agents, automations).
   * check → run → record executed, or record blocked and skip.
   */
  async beforeContact<T>(
    request: BeforeContactRequest,
    run: () => Promise<T> | T
  ): Promise<BeforeContactResult<T>> {
    return beforeContact(this, request, run);
  }
}

export {
  beforeContact,
  wrapUserFacingTool,
  formatBlockedForLlm,
  withSoftStop,
  type BeforeContactRequest,
  type BeforeContactResult,
  type BeforeContactAllowed,
  type BeforeContactBlocked,
  type UserFacingToolConfig,
  type WithSoftStopConfig
} from "./agent";

export {
  toSoftStopUserId,
  emitSoftStopDecisionToPostHog,
  emitSoftStopMergedToPostHog,
  emitSoftStopUnavailableToPostHog,
  type SoftStopKnownIdentity,
  type PostHogDistinctSource,
  type SoftStopObservePayload,
  type SoftStopMergeObservePayload,
  type SoftStopUnavailableObservePayload
} from "./identity";

/** @deprecated Use SoftStop */
export class GovernorClient extends SoftStop {}

/** @deprecated Use check/record. Kept for experimental MCP authorize path. */
export async function authorize(
  options: SoftStopOptions & { payload: unknown }
): Promise<unknown> {
  const base = (options.url ?? options.baseUrl ?? "http://localhost:3000").replace(/\/$/, "");
  const response = await fetch(`${base}/v1/authorize`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {})
    },
    body: JSON.stringify(options.payload)
  });
  return response.json();
}

export default SoftStop;
