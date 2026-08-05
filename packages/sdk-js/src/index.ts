export type {
  ActionType,
  Surface,
  Outcome,
  SoftStopOptions,
  CheckRequest,
  CheckResponse,
  PressureResponse,
  RecordRequest,
  SoftStopClient,
  MergeRequest,
  MergeResponse
} from "./types";

import type {
  SoftStopOptions,
  CheckRequest,
  CheckResponse,
  PressureResponse,
  RecordRequest,
  MergeRequest,
  MergeResponse
} from "./types";

/** @deprecated Prefer SoftStopOptions */
export type GovernorClientOptions = SoftStopOptions;

import {
  beforeContact,
  type BeforeContactRequest,
  type BeforeContactResult
} from "./agent";

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

  constructor(options: SoftStopOptions = {}) {
    const raw = options.url ?? options.baseUrl ?? "http://localhost:3000";
    this.baseUrl = String(raw).replace(/\/$/, "");
    this.prefix = options.prefix ?? defaultPrefix(this.baseUrl);
    this.apiKey = options.apiKey;
  }

  private headers(): Record<string, string> {
    return {
      "content-type": "application/json",
      ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {})
    };
  }

  async check(payload: CheckRequest): Promise<CheckResponse> {
    const response = await fetch(`${this.baseUrl}${this.prefix}/check`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`SoftStop check failed: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<CheckResponse>;
  }

  async record(payload: RecordRequest): Promise<{ ok?: boolean }> {
    const response = await fetch(`${this.baseUrl}${this.prefix}/record`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`SoftStop record failed: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<{ ok?: boolean }>;
  }

  async merge(payload: MergeRequest): Promise<MergeResponse> {
    const response = await fetch(`${this.baseUrl}${this.prefix}/users/merge`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`SoftStop merge failed: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<MergeResponse>;
  }

  async getPressure(
    userId: string,
    tenantId?: string
  ): Promise<PressureResponse> {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
    const response = await fetch(
      `${this.baseUrl}${this.prefix}/users/${encodeURIComponent(userId)}/pressure${qs}`,
      {
        method: "GET",
        headers: this.headers()
      }
    );
    if (!response.ok) {
      throw new Error(
        `SoftStop getPressure failed: ${response.status} ${response.statusText}`
      );
    }
    return response.json() as Promise<PressureResponse>;
  }

  async verify(): Promise<{ ok?: boolean; message?: string }> {
    const response = await fetch(`${this.baseUrl}${this.prefix}/verify`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({})
    });
    if (!response.ok) {
      throw new Error(`SoftStop verify failed: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<{ ok?: boolean; message?: string }>;
  }

  async health(): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl}${this.prefix}/health`, {
      method: "GET",
      headers: this.headers()
    });
    if (!response.ok) {
      throw new Error(`SoftStop health failed: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<Record<string, unknown>>;
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
  type BeforeContactRequest,
  type BeforeContactResult,
  type BeforeContactAllowed,
  type BeforeContactBlocked,
  type UserFacingToolConfig
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
