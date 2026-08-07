"""Fail-safe modes: on_unavailable + timeout_ms."""

from __future__ import annotations

import socket
from unittest.mock import MagicMock, patch
from urllib.error import URLError

import pytest

from softstop import SoftStop, SoftStopHttpError, SoftStopUnavailableError


def _http_response(status: int, body: dict | list | str, reason: str = "OK"):
    import json

    raw = body if isinstance(body, str) else json.dumps(body)
    resp = MagicMock()
    resp.status = status
    resp.reason = reason
    resp.read.return_value = raw.encode("utf-8")
    resp.__enter__ = MagicMock(return_value=resp)
    resp.__exit__ = MagicMock(return_value=False)
    return resp


class TestFailSafeModes:
    def test_defaults_to_fail_closed_and_raises_on_network_failure(self):
        with patch(
            "softstop.client.urlopen",
            side_effect=URLError("Connection refused"),
        ):
            ss = SoftStop(url="http://localhost:3000")
            with pytest.raises(SoftStopUnavailableError) as exc:
                ss.check(user_id="u1", action_type="urgency")
        assert exc.value.operation == "check"
        assert "fail_closed" in str(exc.value)
        assert "unavailable" in str(exc.value).lower() or "unreachable" in str(exc.value).lower()

    def test_fail_open_returns_explicit_softstop_unavailable_without_decision_id(self):
        with patch(
            "softstop.client.urlopen",
            side_effect=URLError("Connection refused"),
        ):
            ss = SoftStop(url="http://localhost:3000", on_unavailable="fail_open")
            decision = ss.check(user_id="u1", action_type="urgency")

        assert decision["allowed"] is True
        assert decision["reason"] == "softstop_unavailable"
        assert "decisionId" not in decision or decision.get("decisionId") is None
        assert "fail_open" in (decision.get("explanation") or "").lower()

    def test_never_invents_silent_allowed_when_fail_closed(self):
        with patch(
            "softstop.client.urlopen",
            side_effect=URLError("network down"),
        ):
            ss = SoftStop(url="http://localhost:3000", on_unavailable="fail_closed")
            with pytest.raises(SoftStopUnavailableError):
                ss.check(user_id="u1", action_type="reminder")

    def test_timeout_ms_passed_to_urlopen(self):
        with patch(
            "softstop.client.urlopen",
            return_value=_http_response(
                200, {"allowed": True, "reason": "allowed", "decisionId": "dec-1"}
            ),
        ) as urlopen:
            ss = SoftStop(url="http://localhost:3000", timeout_ms=250)
            ss.check(user_id="u1", action_type="urgency")

        assert urlopen.call_args.kwargs.get("timeout") == 0.25

    def test_timeout_treated_as_unavailable_fail_closed(self):
        with patch(
            "softstop.client.urlopen",
            side_effect=socket.timeout("timed out"),
        ):
            ss = SoftStop(url="http://localhost:3000", timeout_ms=50)
            with pytest.raises(SoftStopUnavailableError) as exc:
                ss.check(user_id="u1", action_type="urgency")
        assert exc.value.operation == "check"

    def test_fail_open_does_not_swallow_http_errors(self):
        with patch(
            "softstop.client.urlopen",
            return_value=_http_response(400, {"error": "unknown actionType"}, reason="Bad Request"),
        ):
            ss = SoftStop(url="http://localhost:3000", on_unavailable="fail_open")
            with pytest.raises(SoftStopHttpError) as exc:
                ss.check(user_id="u1", action_type="nope")
        assert exc.value.status == 400

    def test_before_contact_skips_record_on_fail_open_unavailable(self):
        calls: list[str] = []

        def fake_urlopen(req, timeout=None):
            calls.append(req.full_url)
            if "/check" in req.full_url:
                raise URLError("Connection refused")
            return _http_response(200, {"ok": True})

        with patch("softstop.client.urlopen", side_effect=fake_urlopen):
            ss = SoftStop(url="http://localhost:3000", on_unavailable="fail_open")
            run = MagicMock(return_value="sent")
            gated = ss.before_contact(
                {"user_id": "u1", "action_type": "urgency"},
                run,
            )

        assert gated["allowed"] is True
        assert gated["result"] == "sent"
        assert gated["decision"]["reason"] == "softstop_unavailable"
        run.assert_called_once()
        assert len(calls) == 1
        assert calls[0].endswith("/check")
