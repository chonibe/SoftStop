# Governor

Governor is a control layer that stops automated systems from over-pushing users. It answers a single question before any escalation: **is this allowed right now?**

## What's in this repo
- Narrative assets: [docs/SLIDE_KILLER.md](docs/SLIDE_KILLER.md), [docs/ONE_PAGER.md](docs/ONE_PAGER.md), [docs/CONCEPT.md](docs/CONCEPT.md)
- Project management: [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md), [PROJECT_DASHBOARD.md](PROJECT_DASHBOARD.md), [docs/TASK_QUEUE.md](docs/TASK_QUEUE.md)
- Governor feature: [governor/README.md](governor/README.md)
- Demo: [demo/index.html](demo/index.html)

## Quickstart (local)
1. Install dependencies: `npm install`
2. Configure environment:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `PORT` (default 3000)
3. Start the API + demo: `npm run dev`
4. Open the demo at `http://localhost:3000/demo`

## References
- Implementation: [governor/api/src/server.ts](governor/api/src/server.ts)
- Tests: [governor/tests/rules.test.ts](governor/tests/rules.test.ts)
- Performance tracking: [docs/perf/PERFORMANCE.md](docs/perf/PERFORMANCE.md)

## Version
1.0.0

## Change Log
- 1.0.0: Initial repository overview.
