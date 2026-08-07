"""SoftStop HTTP client — mirrors SoftStop check/record/pressure contract."""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest

from softstop import SoftStop, SoftStopHttpError


def _http_response(status: int, body: dict | list | str, reason: str = "OK"):
    raw = body if isinstance(body, str) else json.dumps(body)
    resp = MagicMock()
    resp.status = status
    resp.reason = reason
    resp.read.return_value = raw.encode("utf-8")
    resp.__enter__ = MagicMock(return_value=resp)
    resp.__exit__ = MagicMock(return_value=False)
    return resp


class TestSoftStopClient:
    def test_check_posts_payload_and_returns_decision(self):
        decision = {
            "allowed": True,
            "reason": "allowed",
            "decisionId": "dec-1",
            "pressure": 0,
            "cost": 40,
            "threshold": 100,
            "projectedPressure": 40,
        }
        with patch("softstop.client.urlopen", return_value=_http_response(200, decision)) as urlopen:
            ss = SoftStop(url="http://localhost:3000")
            result = ss.check(
                user_id="u1",
                action_type="urgency",
                surface="email",
                context={"campaign": "x"},
            )

        assert result["allowed"] is True
        assert result["decisionId"] == "dec-1"
        req = urlopen.call_args[0][0]
        assert req.full_url == "http://localhost:3000/v1/check"
        assert req.get_method() == "POST"
        assert json.loads(req.data.decode()) == {
            "userId": "u1",
            "actionType": "urgency",
            "surface": "email",
            "context": {"campaign": "x"},
        }
        assert req.headers["Content-type"] == "application/json"

    def test_record_includes_action_type_and_outcome(self):
        with patch("softstop.client.urlopen", return_value=_http_response(200, {"ok": True})) as urlopen:
            ss = SoftStop(url="http://localhost:3000")
            result = ss.record(
                decision_id="dec-1",
                user_id="u1",
                action_type="urgency",
                outcome="executed",
            )

        assert result["ok"] is True
        req = urlopen.call_args[0][0]
        assert req.full_url == "http://localhost:3000/v1/record"
        body = json.loads(req.data.decode())
        assert body == {
            "decisionId": "dec-1",
            "userId": "u1",
            "actionType": "urgency",
            "outcome": "executed",
        }

    def test_record_blocked_includes_block_reason(self):
        with patch("softstop.client.urlopen", return_value=_http_response(200, {"ok": True})) as urlopen:
            ss = SoftStop(url="http://localhost:3000")
            ss.record(
                decision_id="dec-2",
                user_id="u1",
                action_type="urgency",
                outcome="blocked",
                block_reason="pressure_exceeded",
            )

        body = json.loads(urlopen.call_args[0][0].data.decode())
        assert body["outcome"] == "blocked"
        assert body["blockReason"] == "pressure_exceeded"
        assert body["actionType"] == "urgency"

    def test_get_pressure_get_request(self):
        pressure = {
            "userId": "u1",
            "pressure": 40,
            "threshold": 100,
            "decayPerHour": 10,
            "updatedAt": None,
            "costs": {"urgency": 40},
        }
        with patch("softstop.client.urlopen", return_value=_http_response(200, pressure)) as urlopen:
            ss = SoftStop(url="http://localhost:3000")
            result = ss.get_pressure("u1")

        assert result["pressure"] == 40
        req = urlopen.call_args[0][0]
        assert req.full_url == "http://localhost:3000/v1/users/u1/pressure"
        assert req.get_method() == "GET"

    def test_hosted_host_uses_api_prefix(self):
        with patch(
            "softstop.client.urlopen",
            return_value=_http_response(200, {"allowed": True, "reason": "allowed"}),
        ) as urlopen:
            ss = SoftStop(url="https://softstop.vercel.app")
            ss.check(user_id="u1", action_type="reminder")

        assert urlopen.call_args[0][0].full_url.endswith("/api/check")

    def test_api_key_sets_authorization_header(self):
        with patch(
            "softstop.client.urlopen",
            return_value=_http_response(200, {"allowed": True, "reason": "allowed"}),
        ) as urlopen:
            ss = SoftStop(url="http://localhost:3000", api_key="secret")
            ss.check(user_id="u1", action_type="urgency")

        headers = {k.lower(): v for k, v in urlopen.call_args[0][0].headers.items()}
        assert headers.get("authorization") == "Bearer secret"

    def test_non_2xx_raises_softstop_http_error(self):
        with patch(
            "softstop.client.urlopen",
            return_value=_http_response(400, {"error": "unknown actionType"}, reason="Bad Request"),
        ):
            ss = SoftStop(url="http://localhost:3000")
            with pytest.raises(SoftStopHttpError) as exc:
                ss.check(user_id="u1", action_type="nope")
        assert exc.value.status == 400
        assert "unknown actionType" in str(exc.value)

    def test_env_softstop_api_url(self, monkeypatch):
        monkeypatch.setenv("SOFTSTOP_API_URL", "http://127.0.0.1:3000")
        with patch(
            "softstop.client.urlopen",
            return_value=_http_response(200, {"allowed": True, "reason": "allowed"}),
        ) as urlopen:
            ss = SoftStop()
            ss.check(user_id="u1", action_type="urgency")
        assert urlopen.call_args[0][0].full_url.startswith("http://127.0.0.1:3000/v1/")
