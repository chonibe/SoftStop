# SoftStop Docs Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a SoftStop-branded VitePress docs site under `apps/docs` with OpenClaw-style hub IA, rewritten public pages, and cross-links from the demo + README.

**Architecture:** Standalone VitePress app in `apps/docs`, dark SoftStop theme, local search, six hubs. Deploy as a separate Vercel project from the existing `demo/` site. Source markdown in repo `docs/` stays internal; public content is rewritten into `apps/docs`.

**Tech Stack:** VitePress, pnpm workspace, SoftStop brand tokens, Vercel static deploy

**Spec:** `docs/superpowers/specs/2026-08-03-softstop-docs-site-design.md`

---

## File map

| Path | Responsibility |
|---|---|
| `apps/docs/package.json` | Docs package scripts + vitepress dep |
| `apps/docs/.vitepress/config.mts` | Site title, nav, sidebar, search, appearance |
| `apps/docs/.vitepress/theme/index.ts` | Default theme + custom CSS import |
| `apps/docs/.vitepress/theme/custom.css` | SoftStop tokens / hub cards / fonts |
| `apps/docs/.vitepress/theme/components/HubCards.vue` | Reusable hub card grid |
| `apps/docs/index.md` | Home (hero, CTAs, hubs, quickstart) |
| `apps/docs/start/*.md` | Concept, getting started, adoption |
| `apps/docs/integrate/*.md` | Workflow, SDK, examples |
| `apps/docs/api/*.md` | check, record, verify, health, errors |
| `apps/docs/policies/*.md` | Index, default pack, action types |
| `apps/docs/self-host/*.md` | Index, docker, env, storage |
| `apps/docs/ops/*.md` | Orphan rate, security, troubleshooting |
| `apps/docs/public/*` | Favicon, marks, OG cover |
| `apps/docs/scripts/smoke-dist.mjs` | Post-build page existence check |
| `apps/docs/vercel.json` | Static output for docs project |
| `pnpm-workspace.yaml` | Include `apps/*` |
| `package.json` | Root `docs:*` scripts |
| `demo/index.html` | Docs nav → docs URL |
| `README.md` | Docs link → docs URL |
| `docs/README.md` | Point humans at public docs site |

**Site constants** (in config): `DEMO_URL = https://softstop.vercel.app`, `GITHUB_URL = https://github.com/chonibe/SoftStop`. Docs public URL set after first deploy; until then use relative self-links inside the docs app and a `DOCS_PUBLIC_URL` constant updated when known.

---

### Task 1: Scaffold VitePress package

**Files:**
- Create: `apps/docs/package.json`
- Create: `apps/docs/.vitepress/config.mts`
- Create: `apps/docs/.vitepress/theme/index.ts`
- Create: `apps/docs/.vitepress/theme/custom.css`
- Create: `apps/docs/index.md` (minimal stub)
- Create: `apps/docs/vercel.json`
- Create: `apps/docs/scripts/smoke-dist.mjs`
- Modify: `pnpm-workspace.yaml`
- Modify: `package.json`

- [ ] **Step 1: Extend workspace + root scripts**

`pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
  - "apps/*"
```

Root `package.json` scripts add:
```json
"docs:dev": "pnpm --filter @softstop/docs dev",
"docs:build": "pnpm --filter @softstop/docs build",
"docs:preview": "pnpm --filter @softstop/docs preview",
"docs:smoke": "pnpm --filter @softstop/docs smoke"
```

- [ ] **Step 2: Create `apps/docs/package.json`**

```json
{
  "name": "@softstop/docs",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vitepress dev",
    "build": "vitepress build && node scripts/smoke-dist.mjs",
    "preview": "vitepress preview",
    "smoke": "node scripts/smoke-dist.mjs"
  },
  "devDependencies": {
    "vitepress": "^1.6.3",
    "vue": "^3.5.13"
  }
}
```

- [ ] **Step 3: Minimal config, theme, home stub, vercel.json, smoke script**

Config must define full sidebar structure for all hubs (pages can be filled in later tasks). Appearance: `dark`. Search: `local`. Logo: `/softstop-mark-dark.svg`. Nav: Start, Integrate, API, Policies, Self-host, Ops, Demo (external), GitHub (external).

Smoke script asserts these dist paths exist after build:
`index.html`, `start/getting-started.html`, `api/check.html`, `integrate/workflow.html`, `policies/index.html`, `self-host/index.html`, `ops/orphan-rate.html`

- [ ] **Step 4: Install + verify stub build fails smoke (missing pages) then add placeholder md files for every sidebar path so smoke can pass**

Create thin placeholder pages for every URL in the sidebar (title + one paragraph). Later tasks rewrite them fully.

- [ ] **Step 5: `pnpm install` from repo root, then `pnpm docs:build` — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add pnpm-workspace.yaml package.json apps/docs pnpm-lock.yaml
git commit -m "Scaffold SoftStop VitePress docs app."
```

---

### Task 2: SoftStop theme + home hub

**Files:**
- Modify: `apps/docs/.vitepress/theme/custom.css`
- Create: `apps/docs/.vitepress/theme/components/HubCards.vue`
- Modify: `apps/docs/.vitepress/theme/index.ts`
- Modify: `apps/docs/index.md`
- Copy brand assets into `apps/docs/public/`

- [ ] **Step 1: Copy brand assets**

```bash
cp docs/brand/softstop-mark-dark.svg docs/brand/softstop-mark.svg docs/brand/softstop-icon.png docs/brand/softstop-cover.png apps/docs/public/
```

- [ ] **Step 2: Theme CSS with SoftStop tokens**

Override VitePress brand CSS vars to amber/ink/paper. Load Switzer from Fontshare. Style `.ss-hub-grid` / `.ss-hub-card` like OpenClaw browse cards (title + one-line description). Style home hero.

- [ ] **Step 3: HubCards Vue component** listing the six hubs with links matching sidebar paths.

- [ ] **Step 4: Rewrite `index.md`** with hero, CTAs (Getting started, Self-host, Demo), `<HubCards />`, quickstart `check`/`record` (including blocked path), Start here links.

- [ ] **Step 5: `pnpm docs:build` PASS; manually spot-check `pnpm docs:dev` home if needed**

- [ ] **Step 6: Commit** — `Add SoftStop docs home and theme.`

---

### Task 3: Start + Self-host hubs (rewrite)

**Files:**
- `apps/docs/start/concept.md`
- `apps/docs/start/getting-started.md`
- `apps/docs/start/adoption-contract.md`
- `apps/docs/self-host/index.md`
- `apps/docs/self-host/docker.md`
- `apps/docs/self-host/env.md`
- `apps/docs/self-host/storage.md`

Source: `docs/CONCEPT.md`, `docs/SELF_HOST.md`, `docs/ADOPTION_CONTRACT.md`, `.env.example`, root README.

- [ ] **Step 1: Rewrite all seven pages** (real content, SoftStop naming, code-first).
- [ ] **Step 2: `pnpm docs:build` PASS**
- [ ] **Step 3: Commit** — `Add Start and Self-host docs pages.`

---

### Task 4: Integrate + API hubs (rewrite)

**Files:**
- `apps/docs/integrate/workflow.md`
- `apps/docs/integrate/sdk-js.md`
- `apps/docs/integrate/examples.md`
- `apps/docs/api/check.md`
- `apps/docs/api/record.md`
- `apps/docs/api/verify.md`
- `apps/docs/api/health.md`
- `apps/docs/api/errors.md`

Source: `docs/GOVERNOR_INTEGRATION_WORKFLOW.md`, `packages/sdk-js/README.md`, `examples/README.md`, `governor/README.md`.

- [ ] **Step 1: Rewrite all eight pages** (local `/v1` vs hosted `/api`; blocked-path record mandatory).
- [ ] **Step 2: `pnpm docs:build` PASS**
- [ ] **Step 3: Commit** — `Add Integrate and API docs pages.`

---

### Task 5: Policies + Ops hubs (rewrite)

**Files:**
- `apps/docs/policies/index.md`
- `apps/docs/policies/default-pack.md`
- `apps/docs/policies/action-types.md`
- `apps/docs/ops/orphan-rate.md`
- `apps/docs/ops/security.md`
- `apps/docs/ops/troubleshooting.md`

Source: `docs/default-policy-pack.md`, `docs/policies.md`, `docs/ADOPTION_CONTRACT.md`, `docs/security.md` / `SECURITY.md`.

- [ ] **Step 1: Rewrite all six pages**
- [ ] **Step 2: `pnpm docs:build` PASS**
- [ ] **Step 3: Commit** — `Add Policies and Ops docs pages.`

---

### Task 6: Cross-links + docs README pointer

**Files:**
- Modify: `demo/index.html` (Docs nav links)
- Modify: `README.md`
- Modify: `docs/README.md`
- Create or update: `apps/docs/.vitepress/config.mts` `DOCS_PUBLIC_URL` once known

Until a docs Vercel URL exists, point Docs links at the GitHub path `apps/docs` is wrong for users — prefer deploying first, then updating links. If deploy is deferred, use a clearly labeled interim note and keep GitHub `docs/README.md` as fallback with “Public site coming” + local `pnpm docs:dev`.

Preferred: deploy docs project, set `DOCS_PUBLIC_URL`, update demo + README to that URL.

- [ ] **Step 1: Update demo Docs links (desktop + mobile + section link)**
- [ ] **Step 2: Update root README Docs link**
- [ ] **Step 3: Update `docs/README.md` to lead with public site URL + local preview**
- [ ] **Step 4: Commit** — `Point demo and README at SoftStop docs site.`

---

### Task 7: Verification

- [ ] **Step 1: `pnpm docs:build` PASS**
- [ ] **Step 2: Confirm smoke covers all hubs**
- [ ] **Step 3: Spot-check search index includes check/record/orphan (local search built into VitePress build)**
- [ ] **Step 4: Report final URLs and how to run locally**

---

## Self-review vs spec

| Spec requirement | Task |
|---|---|
| `apps/docs` VitePress | 1 |
| SoftStop theme + hub cards | 2 |
| Six hubs rewritten | 3–5 |
| Separate from demo deploy | 1 (`vercel.json`) + deploy note |
| Cross-links | 6 |
| No archive/press in nav | 1 sidebar |
| Blocked path documented | 2 home + 4 API/integrate |
| Smoke / build verify | 1, 7 |
