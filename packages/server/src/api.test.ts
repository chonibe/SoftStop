import { afterAll, describe, expect, it } from "vitest";
import { createGovernor } from "@governor/core";
import { MemoryGovernorStorage } from "@governor/storage";
import { startGovernorServer } from "./api";

describe("Governor HTTP server", () => {
  const storage = new MemoryGovernorStorage();
  const started = startGovernorServer({
    port: 0,
    storage,
    governor: createGovernor({
      policies: [
        {
          name: "block-github-delete",
          match: { tool: "github.delete_repo" },
          action: "deny"
        }
      ]
    })
  });

  afterAll(async () => {
    const { server } = await started;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("reports health", async () => {
    const { url } = await started;
    const response = await fetch(`${url}/v1/health`);

    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "governor-server"
    });
  });

  it("authorizes tool calls", async () => {
    const { url } = await started;
    const response = await fetch(`${url}/v1/authorize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actor: { id: "agent_1", type: "agent" },
        tool: { server: "github", name: "delete_repo", risk: "critical" },
        context: { tenantId: "acme", environment: "production" }
      })
    });

    await expect(response.json()).resolves.toMatchObject({
      allowed: false,
      action: "deny",
      policy: "block-github-delete",
      decisionId: expect.stringMatching(/^dec_/)
    });
  });

  it("lists persisted decisions", async () => {
    const { url } = await started;
    const response = await fetch(`${url}/v1/decisions?tenantId=acme`);

    await expect(response.json()).resolves.toMatchObject({
      decisions: [
        {
          id: expect.stringMatching(/^dec_/),
          request: {
            context: { tenantId: "acme" }
          },
          decision: {
            policy: "block-github-delete"
          }
        }
      ]
    });
  });

  it("rejects malformed authorization requests", async () => {
    const { url } = await started;
    const response = await fetch(`${url}/v1/authorize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool: { name: "send" } })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_authorization_request"
    });
  });
});
