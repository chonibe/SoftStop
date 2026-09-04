# softstop

Tiny Python client for [SoftStop](https://softstop.vercel.app) — every AI agent should ask permission before interrupting a human.

## Install

```bash
pip install "git+https://github.com/chonibe/SoftStop.git#subdirectory=packages/sdk-python"
```

From this repo (editable):

```bash
pip install -e ./packages/sdk-python
```

## Usage

```python
from softstop import SoftStop, wrap_user_facing_tool

ss = SoftStop(
    url="http://localhost:3000",  # or SOFTSTOP_API_URL / GOVERNOR_API_URL
    # timeout_ms=500 (default), on_unavailable="fail_closed" (default)
    # on_unavailable="fail_open" → { allowed: True, reason: "softstop_unavailable" }; skip record
)

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

### Agent adapters

```python
# Inline gate: check → run → record executed, or record blocked and skip
gated = ss.before_contact(
    {"user_id": "user_123", "action_type": "urgency", "surface": "email", "actor": "sales-agent"},
    lambda: send_email(),
)

# Wrap any user-facing tool (LangChain / CrewAI / plain)
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
```

Outcomes are **`executed` | `blocked`** (also `downgraded` when you soften). Always pass `actionType` on `record`.

Self-host the SoftStop API with `pnpm dev` in the [SoftStop repo](https://github.com/chonibe/SoftStop). Hosted demo: `https://softstop.vercel.app` (paths use `/api` instead of `/v1`).

## Tests

```bash
cd packages/sdk-python
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pytest
```

## Publish prep (maintainers)

```bash
cd packages/sdk-python
pip install build twine
python -m build
# twine upload dist/*
```
