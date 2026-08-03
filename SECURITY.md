# Security

SoftStop sits on the path where automated systems escalate pressure toward end users (email, SMS, push, in-app, pricing, agents). Treat per-user pressure state, decision logs, and API keys as sensitive infrastructure data.

## Reporting a vulnerability

**Preferred:** [GitHub private security advisories](https://github.com/chonibe/SoftStop/security/advisories/new) for this repository.

Please do not open public issues for undisclosed vulnerabilities.

## Security model

SoftStop returns a deterministic permit decision:

- `allowed: true` — the escalation may proceed; caller must `record` the outcome
- `allowed: false` — the escalation must not run (or must be downgraded); still `record` with `outcome: "blocked"`

SoftStop only protects users when **every** escalation touchpoint calls `check` and a matching `record`. Partial adoption creates false confidence — see [ADOPTION_CONTRACT.md](docs/ADOPTION_CONTRACT.md).

Deploy SoftStop where escalation code cannot bypass it (shared libraries, server-side senders, platform dispatchers). Client-only checks are advisory unless the server re-validates.

## Self-host trust

Prefer running the API inside your own network. The optional hosted demo is for evaluation, not a production dependency.

## Sensitive data

Avoid storing raw message bodies, secrets, or unnecessary PII in `context` or audit payloads. Prefer stable user identifiers and minimal metadata.
