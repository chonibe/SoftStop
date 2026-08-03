# Orphan rate

An **orphan** is a `check` without a matching `record`. High orphan rate means SoftStop’s state drifts from reality — caps and cooldowns become wrong, and you may believe users are protected when they are not.

## Target

**orphanRate &lt; 0.05** on `GET …/health`.

## Common causes

| Cause | Fix |
|---|---|
| Blocked path skips `record` | Always record `outcome: "blocked"` |
| Crash after check, before record | Record in `finally` / queue retry |
| Only some services call SoftStop | Wire every touchpoint or admit partial coverage |
| Wrong `decisionId` | Pass the id returned by `check` |

## How to inspect

```bash
curl 'http://localhost:3000/v1/health?periodHours=24'
SOFTSTOP_API_URL=http://localhost:3000 pnpm softstop health
```

## Related

- [Adoption contract](/start/adoption-contract)
- [health API](/api/health)
- [record](/api/record)
