# SoftStop Docs Site Design

Date: 2026-08-03  
Status: Approved for planning  
Product: SoftStop

## Goal

Ship a public documentation site on a **docs subdomain**, with OpenClaw-style UX (hub cards, sidebar, search, docs chrome) and SoftStop brand (ink / paper / amber). Content is a **full rewrite** into a proper docs information architecture — not a raw dump of existing `docs/*.md`.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Hosting | Subdomain docs host (separate from demo site) |
| Look & feel | OpenClaw UX patterns + SoftStop brand |
| Content scope | Full rewrite + reorganized IA |
| Stack | VitePress in-repo |

## Architecture & hosting

- New app/package at `apps/docs` (VitePress).
- Deploy as its **own Vercel project** rooted at `apps/docs` (separate from the `demo/` project).
  - Interim URL: the project’s default `*.vercel.app` host until a docs subdomain is attached.
  - Production target: `docs.<softstop-domain>` (DNS + Vercel domain alias) when available.
  - Do not serve docs from the existing demo `outputDirectory: "demo"` project.
- Demo site (`softstop.vercel.app`, `demo/` output) stays the marketing/demo surface.
- Cross-links:
  - Demo header/nav → Docs subdomain
  - Docs header → Demo + GitHub repo
  - Root `README.md` Docs link → docs subdomain (not GitHub markdown tree)
- Local scripts: `pnpm docs:dev`, `pnpm docs:build`, `pnpm docs:preview` (wired from root or via `--filter`).
- Existing repo `docs/` markdown remains source material / internal notes. Public pages live under `apps/docs/` and are rewritten for the site. Do not auto-publish `docs/archive-internal/` or press kit into the nav.

## Information architecture

Top-level hubs (home “Browse docs” cards + sidebar roots):

| Hub | Purpose | Seed pages |
|---|---|---|
| **Start** | Orient newcomers | Concept, Getting started, Adoption contract |
| **Integrate** | Wire SoftStop into systems | Integration workflow, JS SDK, Examples (node / python / browser / agent) |
| **API** | HTTP contract | `check`, `record`, `verify`, `health`, errors |
| **Policies** | Server-side rules | Default pack, action types (`urgency` \| `discount` \| `interruption` \| `reminder`), env (`SOFTSTOP_POLICY` / `SOFTSTOP_POLICY_FILE`), custom policy files |
| **Self-host** | Run SoftStop | Local (`pnpm dev`), Docker, environment variables, storage (memory / Supabase) |
| **Ops** | Operate with confidence | Orphan rate / verify+health, security overview, troubleshooting |

### Home page structure (OpenClaw-like)

1. Brand + short positioning line (pressure permit / authorize-only)
2. Primary CTAs: Get started, Self-host, Live demo
3. “Browse docs” hub card grid (six hubs above)
4. Quickstart code path (`check` → escalate → `record`, including blocked path)
5. “Start here” short link list (Getting started, API check, Integration, Demo)

### URL shape

Prefer short, stable paths, e.g.:

- `/` — home
- `/start/concept`, `/start/getting-started`, `/start/adoption-contract`
- `/integrate/workflow`, `/integrate/sdk-js`, `/integrate/examples`
- `/api/check`, `/api/record`, `/api/verify`, `/api/health`, `/api/errors`
- `/policies/`, `/policies/default-pack`, `/policies/action-types`
- `/self-host/`, `/self-host/docker`, `/self-host/env`, `/self-host/storage`
- `/ops/orphan-rate`, `/ops/security`, `/ops/troubleshooting`

Exact filenames may use VitePress defaults as long as sidebar + hub cards stay consistent.

## UX shell & brand

- Header: SoftStop mark + “Docs” tag; search control (Cmd/Ctrl+K via VitePress local search); links to Demo and GitHub.
- Navigation: left sidebar by hub; on-page TOC for long guides.
- Theme: dark-first docs chrome using brand tokens:
  - Ink `#0B0B0F`
  - Paper `#F7F5F0`
  - Stop amber `#E8A317`
- Hub cards on home and section index pages; avoid dashboard clutter (no stat strips, no card grids for non-navigational content).
- Assets: reuse `docs/brand/` marks/icons (copy or symlink into `apps/docs/public` as needed).
- Out of visual scope: OpenClaw lobster aesthetic, purple AI gradients, multi-language switcher (v1 is English only).

## Content rewrite rules

- Public pages are **rewritten** for scanability: short sections, code-first, SoftStop terminology (`check` / `record`, action types, orphan rate).
- Source inputs (do not publish as-is without rewrite):
  - `docs/CONCEPT.md`, `docs/SELF_HOST.md`, `docs/ADOPTION_CONTRACT.md`, `docs/BEFORE_AFTER.md`
  - `docs/GOVERNOR_INTEGRATION_WORKFLOW.md`, `docs/default-policy-pack.md`, `docs/policies.md`
  - `docs/architecture.md`, `docs/security.md`, `governor/README.md`
  - `examples/**/README.md`, `packages/sdk-js/README.md`
- Prefer SoftStop naming in public copy; “Governor” only where historically needed (paths, legacy env aliases), with SoftStop as the product name.
- Always document the blocked path: when `check` denies, still `record` with `outcome: "blocked"` and `blockReason`.
- Do not invent per-touchpoint policy rules in docs; policies live in `policies/*.json` and env selection.

## Components / site pieces

| Piece | Responsibility |
|---|---|
| VitePress config | Title, theme config, sidebar, nav, search, base URL |
| Custom theme / CSS | SoftStop tokens, header brand tag, hub card styles |
| Home page (custom or MD) | Hero, CTAs, hub grid, quickstart |
| MD pages | One topic per page; frontmatter title + description |
| `public/` | Favicon, OG image from brand cover, marks |

No backend for v1. Search is client-side (VitePress local search). No AI “ask docs” chat in v1.

## Data flow

Static site generation only:

```
apps/docs/**/*.md → VitePress build → dist/ → Vercel (docs subdomain)
```

API examples in docs point at:

- Local: `http://localhost:3000` (preferred for self-host guides)
- Hosted demo API if documented: softstop.vercel.app paths as optional convenience — self-host remains primary

## Error handling & edge cases

- Broken internal links: fail CI or build-time link check if easy to add; otherwise manual verify in plan.
- Missing images: brand assets must resolve under `public/`; no hotlink dependency on GitHub raw URLs for core chrome.
- Env naming: document both `SOFTSTOP_*` and legacy `GOVERNOR_*` aliases where the server still accepts them; SoftStop names first.

## Testing / verification

- `pnpm docs:build` succeeds locally
- Spot-check: home hub cards, one page per hub, search finds “orphan”, “check”, “record”
- Demo site Docs link opens docs origin
- README Docs link points at docs origin
- After deploy: docs subdomain serves `/` and at least `/start/getting-started` and `/api/check`

## Out of scope (v1)

- i18n / language picker
- In-docs AI chat
- Custom domain DNS setup (document as follow-up if not owned yet)
- Publishing `docs/archive-internal/` or press kit into the public nav
- Replacing the live scroll demo with the docs home
- Mintlify / SaaS docs vendors

## Success criteria

1. Docs subdomain loads an OpenClaw-like SoftStop docs home with six hub cards.
2. All six hubs have real rewritten pages (not stubs that only say “TODO”).
3. Brand tokens and SoftStop mark are visible in chrome; no generic Inter/purple template look.
4. Newcomers can go home → Getting started → first `check`/`record` without reading the GitHub tree.
5. Demo + README clearly point at the docs site.
