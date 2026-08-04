# Errors & block reasons

## Block reasons from `check`

| `reason` | Meaning |
|---|---|
| `pressure_exceeded` | `pressure + cost` would exceed the policy threshold |
| `cooldown_active` | This action type is still in cooldown for the user |
| `type_cap_reached` | Per-type cap hit in the rolling window |
| `global_cap_reached` | Global cap across all types hit |
| `recent_escalation` | Stacking window — another hard escalation was too recent |
| `allowed` | Not a block — escalation may proceed |

When urgency or interruption is blocked, SoftStop may return `suggestedActionType: "reminder"`.

## HTTP / client errors

| Situation | What to do |
|---|---|
| SoftStop unreachable | Fail closed or queue — do not silently escalate without a decision |
| Invalid body (missing `userId` / `actionType`) | Fix the caller; do not invent defaults that hide miswiring |
| `record` without matching `decisionId` | Always use the id from the preceding `check` |

## Env aliases

Prefer SoftStop names; legacy Governor names still work where documented:

- `SOFTSTOP_API_URL` / `GOVERNOR_API_URL`
- `SOFTSTOP_POLICY` / `GOVERNOR_POLICY`
- `SOFTSTOP_POLICY_FILE` / `GOVERNOR_POLICY_FILE`

## Next

- [check](/api/check)
- [Default pack](/policies/default-pack)
- [Troubleshooting](/ops/troubleshooting)
