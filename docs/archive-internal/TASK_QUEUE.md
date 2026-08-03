# Task Queue

## Sprint 1

### Story S1.1: Narrative clarity for acquisition
- [x] Create killer slide content in [docs/SLIDE_KILLER.md](SLIDE_KILLER.md)  
  Success criteria: slide communicates the concept in under 60 seconds.
- [x] Create 1-pager in [docs/ONE_PAGER.md](ONE_PAGER.md)  
  Success criteria: non-Wix reader understands the problem and solution.
- [x] Create concept doc in [docs/CONCEPT.md](CONCEPT.md)  
  Success criteria: dev reader can implement the gate without guidance.

### Story S4.1: Project management baseline
- [x] Create roadmap in [PROJECT_ROADMAP.md](../PROJECT_ROADMAP.md)  
  Success criteria: epics, stories, and success criteria defined.
- [x] Create dashboard in [PROJECT_DASHBOARD.md](../PROJECT_DASHBOARD.md)  
  Success criteria: sprint focus and archive section present.
- [x] Create task queue in [docs/TASK_QUEUE.md](TASK_QUEUE.md)  
  Success criteria: tasks link to docs and map to stories.

### Story S2.1/S2.2: Core API and schema
- [x] Add Supabase schema in [governor/api/db/migrations/001_init.sql](../governor/api/db/migrations/001_init.sql)  
  Success criteria: events + state tables defined.
- [x] Implement `/v1/check` and `/v1/record` in [governor/api/src/app.ts](../governor/api/src/app.ts)  
  Success criteria: returns allow/deny and records outcomes.

### Story S3.1: Demo
- [x] Build local demo in [demo/index.html](../demo/index.html)  
  Success criteria: "before vs after" behavior is visible and explained.

### Story S4.2: Tests and docs completeness
- [x] Add rules tests in [governor/tests/rules.test.ts](../governor/tests/rules.test.ts)  
  Success criteria: covers cooldowns and caps.
- [x] Add API tests in [governor/tests/api.test.ts](../governor/tests/api.test.ts)  
  Success criteria: validates request/response contract.
- [x] Update root README in [README.md](../README.md)  
  Success criteria: run steps for API and demo.

## References
- Implementation: [governor/api/src/server.ts](../governor/api/src/server.ts)
- Tests: [governor/tests/rules.test.ts](../governor/tests/rules.test.ts)
- Performance tracking: [docs/perf/PERFORMANCE.md](perf/PERFORMANCE.md)

## Version
1.0.0

## Change Log
- 1.0.0: Initial task queue.
