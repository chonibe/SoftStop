"""HTTP helpers for SoftStop Python client (stdlib only)."""

from __future__ import annotations

import json
from typing import Any, Literal

OnUnavailable = Literal["fail_closed", "fail_open"]


class SoftStopHttpError(Exception):
    """Raised when SoftStop returns a non-2xx response."""

    def __init__(self, operation: str, status: int, body: Any, message: str | None = None):
        self.operation = operation
        self.status = status
        self.body = body
        detail = message
        if detail is None:
            if isinstance(body, dict) and body.get("error") is not None:
                detail = str(body["error"])
            else:
                detail = str(body)
        super().__init__(f"SoftStop {operation} failed ({status}): {detail}")


class SoftStopUnavailableError(Exception):
    """SoftStop was unreachable or timed out. Thrown under fail_closed (default)."""

    def __init__(self, operation: str, cause: BaseException | None = None):
        self.operation = operation
        self.cause = cause
        detail = str(cause) if cause is not None else "unreachable"
        super().__init__(
            f"SoftStop {operation} unavailable ({detail}); fail_closed — not inventing allowed:true"
        )


def fail_open_check_response() -> dict[str, Any]:
    """Synthetic check decision for explicit on_unavailable='fail_open'. No decisionId."""
    return {
        "allowed": True,
        "reason": "softstop_unavailable",
        "explanation": (
            "SoftStop unreachable or timed out; fail_open permitted the action without a "
            "server decision. Do not call record() — there is no decisionId."
        ),
    }


def read_json_or_throw(operation: str, response) -> Any:
    raw = response.read().decode("utf-8")
    status = getattr(response, "status", 200)
    if not raw:
        body: Any = None
    else:
        try:
            body = json.loads(raw)
        except json.JSONDecodeError:
            body = raw

    if status < 200 or status >= 300:
        raise SoftStopHttpError(operation, status, body)

    return body
