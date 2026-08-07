"""Agent adapters: before_contact / wrap_user_facing_tool."""

from __future__ import annotations

from typing import Any, Callable, Mapping, MutableMapping, Protocol, TypedDict, Union


class SoftStopClient(Protocol):
    def check(
        self,
        *,
        user_id: str,
        action_type: str,
        surface: str | None = None,
        context: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]: ...

    def record(
        self,
        *,
        user_id: str,
        action_type: str,
        outcome: str,
        decision_id: str | None = None,
        block_reason: str | None = None,
        signals: Mapping[str, bool] | None = None,
        context: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]: ...


class BeforeContactAllowed(TypedDict):
    allowed: bool
    result: Any
    decision: dict[str, Any]


class BeforeContactBlocked(TypedDict):
    allowed: bool
    decision: dict[str, Any]
    suggested_action_type: str | None


BeforeContactResult = Union[BeforeContactAllowed, BeforeContactBlocked]


def before_contact(
    client: SoftStopClient,
    request: Mapping[str, Any],
    run: Callable[[], Any],
) -> BeforeContactResult:
    """
    Gate a user-facing escalation: check → run → record executed,
    or record blocked and skip the run.
    """
    actor = request.get("actor")
    context: MutableMapping[str, Any] = dict(request.get("context") or {})
    if actor:
        context["actor"] = actor

    decision = client.check(
        user_id=request["user_id"],
        action_type=request["action_type"],
        surface=request.get("surface"),
        context=context or None,
    )

    if not decision.get("allowed"):
        client.record(
            decision_id=decision.get("decisionId"),
            user_id=request["user_id"],
            action_type=request["action_type"],
            outcome="blocked",
            block_reason=decision.get("reason"),
            context={"actor": actor} if actor else None,
        )
        return {
            "allowed": False,
            "decision": decision,
            "suggested_action_type": decision.get("suggestedActionType"),
        }

    result = run()

    client.record(
        decision_id=decision.get("decisionId"),
        user_id=request["user_id"],
        action_type=request["action_type"],
        outcome="executed",
        context={"actor": actor} if actor else None,
    )

    return {"allowed": True, "result": result, "decision": decision}


def wrap_user_facing_tool(
    client: SoftStopClient,
    config: Mapping[str, Any],
    handler: Callable[[Mapping[str, Any]], Any],
) -> Callable[[Mapping[str, Any]], dict[str, Any]]:
    """
    Wrap a tool/function that contacts a human so SoftStop runs first.
    Framework-agnostic: LangChain tools, CrewAI tools, plain handlers.
    """

    def wrapped(args: Mapping[str, Any]) -> dict[str, Any]:
        user_id_cfg = config["user_id"]
        user_id = user_id_cfg(args) if callable(user_id_cfg) else user_id_cfg
        gated = before_contact(
            client,
            {
                "user_id": user_id,
                "action_type": config["action_type"],
                "surface": config.get("surface"),
                "actor": config.get("actor"),
                "context": {"toolArgs": dict(args)},
            },
            lambda: handler(args),
        )

        if not gated["allowed"]:
            return {
                "ok": False,
                "reason": gated["decision"].get("reason"),
                "decision": gated["decision"],
                "suggested_action_type": gated.get("suggested_action_type"),
            }

        return {
            "ok": True,
            "result": gated["result"],
            "decision": gated["decision"],
        }

    return wrapped


__all__ = [
    "before_contact",
    "wrap_user_facing_tool",
    "BeforeContactResult",
    "BeforeContactAllowed",
    "BeforeContactBlocked",
]
