# SoftStop

SoftStop — the shared permit before any system raises pressure on a user.

SoftStop doesn’t make software smarter. It makes it stop when it should.

It is a tiny authorize-only control layer that decides whether automated escalation (`urgency`, `discount`, `interruption`, `reminder`) is allowed for a user right now. It does not write copy, pick offers, or optimize conversion. It only permits or blocks pressure — and records what happened so caps and cooldowns stay honest.

```text
Escalation systems (email, SMS, push, in-app, pricing, agents)
  |
  v
SoftStop  (check → allow | deny)
  |
  v
User
```

## Why

Many systems can push the same person: onboarding, marketing, pricing rules, popups, AI agents. Each is reasonable alone. Together they over-pressure users. SoftStop is the shared gate they ask before raising pressure.

Not a messaging platform (like Braze). Not an agent tool firewall (like MCP gateways). A **pressure permit** any surface can call.

## Quick start (local, under 5 minutes)

Self-host is the primary path.

```bash
pnpm install
pnpm dev
```

API listens on `http://localhost:3000` with in-memory storage by default.

```bash
# Verify integration
GOVERNOR_API_URL=http://localhost:3000 pnpm governor verify

# Check before escalating
curl -X POST http://localhost:3000/v1/check \
  -H 'content-type: application/json' \
  -d '{"userId":"user_123","actionType":"urgency","surface":"email"}'
```

Or with Docker:

```bash
docker compose up --build
```

### Optional hosted demo

For a quick try without running a server: [https://governer.vercel.app](https://governer.vercel.app)  
Use self-host for production and for contributing.

Env: `GOVERNOR_API_URL` (and optional `SOFTSTOP_API_URL` alias) — see [.env.example](.env.example).

## Integration pattern

```js
const base =
  process.env.SOFTSTOP_API_URL ||
  process.env.GOVERNOR_API_URL ||
  "http://localhost:3000";
const prefix = /localhost|127\.0\.0\.1/.test(new URL(base).hostname) ? "/v1" : "/api";

const check = await fetch(`${base}${prefix}/check`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    userId: "user_123",
    actionType: "urgency", // urgency | discount | interruption | reminder
    surface: "email"       // email | sms | push | in-app
  })
}).then((r) => r.json());

if (!check.allowed) {
  // skip or downgrade; still record
  await fetch(`${base}${prefix}/record`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      decisionId: check.decisionId,
      userId: "user_123",
      actionType: "urgency",
      outcome: "blocked",
      blockReason: check.reason
    })
  });
  return;
}

// perform escalation, then:
await fetch(`${base}${prefix}/record`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    decisionId: check.decisionId,
    userId: "user_123",
    actionType: "urgency",
    outcome: "executed"
  })
});
```

| actionType | Meaning |
|---|---|
| `urgency` | Time pressure ("ends tonight", "only 2 left") |
| `discount` | Price / promo pressure |
| `interruption` | Modal, popup, forced attention |
| `reminder` | Soft nudge |

## Default policy pack

Deterministic rules (no ML): per-type cooldowns, per-type caps, a global cap, and stack protection. See [docs/default-policy-pack.md](docs/default-policy-pack.md).

## Adoption contract

SoftStop only protects users when every escalation touchpoint calls `check` and a matching `record`. Misuse creates false confidence. Read [docs/ADOPTION_CONTRACT.md](docs/ADOPTION_CONTRACT.md) and use:

- `POST /v1/verify` — smoke-test the API
- `GET /v1/health` — orphan rate, block rate, health score

Agent-assisted integration: [docs/GOVERNOR_INTEGRATION_WORKFLOW.md](docs/GOVERNOR_INTEGRATION_WORKFLOW.md) (SoftStop workflow; API paths unchanged).

## Examples

- [examples/nodejs](examples/nodejs) — server-side email / SMS / jobs
- [examples/python](examples/python) — Python client
- [examples/browser](examples/browser) — in-app modals
- [examples/agent-touchpoint](examples/agent-touchpoint) — agent calls SoftStop before a user-facing escalation
- [demo/game](demo/game) — optional full-surface demo

## Repository map

```text
governor/                 SoftStop HTTP API + rules engine + tests (product core)
examples/                 Node, Python, browser, agent-touchpoint
scripts/                  CLI (verify, health, check, test)
docs/                     Adoption contract, policy pack, press kit
demo/                     Optional demos
archive/mcp-gateway/      Experimental MCP / tool-call extraction (not v0.1 product)
```

## Persistence

Default: in-memory (fine for local demos).

For Postgres via Supabase, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (see [.env.example](.env.example)) and run migrations under [governor/api/db/migrations](governor/api/db/migrations).

Full self-host notes: [docs/SELF_HOST.md](docs/SELF_HOST.md).

## Open core

MIT-licensed engine and self-hosted API stay free. A future commercial control plane can add multi-tenant consoles, SSO, SIEM, and distributed rate limits — without closing the authorize-only core.

## Status

v0.1 product: **SoftStop** escalation / pressure permit.  
Experimental MCP gateway code lives under [archive/mcp-gateway](archive/mcp-gateway) — not the homepage product.

## Launch kit

- [Press release](docs/press/SOFTSTOP_PRESS_RELEASE.md)
- [Show HN / Product Hunt](docs/press/LAUNCH_BLURBS.md)
