<p align="center">
  <img src="docs/brand/softstop-icon.png" width="96" height="96" alt="SoftStop" />
</p>

<h1 align="center">SoftStop</h1>

<p align="center"><strong>The Circuit Breaker for Autonomous Agents and Customer Outreach.</strong></p>

<p align="center">Prevent rogue agents, growth loops, and background jobs from spamming your users—across every surface.</p>

<p align="center">Doesn't make software smarter. Makes it stop when it should.</p>

<p align="center">
  <img src="docs/brand/softstop-scale-chaos.png" alt="Without SoftStop: messages land and pressure climbs Happy to Churned. With SoftStop: the same chaos hits a shared journal; sparse allows keep pressure capped." width="100%" />
</p>

<p align="center"><em>Growth, CRM, Support, Ads, Product, and Agents don’t share a stop signal — so a few customers accumulate pressure until they churn. SoftStop is the shared permit every system <code>check</code>s before anything lands.</em><br />
<a href="https://softstop.vercel.app">See the interactive Why SoftStop canvases →</a></p>

<p align="center">
  <a href="https://softstop-docs.vercel.app">Docs</a> ·
  <a href="#get-started">Quickstart</a> ·
  <a href="https://softstop.vercel.app">Live demo</a> ·
  <a href="https://softstop.vercel.app/console.html">See pressure live</a> ·
  <a href="governor/README.md">API</a> ·
  <a href="examples/README.md">Examples</a> ·
  <a href="SECURITY.md">Security</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-0B0B0F?style=flat-square" alt="MIT" /></a>
  <a href="package.json"><img src="https://img.shields.io/badge/node-%3E%3D18-E8A317?style=flat-square" alt="Node 18+" /></a>
  <a href="docker-compose.yml"><img src="https://img.shields.io/badge/docker-compose-0B0B0F?style=flat-square" alt="Docker" /></a>
  <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/version-0.2.1-E8A317?style=flat-square" alt="0.2.1" /></a>
</p>

<p align="center"><em>Early open source — looking for design partners. Not a claim of wide production adoption.</em></p>

## Why SoftStop?

- **Agent circuit breaking** — a safety layer in tool-calling loops, not just frequency capping. `check()` before the side effect; `record()` after.
- **Deterministic state for non-deterministic LLMs** — offload time/count cooldowns from the prompt. Policy and pressure live on the server.
- **Multi-agent collision prevention** — shared per-user permit across Onboarding / Sales / Support (and email / SMS / UI) on separate runtimes.
- **Graceful fallbacks** — when blocked, `suggestedActionType` steers the next move (e.g. interruption → reminder) instead of crash or retry loops.

Authorize only — SoftStop is not a CDP, not a messenger, not tool IAM. See [Governing AI Agents](apps/docs/start/governing-ai-agents.md).

## What SoftStop is

SoftStop answers one question before an escalation runs:

> Is it allowed to raise pressure on **this user**, with **this action type**, **right now**?

It does **not** rate-limit humans. It rate-limits the **actors** (agents, automations, messaging systems) that want to reach them.

It does **not** send email, write copy, pick offers, or replace Braze / Resend / your agents. Those systems still decide *what* to say. SoftStop decides whether they’re allowed to push.

| SoftStop does | SoftStop does not |
|---|---|
| `check` → allow or block | Send messages |
| `record` the outcome | Personalize content |
| Track **user pressure** (cost + decay + threshold) | Optimize conversion |
| Enforce cooldowns & caps across systems | MCP tool IAM / HITL approvals |

## Get started

### Install

```bash
npm i softstop
```

Self-host the SoftStop API for production. [softstop.vercel.app](https://softstop.vercel.app) is the live demo and SDK CDN — not a production host. Platform / lifecycle eng typically runs the API; Growth, CRM, product, and agents call `check` / `record` at send time.

### Quick start — AI tool call

Prefer the shipped adapters (`beforeContact`, `wrapUserFacingTool`). Outcomes are **`executed` | `blocked`** (not “landed”).

```js
import { SoftStop, wrapUserFacingTool } from 'softstop'

const ss = new SoftStop({ url: process.env.SOFTSTOP_API_URL || 'http://localhost:3000' })

const sendFollowUp = wrapUserFacingTool(
  ss,
  {
    userId: (args) => args.userId,
    actionType: 'urgency',
    surface: 'email',
    actor: 'sales-agent'
  },
  async ({ userId, subject }) => {
    // Resend / SMTP / …
    return { messageId: 'msg_1', userId, subject }
  }
)

const result = await sendFollowUp({ userId: 'user_123', subject: 'Quick follow-up' })

if (!result.ok) {
  // SoftStop already recorded outcome: 'blocked' (+ blockReason)
  // Steer the model — do not crash or retry the same actionType
  return {
    blocked: true,
    reason: result.reason,
    suggestedActionType: result.suggestedActionType // e.g. 'reminder'
  }
}
// SoftStop already recorded outcome: 'executed'
```

Inline without wrapping:

```js
const gated = await ss.beforeContact(
  { userId: 'user_123', actionType: 'urgency', surface: 'email', actor: 'sales-agent' },
  () => sendEmail(/* … */)
)
if (!gated.allowed) {
  // gated.suggestedActionType — record already done with outcome: 'blocked'
}
```

Raw `check` / `record` (same contract):

```js
const decision = await ss.check({
  userId: 'user_123',
  actionType: 'urgency',
  surface: 'email'
})

if (!decision.allowed) {
  await ss.record({
    decisionId: decision.decisionId,
    userId: 'user_123',
    actionType: 'urgency',
    outcome: 'blocked',
    blockReason: decision.reason
  })
  return
}

// escalate, then:
await ss.record({
  decisionId: decision.decisionId,
  userId: 'user_123',
  actionType: 'urgency',
  outcome: 'executed'
})
```

```js
const status = await ss.getPressure('user_123')
// { pressure, threshold, decayPerHour, costs, updatedAt }
```

Alternates: `github:chonibe/SoftStop#path:packages/sdk-js` or `https://softstop.vercel.app/softstop.tgz`. Browser CDN: `https://softstop.vercel.app/sdk.js`.

### Self-host the API

```bash
pnpm install
pnpm dev
pnpm softstop verify
```

Docker: `docker compose up --build`

## The contract

Authorize only — SoftStop does not send email, pick offers, or write copy. Prefer the SDK above; raw `fetch` to `/v1/check` + `/v1/record` is equivalent. Read live pressure with `GET /v1/users/:userId/pressure`.

> Hosted APIs use `/api` instead of `/v1`. `GOVERNOR_API_URL` is accepted as a legacy alias for `SOFTSTOP_API_URL`.

| actionType | Meaning | Default cost | Typical surface |
|---|---|---|---|
| `urgency` | Time pressure | 40 | “ends tonight” email / push |
| `discount` | Price / promo | 30 | SMS offer, coupon modal |
| `interruption` | Modal / popup | 25 | Checkout upsell, in-app dialog |
| `reminder` | Soft nudge | 15 | Agent follow-up, badge |

Custom types: add the same key to `costs`, `cooldownHours`, and `typeCap` in a policy file — see [action types](apps/docs/policies/action-types.md).

Default threshold: **100**. Default decay: **8** points/hour.

## When to use

- **Agents** — circuit breaker in tool loops; shared permit across Onboarding/Sales/Support ([Governing AI Agents](apps/docs/start/governing-ai-agents.md))
- **Marketing + CRM** — lifecycle, promo, and win-back tools don’t share caps with agents
- **Product UI** — modals/banners fire while email/SMS/agents are also pushing
- **Not SoftStop** — you need a messaging platform, CDP (identity/journey store), or MCP tool firewall. SoftStop only gates pressure; it does not replace a CDP.

## Adoption

SoftStop only protects users when every escalation touchpoint calls `check` and a matching `record`. Misuse creates false confidence.

- `POST /v1/verify` — integration smoke test
- `GET /v1/health` — orphan rate, block rate, health score

`orphanRate` measures `check`/`record` pairing on **observed** SoftStop traffic. Systems that never call SoftStop never appear in health — low orphan rate is not proof that every actor in the company is wired. Details: [Adoption contract](docs/ADOPTION_CONTRACT.md)

## Legacy names

Prefer SoftStop names (`SOFTSTOP_API_URL`, `SOFTSTOP_POLICY`, product docs under SoftStop). The HTTP engine still lives under `governor/`; `GOVERNOR_API_URL`, `GOVERNOR_POLICY`, and related aliases remain for backward compatibility. Do not remove them yet.

Repo note: root [`tenet-policy.json`](tenet-policy.json) configures **contributor** boundary lint (`scripts/tenet-check.js`). It is **not** a SoftStop pressure policy — runtime packs live in [`policies/`](policies/).

## Examples

- [**Agent + email collision**](examples/agent-email-collision) — sales agent email then marketing SMS; print pressure
- [**Agent tool wrapper**](examples/agent-tool-wrapper) — `wrapUserFacingTool` in a function-calling / tool loop
- [**Governing AI agents**](apps/docs/start/governing-ai-agents.md) — circuit breaker, pillars, `suggestedActionType`
- [**Sample shop**](examples/sample-shop) — chaos vs SoftStop + orphan-rate health (`node index.js --mode=compare`)
- [Node.js](examples/nodejs) · [Python](examples/python) · [Browser](examples/browser)
- [Agent touchpoint](examples/agent-touchpoint) — `beforeContact` before escalating a human
- [Scroll demo](https://softstop.vercel.app) — marketing-chaos example story
- [Pressure Console](https://softstop.vercel.app/console.html) — look up a user, watch the meter, simulate contacts
- [Before / after write-up](docs/BEFORE_AFTER.md)

## Docs

Start at the [docs hub](docs/README.md): concept, self-host, policy pack, integration workflow, API.

---

[Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Changelog](CHANGELOG.md) · [Adopters (invite)](ADOPTERS.md) · [License](LICENSE)

Press drafts (not customer proof): [Press](docs/press/SOFTSTOP_PRESS_RELEASE.md)
