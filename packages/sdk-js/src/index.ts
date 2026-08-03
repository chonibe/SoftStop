export type ActionType = "urgency" | "discount" | "interruption" | "reminder";
export type Surface = "email" | "sms" | "push" | "in-app";
export type Outcome = "executed" | "blocked" | "downgraded";

export interface SoftStopOptions {
  /** SoftStop API base URL (alias of `baseUrl`). */
  url?: string;
  /** SoftStop API base URL. Default: http://localhost:3000 */
  baseUrl?: string;
  apiKey?: string;
  /** Override path prefix (`/v1` local, `/api` hosted). */
  prefix?: "/v1" | "/api";
}

/** @deprecated Prefer SoftStopOptions */
export type GovernorClientOptions = SoftStopOptions;

export interface CheckRequest {
  userId: string;
  actionType: ActionType;
  surface?: Surface;
  context?: Record<string, unknown>;
}

export interface CheckResponse {
  allowed: boolean;
  reason: string;
  decisionId?: string;
  cooldownUntil?: string;
  suggestedActionType?: ActionType;
}

export interface RecordRequest {
  decisionId?: string;
  userId: string;
  actionType: ActionType;
  outcome: Outcome;
  blockReason?: string;
  signals?: {
    dismissed?: boolean;
    ignored?: boolean;
    hesitated?: boolean;
  };
  context?: Record<string, unknown>;
}

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
 * await ss.record({ … })
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
}

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
