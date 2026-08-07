#!/usr/bin/env python3
"""
LangChain-style agent tool gated by SoftStop.

No LangChain dependency required — this mirrors Tool.invoke / function-call shape.
Swap the handler for a real Resend/Twilio/LangChain tool body in production.
"""

from __future__ import annotations

import os
import sys

try:
    from softstop import SoftStop, wrap_user_facing_tool
except ImportError:
    print(
        "Install the SoftStop Python SDK first:\n"
        "  pip install -e ../../packages/sdk-python\n"
        "  # or: pip install softstop",
        file=sys.stderr,
    )
    raise SystemExit(1)


def send_email(args: dict) -> dict:
    """Stand-in for Resend / SMTP / LangChain tool body."""
    print(f"  → sending email to {args['user_id']}: {args.get('subject', '')}")
    return {"message_id": "msg_demo", "user_id": args["user_id"], "subject": args.get("subject")}


def main() -> None:
    url = os.getenv("SOFTSTOP_API_URL") or os.getenv("GOVERNOR_API_URL") or "http://localhost:3000"
    ss = SoftStop(url=url)

    send_follow_up = wrap_user_facing_tool(
        ss,
        {
            "user_id": lambda args: str(args["user_id"]),
            "action_type": "urgency",
            "surface": "email",
            "actor": "langchain-sales-agent",
        },
        send_email,
    )

    print(f"SoftStop @ {url}")
    print("Attempt 1 (expect allow on empty pressure journal)…")
    first = send_follow_up({"user_id": "lc_user_1", "subject": "Quick follow-up"})
    print(f"  result: {first}")

    print("Attempt 2 (may block under default cooldown / pressure)…")
    second = send_follow_up({"user_id": "lc_user_1", "subject": "Still here?"})
    print(f"  result: {second}")

    if not second.get("ok"):
        print(
            f"  blocked → suggested_action_type={second.get('suggested_action_type')!r} "
            f"(steer the model; SoftStop already recorded outcome='blocked')"
        )

    pressure = ss.get_pressure("lc_user_1")
    print(f"pressure: {pressure.get('pressure')} / {pressure.get('threshold')}")


if __name__ == "__main__":
    main()
