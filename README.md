# Governor

Governor is a control layer that stops automated systems from over-pushing users. It answers a single question before any escalation: **is this allowed right now?**

## What's in this repo
- Narrative assets: [docs/SLIDE_KILLER.md](docs/SLIDE_KILLER.md), [docs/ONE_PAGER.md](docs/ONE_PAGER.md), [docs/CONCEPT.md](docs/CONCEPT.md)
- Project management: [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md), [PROJECT_DASHBOARD.md](PROJECT_DASHBOARD.md), [docs/TASK_QUEUE.md](docs/TASK_QUEUE.md)
- Governor feature: [governor/README.md](governor/README.md)
- Demo: [demo/index.html](demo/index.html) | [Slot Game Demo](demo/game/) | [Reports](demo/reports.html) (click to view/download Health, Admin Report, Audit)
- Tooling & CI: [turbo.json](turbo.json), [scripts/tenet-check.js](scripts/tenet-check.js), [tenet-policy.json](tenet-policy.json)
- MCP (Cursor): [.cursor/mcp.json](.cursor/mcp.json) – fetch & filesystem; see [.cursor/README.md](.cursor/README.md)
- **"Add Governor"** – Say "add Governor" in Cursor chat to integrate; see [docs/GOVERNOR_INTEGRATION_WORKFLOW.md](docs/GOVERNOR_INTEGRATION_WORKFLOW.md)

## Quickstart (local)
1. Install dependencies: `npm install` (or `pnpm install`)
2. Configure environment:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `PORT` (default 3000)
3. Start the API + demo: `npm run dev`
4. Open the demo at `http://localhost:3000/demo` or the slot game at `http://localhost:3000/demo/game/`

## Scripts
| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to `dist/` (required for Vercel API routes) |
| `npm run test` | Run Vitest (governor rules + API tests) |
| `npm run typecheck` | TypeScript check only |
| `npm run check:tenets` | Run tenet policy check on Core code |
| `npm run check:boundaries` | Verify apps/packages boundaries (when present) |
| `npm run check:all` | Boundaries + tenet check |
| `npm run build:game` | Build the slot game demo (`demo/slot-machine-temp` → `demo/game`) |

## Vercel deployment
- The demo is served at `/demo`.
- API routes: `/api/check`, `/api/record`, `/api/health`, `/api/verify`, `/api/report`, `/api/report/audit`, `/api/report/decisions`, `/api/report/insights`, `/api/analytics/user`, `/api/analytics/event`.
- The demo includes a decision panel showing allow/deny reasons.
- **Slot Game Demo** (`/demo/game/` or `/game/` on Vercel): Play an HTML5 slot machine; Governor gates post-spin bonus popups. Spin repeatedly to see blocks after cooldowns.
- **Validity test**: A/B variant assignment (A = Governor OFF, B = ON), session and event logging for D1/D7 return-rate measurement. See [docs/ANALYTICS_VALIDITY_TEST.md](docs/ANALYTICS_VALIDITY_TEST.md). Run `governor/api/db/migrations/002_analytics.sql` in Supabase before using.

## References
- Implementation: [governor/api/src/server.ts](governor/api/src/server.ts)
- Tests: [governor/tests/rules.test.ts](governor/tests/rules.test.ts)
- Performance tracking: [docs/perf/PERFORMANCE.md](docs/perf/PERFORMANCE.md)
- Adoption contract: [docs/ADOPTION_CONTRACT.md](docs/ADOPTION_CONTRACT.md)

## Version
1.0.0

## Change Log
- 1.0.0: Initial repository overview.
- Tooling & CI: Added root dependencies, turbo.json, tenet-check.js, tenet-policy.json, vitest.config.ts; boundary check skips when no apps/packages. MCP: .cursor/mcp.json (fetch, filesystem) and .cursor/README.md.