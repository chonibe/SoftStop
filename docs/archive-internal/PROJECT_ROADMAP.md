# Project Roadmap

## Vision
Governor is a platform safety layer that prevents automated systems from over‑pushing end users. It is designed to be acquisition‑ready for Wix as a multi‑agent platform.

## Target customer
- Wix platform teams and merchants using Wix automation and AI workflows.

## Epics → Stories → Success Criteria

### Epic E1: Narrative clarity and acquisition alignment
**Stories**
- S1.1: Produce a killer slide and 1‑pager that explains the problem, solution, and Wix relevance.
  - Success: External readers understand the idea in under 3 minutes.
- S1.2: Produce a dev‑friendly concept doc with API + schema clarity.
  - Success: A dev can implement the gate without direct coaching.

### Epic E2: Governor core service (v1)
**Stories**
- S2.1: Implement `/v1/check` with deterministic allow/deny decisions.
  - Success: Decisions respect cooldowns, caps, and stacking rules.
- S2.2: Implement `/v1/record` to update per‑user state.
  - Success: State updates are persisted and reflect hesitation signals.

### Epic E3: Working demo
**Stories**
- S3.1: Local demo showing “before vs after Governor”.
  - Success: Demo visibly blocks escalation after hesitation.

### Epic E4: Project management + documentation completeness
**Stories**
- S4.1: Maintain a task queue with clear success criteria and doc links.
  - Success: Each task maps to a story and links to relevant docs.
- S4.2: Maintain dashboard with completed task archive.
  - Success: Completed tasks are recorded by sprint and story.

## Milestones
- M1: Narrative + concept docs complete
- M2: Core API + schema complete
- M3: Demo complete and documented
- M4: Acquisition‑ready packaging

## Sprints (proposed)
- Sprint 1: Narrative + core API
- Sprint 2: Demo + tests + polish

## References
- Implementation: [governor/api/src/server.ts](governor/api/src/server.ts)
- Tests: [governor/tests/rules.test.ts](governor/tests/rules.test.ts)
- Performance tracking: [docs/perf/PERFORMANCE.md](docs/perf/PERFORMANCE.md)

## Version
1.0.0

## Change Log
- 1.0.0: Initial roadmap with epics and success criteria.
