# Python SDK

Tiny Python client for SoftStop (`pip install softstop`).

## Install

```bash
pip install softstop
```

From a repo checkout:

```bash
pip install -e ./packages/sdk-python
```

## Usage

```python
from softstop import SoftStop

ss = SoftStop(url="http://localhost:3000")  # or SOFTSTOP_API_URL / GOVERNOR_API_URL

decision = ss.check(user_id="user_123", action_type="urgency", surface="email")

if not decision["allowed"]:
    ss.record(
        decision_id=decision["decisionId"],
        user_id="user_123",
        action_type="urgency",
        outcome="blocked",
        block_reason=decision["reason"],
    )
else:
    # escalate, then:
    ss.record(
        decision_id=decision["decisionId"],
        user_id="user_123",
        action_type="urgency",
        outcome="executed",
    )

status = ss.get_pressure("user_123")
```

The client picks `/v1` on localhost and `/api` on hosted hosts.

Non-2xx responses raise `SoftStopHttpError` (`status`, `body`).

### Fail-safe options

```python
from softstop import SoftStop, SoftStopUnavailableError

ss = SoftStop(
    url="http://localhost:3000",
    timeout_ms=400,                 # default 500
    on_unavailable="fail_closed",   # default — raises SoftStopUnavailableError on network/timeout
)

# Critical path only
critical = SoftStop(
    url="http://localhost:3000",
    on_unavailable="fail_open",     # { allowed: True, reason: "softstop_unavailable" } — no decisionId; skip record
    timeout_ms=300,
)
```

See [Errors — unreachable SoftStop](/api/errors#client-guidance-unreachable-softstop).

## Agent adapters

```python
from softstop import SoftStop, wrap_user_facing_tool

ss = SoftStop(url="http://localhost:3000")

# Inline: check → act → record
gated = ss.before_contact(
    {"user_id": user_id, "action_type": "urgency", "surface": "email", "actor": "sales-agent"},
    lambda: send_email(),
)

# Wrap a user-facing tool (LangChain / CrewAI / plain handlers)
send_follow_up = wrap_user_facing_tool(
    ss,
    {
        "user_id": lambda args: args["user_id"],
        "action_type": "urgency",
        "surface": "email",
        "actor": "agent",
    },
    lambda args: send_email(args),
)

result = send_follow_up({"user_id": "user_123", "subject": "Hi"})
if not result["ok"]:
    # SoftStop already recorded outcome: 'blocked'
    return {"error": result["reason"], "suggested_action_type": result.get("suggested_action_type")}
# SoftStop already recorded outcome: 'executed'
```

Outcomes are **`executed` | `blocked`** (also `downgraded` when you soften). Always include `actionType` on `record`.

Runnable example: [`examples/langchain-agent`](https://github.com/chonibe/SoftStop/tree/main/examples/langchain-agent).

## Next

- [Governing AI agents](/start/governing-ai-agents)
- [JS SDK](/integrate/sdk-js)
- [Examples](/integrate/examples)
- [API — check](/api/check)
