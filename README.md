<p align="center">
  <img src="docs/brand/softstop-icon.png" width="96" height="96" alt="SoftStop" />
</p>

<h1 align="center">SoftStop</h1>

<p align="center"><strong>The shared permit before any system raises pressure on a user.</strong></p>

<p align="center">Doesn't make software smarter. Makes it stop when it should.</p>

<p align="center">
  <img src="docs/brand/softstop-scale-chaos.png" alt="Without SoftStop: messages land and pressure climbs Happy to Churned. With SoftStop: the same chaos hits a shared journal; sparse allows keep pressure capped." width="100%" />
</p>

<p align="center"><em>Growth, CRM, Support, Ads, Product, and Agents don’t share a stop signal — so a few customers accumulate pressure until they churn. SoftStop doesn’t quiet the attempt storm; it is the shared journal every system <code>check</code>s before anything lands.</em><br />
<a href="https://softstop.vercel.app">See the interactive Why SoftStop canvases →</a></p>

<p align="center">
  <a href="https://softstop-docs.vercel.app">Docs</a> ·
  <a href="#get-started">Quickstart</a> ·
  <a href="https://softstop.vercel.app">Live demo</a> ·
  <a href="governor/README.md">API</a> ·
  <a href="examples/README.md">Examples</a> ·
  <a href="SECURITY.md">Security</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-0B0B0F?style=flat-square" alt="MIT" /></a>
  <a href="package.json"><img src="https://img.shields.io/badge/node-%3E%3D18-E8A317?style=flat-square" alt="Node 18+" /></a>
  <a href="docker-compose.yml"><img src="https://img.shields.io/badge/docker-compose-0B0B0F?style=flat-square" alt="Docker" /></a>
  <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/version-0.1.0-E8A317?style=flat-square" alt="0.1.0" /></a>
</p>

## What SoftStop is

SoftStop answers one question before an escalation runs:

> Is it allowed to raise pressure on **this user**, with **this action type**, **right now**?

It does **not** send email, write copy, pick offers, or replace Braze / Resend / your agents. Those systems still decide *what* to say. SoftStop decides whether they’re allowed to push.

| SoftStop does | SoftStop does not |
|---|---|
| `check` → allow or block | Send messages |
| `record` the outcome | Personalize content |
| Enforce cooldowns & caps across systems | Optimize conversion |

## The use case

Lifecycle email, pricing SMS, checkout modal, and a support agent can all hit the **same person** with no shared stop signal. SoftStop sits in the middle as a tiny authorize-only gate — see the diagram above, or [scroll the live demo](https://softstop.vercel.app).

### Example story (live demo)

The [live demo](https://softstop.vercel.app) is a **marketing-chaos example**: scroll ~7 days of email / SMS / push / in-app stacking on one person, then toggle SoftStop on. Same SoftStop contract applies to product UI and agents — the demo just makes the failure mode obvious.

## Get started

### One-liner SDK

```bash
npm i https://softstop.vercel.app/softstop.tgz
```

```js
import { SoftStop } from 'softstop'

const ss = new SoftStop({ url: process.env.SOFTSTOP_API_URL || 'http://localhost:3000' })
const decision = await ss.check({ userId: 'user_123', actionType: 'urgency', surface: 'email' })

if (!decision.allowed) {
  await ss.record({
    decisionId: decision.decisionId,
    userId: 'user_123',
    actionType: 'urgency',
    outcome: 'blocked',
    blockReason: decision.reason
  })
  return // do not escalate
}
// escalate, then record outcome: 'executed'
```

Not on the public npm registry yet — install via the hosted tarball or `github:chonibe/SoftStop#path:packages/sdk-js`. Browser CDN: `https://softstop.vercel.app/sdk.js`.

### Self-host the API

```bash
pnpm install
pnpm dev
pnpm softstop verify
```

Docker: `docker compose up --build`

## The contract

Authorize only — SoftStop does not send email, pick offers, or write copy. Prefer the SDK above; raw `fetch` to `/v1/check` + `/v1/record` is equivalent.

> Hosted APIs use `/api` instead of `/v1`. `GOVERNOR_API_URL` is accepted as a legacy alias for `SOFTSTOP_API_URL`.

| actionType | Meaning | Typical surface |
|---|---|---|
| `urgency` | Time pressure | “ends tonight” email / push |
| `discount` | Price / promo | SMS offer, coupon modal |
| `interruption` | Modal / popup | Checkout upsell, in-app dialog |
| `reminder` | Soft nudge | Agent follow-up, badge |

## When to use

- **Marketing + CRM** — lifecycle, promo, and win-back tools don’t share caps
- **Product UI** — modals/banners fire while email/SMS are also pushing
- **Agents** — support/sales agents escalate humans without seeing other pressure
- **Not SoftStop** — you need a messaging platform, CDP, or MCP tool firewall

## Adoption

SoftStop only protects users when every escalation touchpoint calls `check` and a matching `record`. Misuse creates false confidence.

- `POST /v1/verify` — integration smoke test
- `GET /v1/health` — orphan rate, block rate, health score

Details: [Adoption contract](docs/ADOPTION_CONTRACT.md)

## Examples

- [**Sample shop**](examples/sample-shop) — chaos vs SoftStop + orphan-rate health (`node index.js --mode=compare`)
- [Node.js](examples/nodejs) · [Python](examples/python) · [Browser](examples/browser)
- [Agent touchpoint](examples/agent-touchpoint) — agent calls SoftStop before escalating a human
- [Scroll demo](https://softstop.vercel.app) — marketing-chaos example story
- [Before / after write-up](docs/BEFORE_AFTER.md)

## Docs

Start at the [docs hub](docs/README.md): concept, self-host, policy pack, integration workflow, API.

---

[Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Changelog](CHANGELOG.md) · [Adopters](ADOPTERS.md) · [Press](docs/press/SOFTSTOP_PRESS_RELEASE.md) · [License](LICENSE)
