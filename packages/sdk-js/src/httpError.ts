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
