# SoftStop feedback response + gap remediation

**Date:** 2026-08-06  
**Status:** Phase 1 complete (honesty + trust-copy in tree; not committed)  
**Tone:** Early OSS, design-partner ready — do not invent traction.

---

## Part 1 — Reviewer-facing response

Copy-pasteable reply to the accumulated marketing / docs / usefulness / maturity feedback.

---

Thanks for the thorough read. Below is how we’re treating each theme: what we agree with, what we corrected factually, what we already changed, and what we will not claim.

### What we’re keeping as the spine

We agree the strongest surfaces are:

1. **Deterministic policy packs** (JSON / presets, no ML; tuning in policy, not scattered if-statements)
2. **Docs IA** (Start → Integrate → API → Policies → Self-host → Ops)
3. **Live demo** (SoftStop on/off, touches vs blocks)
4. **Docs quickstart** (full check → block-and-record → escalate-and-record, with the orphan failure mode named inline)

Those stay. We are not redesigning them.

**Authorize-only, not a CDP** is intentional scope. A CDP stores identity and journeys; SoftStop only gates whether an actor may raise pressure on a user right now. Messaging platforms and MCP tool firewalls remain out of scope — the README “does / does not” and “When to use / Not SoftStop” tables are the canonical positioning. **AI-agent wedge** (circuit breaker in tool loops, deterministic `check`, multi-agent collision, `suggestedActionType` downgrade) is first-class positioning; channels remain collision partners — see [Governing AI agents](../../../apps/docs/start/governing-ai-agents.md).

**Usefulness ranking:** we agree load-bearing value is (1) policy engine, (2) `check`/`record`, (3) `verify`/`health` (orphan rate). Examples and self-host are adoption grease; the JS SDK is thin sugar over HTTP.

### Corrections

- **API / Ops pages were not empty stubs.** Remote fetch returned empty; the VitePress sources for check, record, verify, health, errors, and orphan-rate are substantive (request/response shapes, block reasons, health metrics, client failure guidance). The marketing site under-showed that depth; we deepened errors/check/record and added a pull-based orphan-rate alert recipe.
- **`softstop` is on the public npm registry** as `softstop@0.2.1` (`npm i softstop`). Tarball / GitHub subpath remain alternates. A stale version badge and an outdated name-availability note made this look unpublished — those are fixed.
- **Orphan rate is not “org-wide ownership proof.”** Low `orphanRate` means observed `check`s have matching `record`s. Systems that never call SoftStop never appear in health. Full protection still requires wiring every escalation touchpoint (see the adoption contract).

### Gaps we agree with — and what we did

| Gap | Response |
|---|---|
| Soft tagline / OG | Lead with circuit breaker for agents + outreach; shared permit supporting |
| Buyer / who installs | Platform / lifecycle eng runs the API; Growth, CRM, product, agents call `check`/`record` at send time (marketing + README) |
| Hosting signal | Self-host for production; `softstop.vercel.app` is demo + SDK CDN |
| Blocked-path richness | Landing/README show `reason` / `explanation` / optional `suggestedActionType`, then still `record` blocked |
| Concurrent allows | Documented honestly: `check` is read-only for pressure; state advances on `record`. SoftStop does **not** claim race-safety |
| npm install on marketing | Marketing quickstart leads with `npm i softstop` |
| Thousand Touches LTV numbers | Labeled **illustrative** demo theater, not measured outcomes |
| Early / low traction | Explicit early-OSS / design-partner framing; ADOPTERS stays an empty invite, not social proof |
| Governor rename | Documented as legacy aliases (`GOVERNOR_*`, `governor/`); prefer SoftStop names; aliases kept for compat |
| `tenet-policy.json` | Repo boundary lint (contributors), **not** a SoftStop pressure pack — labeled so adopters ignore it |
| Closed action types | **Shipped fix** — built-ins required; custom types via policy (`costs` / `cooldownHours` / `typeCap`). |

### What we will not claim

- Production race-safety or locking across concurrent `check`s
- Custom / namespaced action types (not in the product today)
- Hosted SoftStop as a production SaaS
- Named production adopters we do not have
- That `verify`/`health` alone prove every company system is wired

### Bottom three usefulness scores (our take)

- **JS SDK ~5/10** — agree on usefulness; install friction is lower than “not on npm” implied (`npm i softstop` works).
- **Fixed action types** — **addressed**: built-ins remain the shared vocabulary; custom types are policy-defined (same keys in `costs` / `cooldownHours` / `typeCap`).
- **tenet / Governor remnants ~2/10 for adopters** — agree; only `GOVERNOR_*` aliases are useful residue. tenet is internal.

Happy to take design-partner feedback on whether reserve-on-check or extensible action types should move up the roadmap.

---

## Part 2 — Gap matrix

| ID | Gap | Surface | Status | Notes |
|---|---|---|---|---|
| G1 | npm install on marketing | `demo/index.html` | **done** | Leads with `npm i softstop` |
| G2 | Hosting strip | demo + README | **done** | Self-host vs demo CDN |
| G3 | Owner / buyer line | demo + README | **done** | Platform/lifecycle vs channels |
| G4 | Sharper title/OG | `demo/index.html` | **done** | Shared permit primary |
| G5 | Blocked-path richness | demo + README | **done** | reason / explanation / suggestedActionType |
| G6 | Concurrent-allows honesty | docs API + demo | **done** | errors/check/record + How it works |
| G7 | HTTP/error contract | `apps/docs/api/errors.md` | **done** | Status codes, fail-closed, retry, decisionId |
| G8 | Orphan alert recipe | `apps/docs/ops/orphan-rate.md` | **done** | Pull-based `> 0.05` |
| G9 | Early-stage label + orphan nuance | README | **done** | Design partners; observed traffic only |
| G10 | Version badge 0.2.1 | README | **done** | Was 0.2.0 |
| G11 | NAME_AVAILABILITY npm stale | `docs/press/` | **done** | softstop published |
| G12 | ADOPTERS / press footer | README | **done** | Invite, demote press |
| G13 | Legacy names section | README | **done** | SoftStop prefer; Governor alias |
| G14 | tenet-policy labeled | CONTRIBUTING / README | **done** | Not adopter policy |
| G15 | Action-type mapping + custom types | `apps/docs/policies/action-types.md` + API | **done** | Policy-defined extras |
| G16 | Docs install leads with npm | getting-started, sdk-js | **done** | Tarball alternate |
| G17 | Illustrative demo outcomes | `demo/index.html` | **done** | Thousand Touches LTV |
| G18 | CDP one-liner contrast | demo + README | **done** | CDP identity vs permit |
| G19 | Race product fix | product | **wont-fix-now** | Roadmap: reserve-on-check / OCC |
| G20 | Extensible action types | product | **done** | Policy-defined custom types shipped |

---

## Part 3 — Remediation phases

### Phase 1 (honesty / maturity copy) — **done**

Docs and marketing copy only. No product behavior changes.

### Phase 2 (product ceilings) — roadmap only

Do **not** claim solved:

1. **Concurrent allows** — later: reserve-on-check or optimistic concurrency if design partners demand it.
2. **~~Extensible action types~~** — **shipped**: policy-defined custom types (built-ins required).

Tracked in [docs/ROADMAP.md](../../ROADMAP.md) under Later.

### Phase 3 (optional polish)

- Align any remaining soft marketing slides with permit language
- Smoke-test VitePress heading anchors after docs edits

---

## Success criteria

- Reviewer can be answered with Part 1 without overclaiming.
- Every bottom-three / maturity concern has a matrix status.
- Trust-copy + Phase 1 consistent on npm version, hosting, owner, races, tenet vs `policies/`.
- No fake adopters, no race-safety claims, no custom action-type claims.
