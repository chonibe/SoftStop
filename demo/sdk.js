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
  index_default as default
};
