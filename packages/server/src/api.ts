import type { AddressInfo } from "net";
import type { IncomingMessage, ServerResponse } from "http";
import { createServer as createHttpServer } from "http";
import { createGovernor, type Governor, type GovernorConfig } from "@governor/core";
import type { GovernorStorage } from "@governor/storage";
import { handleAuthorize, handleDecisionList } from "./handlers";
import { AUTHORIZE_ROUTE, DECISIONS_ROUTE, HEALTH_ROUTE } from "./routes";

export interface GovernorServerOptions {
  port?: number;
  hostname?: string;
  governor?: Governor;
  config?: GovernorConfig;
  storage?: GovernorStorage;
}

export interface GovernorHttpResponse {
  status: number;
  body: unknown;
}

const readJsonBody = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) {
    return {};
  }

  return JSON.parse(text);
};

const writeJson = (response: ServerResponse, result: GovernorHttpResponse) => {
  response.writeHead(result.status, {
    "content-type": "application/json"
  });
  response.end(JSON.stringify(result.body));
};

export const createGovernorHttpServer = (options: GovernorServerOptions = {}) => {
  const governor = options.governor ?? createGovernor(options.config ?? { policies: [] });

  return createHttpServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === HEALTH_ROUTE) {
        writeJson(response, {
          status: 200,
          body: { ok: true, service: "governor-server" }
        });
        return;
      }

      if (request.method === "POST" && request.url === AUTHORIZE_ROUTE) {
        const payload = await readJsonBody(request);
        writeJson(response, await handleAuthorize(governor, payload, options.storage));
        return;
      }

      if (request.method === "GET" && request.url?.startsWith(DECISIONS_ROUTE)) {
        const url = new URL(request.url, "http://governor.local");
        const tenantId = url.searchParams.get("tenantId") ?? "default";
        const limit = url.searchParams.get("limit")
          ? Number(url.searchParams.get("limit"))
          : undefined;
        writeJson(response, await handleDecisionList(options.storage, tenantId, limit));
        return;
      }

      writeJson(response, {
        status: 404,
        body: { error: "not_found" }
      });
    } catch (error) {
      writeJson(response, {
        status: 400,
        body: {
          error: "invalid_request",
          message: error instanceof Error ? error.message : "Unknown error"
        }
      });
    }
  });
};

export const startGovernorServer = async (options: GovernorServerOptions = {}) => {
  const server = createGovernorHttpServer(options);
  const port = options.port ?? 3000;
  const hostname = options.hostname ?? "127.0.0.1";

  await new Promise<void>((resolve) => {
    server.listen(port, hostname, resolve);
  });

  const address = server.address() as AddressInfo;
  const actualPort = address.port;

  return {
    server,
    url: `http://${hostname}:${actualPort}`
  };
};
