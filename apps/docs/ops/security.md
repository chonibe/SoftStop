# Security

SoftStop is infrastructure for runtime **escalation permits**. Deploy it with the same care as an API gateway or policy enforcement point.

## Recommendations

- Put SoftStop on the required path for every user-facing escalation  
- Prefer self-host; treat hosted demo as evaluation-only  
- Always pair `check` + `record`  
- Store minimal context — no raw message bodies or secrets  
- Use tenant-scoped keys for shared deployments  
- Monitor orphan rate so partial adoption cannot create false confidence  

## Non-goals

SoftStop does not inspect model internals, evaluate alignment, or determine whether generated text is safe. It controls whether pressure escalations may run.

Canonical repo guidance: [SECURITY.md](https://github.com/chonibe/SoftStop/blob/main/SECURITY.md).

## Next

- [Orphan rate](/ops/orphan-rate)
- [Self-host](/self-host/)
