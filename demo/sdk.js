// src/agent.ts
async function beforeContact(client, request, run) {
  const { actor, context, ...checkFields } = request;
  const decision = await client.check({
    ...checkFields,
    context: {
      ...context ?? {},
      ...actor ? { actor } : {}
    }
  });
  if (!decision.allowed) {
    await client.record({
      decisionId: decision.decisionId,
      userId: request.userId,
      actionType: request.actionType,
      outcome: "blocked",
      blockReason: decision.reason,
      context: actor ? { actor } : void 0
    });
    return {
      allowed: false,
      decision,
      suggestedActionType: decision.suggestedActionType
    };
  }
  const result = await run();
  await client.record({
    decisionId: decision.decisionId,
    userId: request.userId,
    actionType: request.actionType,
    outcome: "executed",
    context: actor ? { actor } : void 0
  });
  return { allowed: true, result, decision };
}
function wrapUserFacingTool(client, config, handler) {
  return async (args) => {
    const userId = typeof config.userId === "function" ? config.userId(args) : config.userId;
    const gated = await beforeContact(
      client,
      {
        userId,
        actionType: config.actionType,
        surface: config.surface,
        actor: config.actor,
        context: { toolArgs: args }
      },
      () => handler(args)
    );
    if (!gated.allowed) {
      return {
        ok: false,
        reason: gated.decision.reason,
        decision: gated.decision,
        suggestedActionType: gated.suggestedActionType
      };
    }
    return { ok: true, result: gated.result, decision: gated.decision };
  };
}

// src/index.ts
function defaultPrefix(baseUrl) {
  try {
    const host = new URL(baseUrl).hostname;
    return /localhost|127\.0\.0\.1/.test(host) ? "/v1" : "/api";
  } catch {
    return "/v1";
  }
}
var SoftStop = class {
  constructor(options = {}) {
    const raw = options.url ?? options.baseUrl ?? "http://localhost:3000";
    this.baseUrl = String(raw).replace(/\/$/, "");
    this.prefix = options.prefix ?? defaultPrefix(this.baseUrl);
    this.apiKey = options.apiKey;
  }
  headers() {
    return {
      "content-type": "application/json",
      ...this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}
    };
  }
  async check(payload) {
    const response = await fetch(`${this.baseUrl}${this.prefix}/check`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`SoftStop check failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
  async record(payload) {
    const response = await fetch(`${this.baseUrl}${this.prefix}/record`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`SoftStop record failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
  async getPressure(userId, tenantId) {
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
    return response.json();
  }
  async verify() {
    const response = await fetch(`${this.baseUrl}${this.prefix}/verify`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({})
    });
    if (!response.ok) {
      throw new Error(`SoftStop verify failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
  async health() {
    const response = await fetch(`${this.baseUrl}${this.prefix}/health`, {
      method: "GET",
      headers: this.headers()
    });
    if (!response.ok) {
      throw new Error(`SoftStop health failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
  /**
   * Gate a user-facing escalation (agents, automations).
   * check → run → record executed, or record blocked and skip.
   */
  async beforeContact(request, run) {
    return beforeContact(this, request, run);
  }
};
var GovernorClient = class extends SoftStop {
};
async function authorize(options) {
  const base = (options.url ?? options.baseUrl ?? "http://localhost:3000").replace(/\/$/, "");
  const response = await fetch(`${base}/v1/authorize`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {}
    },
    body: JSON.stringify(options.payload)
  });
  return response.json();
}
var index_default = SoftStop;
export {
  GovernorClient,
  SoftStop,
  authorize,
  beforeContact,
  index_default as default,
  wrapUserFacingTool
};
