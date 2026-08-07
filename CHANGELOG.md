# Changelog

## 0.2.2 — Agent deny schema + withSoftStop

- Additive deny fields: `suggestedFallback`, `retryAfterMs` (keep `suggestedActionType`)
- SDK `formatBlockedForLlm(decision)` — stable JSON for LLM tool results
- SDK `withSoftStop(execute, config)` — Vercel AI SDK `tool({ execute })` wrapper on top of `wrapUserFacingTool`
- Docs: governing-ai-agents, sdk-js, check, errors; example `agent-tool-wrapper` updated

## 0.2.1 — Thin agent adapters

- SDK `beforeContact` / `SoftStop#beforeContact` — check → run → record for user-facing escalations
- SDK `wrapUserFacingTool` — framework-agnostic tool wrapper (OpenAI / LangChain / plain handlers)
- Examples: `agent-tool-wrapper`, updated `agent-touchpoint`

## 0.2.0 — User pressure engine

- Numeric **user pressure**: server-owned costs, linear decay, threshold gate (`pressure_exceeded`)
- `GET /v1/users/:userId/pressure` (and `/api/...`) for live decayed score
- `check` responses include `pressure`, `cost`, `threshold`, `projectedPressure`
- Policy packs: `threshold`, `decayPerHour`, `costs` (default / strict / lenient)
- SDK: pressure fields on `check` + `getPressure(userId)`
- Golden path example: `examples/agent-email-collision`
- Positioning: AI agents ask before interrupting a human (press release + README)

## 0.1.0 — SoftStop public release

- Open-source SoftStop: authorize-only pressure permit (`check` / `record`)
- Default escalation pack: urgency, discount, interruption, reminder
- Self-host (local + Docker), adoption contract (`verify`, `health`)
- Product packaging: brand assets, docs hub, scroll demo SoftStop rebrand
- Examples: Node, Python, browser, agent-touchpoint
