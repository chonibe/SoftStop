# Commit Log (Main)

## Entry: Reports "just open the page" UX
- [x] Reports page: API key stored in localStorage on load from URL (?key= or #key=) or after successful report [demo/reports.html](../../../demo/reports.html)
- [x] Auto-restore key from localStorage so pilots bookmark and open without re-pasting
- [x] "Forget" button to clear saved key for shared devices
- [x] URL key stripped from address bar after use (replaceState)
- [x] Docs: pilot link format in [governor/README.md](../../../governor/README.md)

## Entry: API keys for secure report access
- [x] Migration [004_api_keys.sql](../../../governor/api/db/migrations/004_api_keys.sql): `tenant_api_keys` table (tenant_id, key_hash, name)
- [x] Storage: `getTenantByApiKey`, `createApiKey` in [storage.ts](../../../governor/api/src/storage/storage.ts), [supabaseStorage.ts](../../../governor/api/src/storage/supabaseStorage.ts)
- [x] Key resolution: [keys.ts](../../../governor/api/src/keys.ts) extracts API key from `Authorization: Bearer` or `X-Governor-Key`, validates, resolves tenantId
- [x] Report endpoints use resolved tenantId (key takes precedence over query tenantId) in [app.ts](../../../governor/api/src/app.ts) and Vercel handlers
- [x] Admin endpoint `POST /v1/admin/keys` and `/api/admin/keys` to create keys (requires `GOVERNOR_ADMIN_SECRET`)
- [x] Reports page: API key input (recommended), Tenant ID (fallback), `Authorization` header when key present
- [x] Env: `GOVERNOR_ADMIN_SECRET` in [env.ts](../../../governor/api/src/env.ts)

## Entry: Multi-tenant support (pilot isolation)
- [x] Added migration [003_tenants.sql](../../../governor/api/db/migrations/003_tenants.sql): `tenant_id` on `governor_events` and `governor_user_state`, composite PK `(tenant_id, user_id)`, tenant-scoped indexes
- [x] Schemas: optional `tenantId` in [schemas.ts](../../../governor/api/src/schemas.ts) for check/record
- [x] Types: optional `tenantId` on [GovernorEvent](../../../governor/api/src/types.ts)
- [x] Storage interface: `tenantId` param on all methods in [storage.ts](../../../governor/api/src/storage/storage.ts)
- [x] Handlers: read `tenantId` from payload/query, default `'default'`, pass through in [handlers.ts](../../../governor/api/src/handlers.ts)
- [x] SupabaseStorage: tenant-scoped queries in [supabaseStorage.ts](../../../governor/api/src/storage/supabaseStorage.ts); upsert onConflict `tenant_id,user_id`
- [x] MemoryStorage: composite key `${tenantId}:${userId}` and event filtering in [memoryStorage.ts](../../../governor/api/src/storage/memoryStorage.ts)
- [x] Express app: `tenantId` from body/query in [app.ts](../../../governor/api/src/app.ts)
- [x] Vercel handlers: pass `tenantId` in [api/health.js](../../../api/health.js), [api/verify.js](../../../api/verify.js), [api/report.js](../../../api/report.js), [api/report/audit.js](../../../api/report/audit.js), [api/report/decisions.js](../../../api/report/decisions.js), [api/report/insights.js](../../../api/report/insights.js)
- [x] Reports UI: tenant input and `?tenantId=` on all report fetches in [demo/reports.html](../../../demo/reports.html)
- [x] Docs: Multi-tenancy and `tenantId` in [governor/README.md](../../../governor/README.md)

## Entry: Validity test – A/B analytics for retention measurement
- [x] Added analytics schema: [governor/api/db/migrations/002_analytics.sql](../../../governor/api/db/migrations/002_analytics.sql) (analytics_users, analytics_events)
- [x] Added API endpoints: [api/analytics/user.js](../../../api/analytics/user.js), [api/analytics/event.js](../../../api/analytics/event.js)
- [x] Added analytics module: [demo/slot-machine-temp/src/js/analytics.js](../../../demo/slot-machine-temp/src/js/analytics.js) (getUserId, getVariant, session/nudge/spin/bonus logging)
- [x] Wired Governor to variant: Variant A = Governor OFF, B = ON: [demo/slot-machine-temp/src/js/Governor.js](../../../demo/slot-machine-temp/src/js/Governor.js)
- [x] Wired initAnalytics on first auth route: [demo/slot-machine-temp/src/js/router.js](../../../demo/slot-machine-temp/src/js/router.js)
- [x] Wired nudge events in TouchpointManager: [demo/slot-machine-temp/src/js/TouchpointManager.js](../../../demo/slot-machine-temp/src/js/TouchpointManager.js)
- [x] Wired logSpin in Slot.js, logBonusClaim in UIManager and lobbyPage: [demo/slot-machine-temp/src/js/Slot.js](../../../demo/slot-machine-temp/src/js/Slot.js), [demo/slot-machine-temp/src/js/UIManager.js](../../../demo/slot-machine-temp/src/js/UIManager.js), [demo/slot-machine-temp/src/js/pages/lobbyPage.js](../../../demo/slot-machine-temp/src/js/pages/lobbyPage.js)
- [x] Added analytics routes to Governor Express app for local dev: [governor/api/src/app.ts](../../../governor/api/src/app.ts)
- [x] Added validity test docs and D1/D7 SQL: [docs/ANALYTICS_VALIDITY_TEST.md](../../ANALYTICS_VALIDITY_TEST.md)

## Entry: Icon & graphics upgrade with Iconify
- [x] Replaced custom SVG icon paths with Iconify + Phosphor Icons (MIT) for UI: [demo/slot-machine-temp/src/js/icons.js](../../../demo/slot-machine-temp/src/js/icons.js)
- [x] Added `iconify-icon` web component and initialized in entry: [demo/slot-machine-temp/src/js/index.js](../../../demo/slot-machine-temp/src/js/index.js)
- [x] Updated design-system.css for iconify-icon styling: [demo/slot-machine-temp/src/css/design-system.css](../../../demo/slot-machine-temp/src/css/design-system.css)
- [x] All UI icons now use Phosphor (crown, coins, trophy, etc.) and Game Icons for slot-related symbols (cherry, lemon, grape, etc.)
- [x] Slot reel symbols: OpenGameArt pack (CC-BY 3.0) for cherry, lemon, orange, bell, bar, lucky7, scatter: [demo/slot-machine-temp/src/assets/symbols/](../../../demo/slot-machine-temp/src/assets/symbols/), [demo/slot-machine-temp/src/js/Symbol.js](../../../demo/slot-machine-temp/src/js/Symbol.js)
- [x] Added ATTRIBUTION.md for OGA symbols; diamond, grape, wild remain custom SVGs

## Entry: Governor Gaming Pilot – full slot game
- [x] Replaced Star Wars symbols with 10 casino SVGs (cherry, lemon, orange, grape, bell, bar, lucky7, diamond, wild, scatter): [demo/slot-machine-temp/src/assets/symbols/](../../../demo/slot-machine-temp/src/assets/symbols/)
- [x] Rewrote Symbol.js with weighted SYMBOLS_CONFIG: [demo/slot-machine-temp/src/js/Symbol.js](../../../demo/slot-machine-temp/src/js/Symbol.js)
- [x] Added GameState.js (GC/SC dual currency, localStorage): [demo/slot-machine-temp/src/js/GameState.js](../../../demo/slot-machine-temp/src/js/GameState.js)
- [x] Added Paylines.js and WinEvaluator.js (20 paylines, wild/scatter): [demo/slot-machine-temp/src/js/Paylines.js](../../../demo/slot-machine-temp/src/js/Paylines.js), [demo/slot-machine-temp/src/js/WinEvaluator.js](../../../demo/slot-machine-temp/src/js/WinEvaluator.js)
- [x] Added Governor layer: Governor.js, TouchpointManager.js (5 touchpoints), GovernorConsole.js: [demo/slot-machine-temp/src/js/Governor.js](../../../demo/slot-machine-temp/src/js/Governor.js), [demo/slot-machine-temp/src/js/TouchpointManager.js](../../../demo/slot-machine-temp/src/js/TouchpointManager.js), [demo/slot-machine-temp/src/js/GovernorConsole.js](../../../demo/slot-machine-temp/src/js/GovernorConsole.js)
- [x] Redesigned index.html and style.css with dark casino theme: [demo/slot-machine-temp/src/index.html](../../../demo/slot-machine-temp/src/index.html), [demo/slot-machine-temp/src/css/style.css](../../../demo/slot-machine-temp/src/css/style.css)
- [x] Added UIManager.js, Celebrations.js, BonusManager.js, SoundManager.js: [demo/slot-machine-temp/src/js/UIManager.js](../../../demo/slot-machine-temp/src/js/UIManager.js), [demo/slot-machine-temp/src/js/Celebrations.js](../../../demo/slot-machine-temp/src/js/Celebrations.js), [demo/slot-machine-temp/src/js/BonusManager.js](../../../demo/slot-machine-temp/src/js/BonusManager.js), [demo/slot-machine-temp/src/js/SoundManager.js](../../../demo/slot-machine-temp/src/js/SoundManager.js)
- [x] Rewrote Slot.js and enhanced Reel.js with full game loop and Governor touchpoint evaluation: [demo/slot-machine-temp/src/js/Slot.js](../../../demo/slot-machine-temp/src/js/Slot.js), [demo/slot-machine-temp/src/js/Reel.js](../../../demo/slot-machine-temp/src/js/Reel.js)
- [x] Added Governor Integration Patterns to [demo/game/README.md](../../../demo/game/README.md)

## Entry: Initial Governor v1 scaffolding
- [x] Added narrative docs and project management docs: [docs/ONE_PAGER.md](../../ONE_PAGER.md), [PROJECT_ROADMAP.md](../../../PROJECT_ROADMAP.md)
- [x] Added Supabase migration for governor tables: [governor/api/db/migrations/001_init.sql](../../../governor/api/db/migrations/001_init.sql)
- [x] Implemented Governor API with rules engine: [governor/api/src/app.ts](../../../governor/api/src/app.ts), [governor/api/src/rules/engine.ts](../../../governor/api/src/rules/engine.ts)
- [x] Added local demo and tests: [demo/index.html](../../../demo/index.html), [governor/tests/rules.test.ts](../../../governor/tests/rules.test.ts)

## Entry: Vercel deployment support
- [x] Added Vercel serverless handlers: [api/check.ts](../../../api/check.ts), [api/record.ts](../../../api/record.ts)
- [x] Refactored shared handlers and schemas: [governor/api/src/handlers.ts](../../../governor/api/src/handlers.ts), [governor/api/src/schemas.ts](../../../governor/api/src/schemas.ts)
- [x] Updated demo to pick local vs Vercel routes: [demo/demo.js](../../../demo/demo.js)
- [x] Updated docs for Vercel routes: [README.md](../../../README.md), [governor/README.md](../../../governor/README.md), [docs/CONCEPT.md](../../CONCEPT.md)

## Entry: Fix Vercel build typing
- [x] Removed unsupported insert count option: [governor/api/src/storage/supabaseStorage.ts](../../../governor/api/src/storage/supabaseStorage.ts)

## Entry: Vercel output directory
- [x] Added Vercel output configuration: [vercel.json](../../../vercel.json)

## Entry: Demo UI redesign
- [x] Refined demo layout and visuals: [demo/index.html](../../../demo/index.html), [demo/styles.css](../../../demo/styles.css)
- [x] Added decision panel updates: [demo/demo.js](../../../demo/demo.js)
- [x] Updated demo note in README: [README.md](../../../README.md)

## Entry: Slot game improvements (quality + stability)
- [x] Fixed API base path detection (localhost/127.0.0.1 → /v1, else → /api): [demo/slot-machine-temp/src/js/index.js](../../../demo/slot-machine-temp/src/js/index.js)
- [x] Added fail-open when API offline; modal shows "Governor offline – demo mode": [demo/slot-machine-temp/src/js/index.js](../../../demo/slot-machine-temp/src/js/index.js)
- [x] Removed dead polyfill.io script; Web Animations API supported in modern browsers
- [x] Upgraded slot visuals: premium casino theme, DM Sans, gold accents, glass-morphism panel: [demo/slot-machine-temp/src/css/style.css](../../../demo/slot-machine-temp/src/css/style.css), [demo/slot-machine-temp/src/index.html](../../../demo/slot-machine-temp/src/index.html)
- [x] Added "← Back to Demo" nav link; safer null checks for `decisionId`

## Entry: White-label slot game demo
- [x] Integrated HTML5 slot machine (MIT): [demo/slot-machine-temp/](../../../demo/slot-machine-temp/) (from [latebachelor/html5-slot-machine](https://github.com/latebachelor/html5-slot-machine))
- [x] Built output to [demo/game/](../../../demo/game/) with Governor check/record wiring
- [x] Governor gates post-spin bonus popup: calls `/v1/check` before showing nudge, `/v1/record` on claim/dismiss
- [x] Added `build:game` script and "Play Slot Demo" links to [demo/index.html](../../../demo/index.html)
- [x] Updated [README.md](../../../README.md) with slot demo docs

## Entry: Tooling, CI, and MCP
- [x] Added root dependencies (express, cors, zod, dotenv, @supabase/supabase-js) and dev deps (supertest, @types): [package.json](../../../package.json)
- [x] Added Turbo pipeline: [turbo.json](../../../turbo.json); dev/build/test/typecheck run at root
- [x] Implemented tenet check script and policy: [scripts/tenet-check.js](../../../scripts/tenet-check.js), [tenet-policy.json](../../../tenet-policy.json)
- [x] Added Vitest config for governor tests: [vitest.config.ts](../../../vitest.config.ts)
- [x] Updated boundary check to skip when no apps/packages: [scripts/check-boundaries.js](../../../scripts/check-boundaries.js)
- [x] Added project MCP config (fetch, filesystem): [.cursor/mcp.json](../../../.cursor/mcp.json), [.cursor/README.md](../../../.cursor/README.md)
- [x] Documented tooling and MCP in root README: [README.md](../../../README.md)

## References
- Implementation: [governor/api/src/server.ts](../../../governor/api/src/server.ts)
- Tests: [governor/tests/rules.test.ts](../../../governor/tests/rules.test.ts)
- Performance tracking: [docs/perf/PERFORMANCE.md](../../perf/PERFORMANCE.md)

## Version
1.0.0

## Change Log
- 1.0.0: Initial commit log entry template.
