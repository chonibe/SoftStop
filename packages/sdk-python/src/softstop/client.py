"""SoftStop HTTP client — check / record / get_pressure."""

from __future__ import annotations

import json
import os
from typing import Any, Callable, Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

from softstop._http import SoftStopHttpError, read_json_or_throw
from softstop.agent import BeforeContactResult, before_contact


def _default_prefix(base_url: str) -> str:
    try:
        host = base_url.split("://", 1)[-1].split("/", 1)[0].split(":")[0]
        return "/v1" if host in ("localhost", "127.0.0.1") else "/api"
    except Exception:
        return "/v1"


class SoftStop:
    """
    SoftStop client — authorize-only pressure permit.

    ```python
    from softstop import SoftStop
    ss = SoftStop(url="http://localhost:3000")
    decision = ss.check(user_id="u1", action_type="urgency")
    ```
    """

    def __init__(
        self,
        url: str | None = None,
        *,
        base_url: str | None = None,
        api_key: str | None = None,
        prefix: str | None = None,
    ) -> None:
        raw = (
            url
            or base_url
            or os.getenv("SOFTSTOP_API_URL")
            or os.getenv("GOVERNOR_API_URL")
            or "http://localhost:3000"
        )
        self.base_url = str(raw).rstrip("/")
        self.prefix = prefix or _default_prefix(self.base_url)
        self.api_key = api_key

    def _headers(self) -> dict[str, str]:
        headers = {"Content-type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _request(
        self,
        method: str,
        path: str,
        *,
        operation: str,
        payload: dict[str, Any] | None = None,
        timeout: float = 30.0,
    ) -> Any:
        data = None if payload is None else json.dumps(payload).encode("utf-8")
        req = Request(
            f"{self.base_url}{self.prefix}{path}",
            data=data,
            headers=self._headers(),
            method=method,
        )
        try:
            with urlopen(req, timeout=timeout) as response:
                return read_json_or_throw(operation, response)
        except HTTPError as exc:
            raw = exc.read().decode("utf-8") if exc.fp else ""
            try:
                body = json.loads(raw) if raw else None
            except json.JSONDecodeError:
                body = raw
            raise SoftStopHttpError(operation, exc.code, body) from exc
        except URLError as exc:
            raise SoftStopHttpError(operation, 0, None, message=str(exc.reason)) from exc

    def check(
        self,
        *,
        user_id: str,
        action_type: str,
        surface: str | None = None,
        context: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"userId": user_id, "actionType": action_type}
        if surface is not None:
            payload["surface"] = surface
        if context is not None:
            payload["context"] = dict(context)
        return self._request("POST", "/check", operation="check", payload=payload)

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
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "userId": user_id,
            "actionType": action_type,
            "outcome": outcome,
        }
        if decision_id is not None:
            payload["decisionId"] = decision_id
        if block_reason is not None:
            payload["blockReason"] = block_reason
        if signals is not None:
            payload["signals"] = dict(signals)
        if context is not None:
            payload["context"] = dict(context)
        return self._request("POST", "/record", operation="record", payload=payload)

    def get_pressure(self, user_id: str, tenant_id: str | None = None) -> dict[str, Any]:
        qs = f"?{urlencode({'tenantId': tenant_id})}" if tenant_id else ""
        path = f"/users/{quote(user_id, safe='')}/pressure{qs}"
        return self._request("GET", path, operation="getPressure")

    def merge(
        self,
        *,
        from_user_id: str,
        to_user_id: str,
        tenant_id: str | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"fromUserId": from_user_id, "toUserId": to_user_id}
        if tenant_id is not None:
            payload["tenantId"] = tenant_id
        return self._request("POST", "/users/merge", operation="merge", payload=payload)

    def verify(self) -> dict[str, Any]:
        return self._request("POST", "/verify", operation="verify", payload={})

    def health(self) -> dict[str, Any]:
        return self._request("GET", "/health", operation="health")

    def before_contact(
        self,
        request: Mapping[str, Any],
        run: Callable[[], Any],
    ) -> BeforeContactResult:
        return before_contact(self, request, run)


__all__ = ["SoftStop", "SoftStopHttpError"]
