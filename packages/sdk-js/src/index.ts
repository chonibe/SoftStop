export type ActionType = "urgency" | "discount" | "interruption" | "reminder";
export type Surface = "email" | "sms" | "push" | "in-app";
export type Outcome = "executed" | "blocked" | "downgraded";

export interface GovernorClientOptions {
  /** API base URL. Default path prefix: /v1 on localhost, /api otherwise. */
  baseUrl?: string;
  apiKey?: string;
  /** Override path prefix (`/v1` or `/api`). */
  prefix?: "/v1" | "/api";
}

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
}

function defaultPrefix(baseUrl: string): "/v1" | "/api" {
  try {
    const host = new URL(baseUrl).hostname;
    return /localhost|127\.0\.0\.1/.test(host) ? "/v1" : "/api";
  } catch {
    return "/v1";
  }
}

export class GovernorClient {
  private readonly baseUrl: string;
  private readonly prefix: "/v1" | "/api";
  private readonly apiKey?: string;

  constructor(options: GovernorClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "http://localhost:3000").replace(/\/$/, "");
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
    return response.json() as Promise<CheckResponse>;
  }

  async record(payload: RecordRequest): Promise<{ ok?: boolean }> {
    const response = await fetch(`${this.baseUrl}${this.prefix}/record`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(payload)
    });
    return response.json() as Promise<{ ok?: boolean }>;
  }

  async verify(): Promise<{ ok?: boolean; message?: string }> {
    const response = await fetch(`${this.baseUrl}${this.prefix}/verify`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({})
    });
    return response.json() as Promise<{ ok?: boolean; message?: string }>;
  }
}

/** @deprecated Use check/record. Kept for experimental MCP authorize path. */
export async function authorize(
  options: GovernorClientOptions & { payload: unknown }
): Promise<unknown> {
  const client = new GovernorClient(options);
  const response = await fetch(
    `${(options.baseUrl ?? "http://localhost:3000").replace(/\/$/, "")}/v1/authorize`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {})
      },
      body: JSON.stringify(options.payload)
    }
  );
  return response.json();
}
