"""Agent helpers: before_contact / wrap_user_facing_tool."""

from __future__ import annotations

from unittest.mock import MagicMock

from softstop import SoftStop, before_contact, wrap_user_facing_tool


def _client_with(check_return, record_return=None):
    client = MagicMock(spec=SoftStop)
    client.check.return_value = check_return
    client.record.return_value = record_return or {"ok": True}
    return client


class TestBeforeContact:
    def test_runs_and_records_executed_when_allowed(self):
        decision = {
            "allowed": True,
            "reason": "allowed",
            "decisionId": "dec-1",
            "pressure": 0,
            "cost": 40,
            "threshold": 100,
            "projectedPressure": 40,
        }
        client = _client_with(decision)
        run = MagicMock(return_value="sent")

        result = before_contact(
            client,
            {
                "user_id": "u1",
                "action_type": "urgency",
                "surface": "email",
                "actor": "sales-agent",
            },
            run,
        )

        assert result["allowed"] is True
        assert result["result"] == "sent"
        run.assert_called_once()
        client.check.assert_called_once()
        check_kwargs = client.check.call_args.kwargs
        assert check_kwargs["user_id"] == "u1"
        assert check_kwargs["action_type"] == "urgency"
        assert check_kwargs["context"]["actor"] == "sales-agent"
        client.record.assert_called_once()
        record_kwargs = client.record.call_args.kwargs
        assert record_kwargs["outcome"] == "executed"
        assert record_kwargs["action_type"] == "urgency"
        assert record_kwargs["decision_id"] == "dec-1"
        assert record_kwargs["context"]["actor"] == "sales-agent"

    def test_skips_run_and_records_blocked_when_denied(self):
        decision = {
            "allowed": False,
            "reason": "pressure_exceeded",
            "decisionId": "dec-2",
            "suggestedActionType": "reminder",
            "pressure": 80,
            "cost": 40,
            "threshold": 100,
            "projectedPressure": 120,
        }
        client = _client_with(decision)
        run = MagicMock(return_value="sent")

        result = before_contact(
            client,
            {"user_id": "u1", "action_type": "urgency"},
            run,
        )

        assert result["allowed"] is False
        assert result["suggested_action_type"] == "reminder"
        assert result["decision"]["reason"] == "pressure_exceeded"
        run.assert_not_called()
        record_kwargs = client.record.call_args.kwargs
        assert record_kwargs["outcome"] == "blocked"
        assert record_kwargs["block_reason"] == "pressure_exceeded"
        assert record_kwargs["action_type"] == "urgency"

    def test_softstop_before_contact_method(self):
        decision = {
            "allowed": True,
            "reason": "allowed",
            "decisionId": "dec-9",
        }
        client = SoftStop(url="http://localhost:3000")
        client.check = MagicMock(return_value=decision)
        client.record = MagicMock(return_value={"ok": True})

        result = client.before_contact(
            {"user_id": "u1", "action_type": "reminder"},
            lambda: "ok",
        )
        assert result["allowed"] is True
        assert result["result"] == "ok"


class TestWrapUserFacingTool:
    def test_wraps_contact_tool(self):
        decision = {
            "allowed": True,
            "reason": "allowed",
            "decisionId": "dec-3",
            "pressure": 0,
            "cost": 30,
            "threshold": 100,
            "projectedPressure": 30,
        }
        client = _client_with(decision)
        send_sms = wrap_user_facing_tool(
            client,
            {
                "user_id": lambda args: str(args["to"]),
                "action_type": "discount",
                "surface": "sms",
                "actor": "marketing-agent",
            },
            lambda args: {"delivered": True, "to": args["to"]},
        )

        out = send_sms({"to": "user_9", "body": "20% off"})
        assert out["ok"] is True
        assert out["result"]["delivered"] is True
        assert client.check.call_args.kwargs["user_id"] == "user_9"
        assert client.check.call_args.kwargs["action_type"] == "discount"
        assert client.record.call_args.kwargs["outcome"] == "executed"

    def test_wrap_returns_ok_false_when_blocked(self):
        decision = {
            "allowed": False,
            "reason": "cooldown_active",
            "decisionId": "dec-4",
            "suggestedActionType": "reminder",
        }
        client = _client_with(decision)
        tool = wrap_user_facing_tool(
            client,
            {"user_id": "u1", "action_type": "urgency"},
            lambda args: {"sent": True},
        )
        out = tool({"subject": "hi"})
        assert out["ok"] is False
        assert out["reason"] == "cooldown_active"
        assert out["suggested_action_type"] == "reminder"
        assert client.record.call_args.kwargs["outcome"] == "blocked"
