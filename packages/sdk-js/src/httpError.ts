export class SoftStopHttpError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly operation: string;
  readonly body: unknown;

  constructor(
    operation: string,
    status: number,
    statusText: string,
    body: unknown
  ) {
    const detail = formatBody(body) || statusText || "request failed";
    super(`SoftStop ${operation} failed (${status}): ${detail}`);
    this.name = "SoftStopHttpError";
    this.operation = operation;
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

/**
 * SoftStop was unreachable or timed out (network / AbortError).
 * Thrown under `onUnavailable: "fail_closed"` (the default).
 */
export class SoftStopUnavailableError extends Error {
  readonly operation: string;
  readonly cause?: unknown;

  constructor(operation: string, cause?: unknown) {
    const detail =
      cause instanceof Error
        ? cause.message
        : cause != null
          ? String(cause)
          : "unreachable";
    super(
      `SoftStop ${operation} unavailable (${detail}); fail_closed — not inventing allowed:true`
    );
    this.name = "SoftStopUnavailableError";
    this.operation = operation;
    this.cause = cause;
  }
}

/** Synthetic check decision for explicit `onUnavailable: "fail_open"`. No decisionId. */
export function failOpenCheckResponse(): {
  allowed: true;
  reason: "softstop_unavailable";
  explanation: string;
} {
  return {
    allowed: true,
    reason: "softstop_unavailable",
    explanation:
      "SoftStop unreachable or timed out; fail_open permitted the action without a server decision. Do not call record() — there is no decisionId."
  };
}


function formatBody(body: unknown): string {
  if (body == null) return "";
  if (typeof body === "string") return body.slice(0, 500);
  if (typeof body === "object") {
    const err = (body as { error?: unknown }).error;
    if (typeof err === "string") return err;
    try {
      return JSON.stringify(err ?? body).slice(0, 500);
    } catch {
      return "";
    }
  }
  return String(body);
}

function parseBodyText(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Read body once; throw SoftStopHttpError on non-2xx; return parsed JSON on success. */
export async function readJsonOrThrow<T>(
  operation: string,
  response: Response
): Promise<T> {
  const text = await response.text();
  const body = parseBodyText(text);
  if (!response.ok) {
    throw new SoftStopHttpError(
      operation,
      response.status,
      response.statusText,
      body
    );
  }
  return body as T;
}
