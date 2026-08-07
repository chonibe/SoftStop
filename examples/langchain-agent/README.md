# LangChain / agent tool + SoftStop

Illustrative Python agent touchpoint using the published `softstop` package.
Same pattern works for CrewAI tools, OpenAI function handlers, or plain callables.

## Setup

```bash
# terminal 1 — SoftStop API
pnpm install && pnpm dev

# terminal 2
pip install -e ../../packages/sdk-python
# optional: pip install langchain   # only if you wire a real LangChain Tool
SOFTSTOP_API_URL=http://localhost:3000 python agent.py
```

## Pattern

`wrap_user_facing_tool` runs **check → handler → record `executed`**, or **record `blocked`** and skips the send.

```python
from softstop import SoftStop, wrap_user_facing_tool

ss = SoftStop(url="http://localhost:3000")

send_follow_up = wrap_user_facing_tool(
    ss,
    {
        "user_id": lambda args: args["user_id"],
        "action_type": "urgency",
        "surface": "email",
        "actor": "langchain-sales-agent",
    },
    lambda args: {"message_id": "msg_1", **args},
)
```

See [Governing AI agents](../../apps/docs/start/governing-ai-agents.md) and [Python SDK](../../packages/sdk-python/README.md).
