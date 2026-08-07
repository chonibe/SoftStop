# Security (docs)

SoftStop is infrastructure for runtime **escalation permits**. Deploy it with the same care as an API gateway or policy enforcement point.

Canonical security guidance: [SECURITY.md](../SECURITY.md) and [ADOPTION_CONTRACT.md](ADOPTION_CONTRACT.md).

## Recommendations

- Put SoftStop on the required path for every user-facing escalation.
- Prefer self-host; treat hosted demo as evaluation-only.
- Record decisions and outcomes (`check` + `record`). Never invent `decisionId`s on `/record` (rejected as `unknown_decision` unless explicitly unsafe).
- Store minimal context (no raw message bodies or secrets).
- Use tenant-scoped keys for hosted or shared deployments.
- Keep browser CORS locked down (`SOFTSTOP_CORS_ORIGINS` unset by default); demos may set `*`.
- Protect `/v1/policy` with `read:audit` — full policy is not a public surface.
- Monitor orphan rate via `health` so partial adoption cannot create false confidence.

## Non-Goals

SoftStop does not inspect model internals, evaluate alignment, or determine whether generated text is safe. It controls whether pressure escalations may run.
