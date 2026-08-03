"""Kite Connect v3 client — the pieces the OAuth handshake needs.

Flow (https://kite.trade/docs/connect/v3/user/#login-flow):

1. Send the browser to ``/connect/login?v=3&api_key=...``.
2. Kite authenticates the user and redirects to the app's registered redirect
   URL with ``request_token`` and ``status=success``.
3. The backend POSTs ``/session/token`` with
   ``checksum = sha256(api_key + request_token + api_secret)`` and gets back an
   ``access_token`` that is valid until roughly 6am IST the next morning.

The access token is a bearer credential for the whole trading account, so it
never leaves this process: the browser only ever holds an opaque session id.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlencode

import httpx

LOGIN_URL = "https://kite.zerodha.com/connect/login"
API_ROOT = "https://api.kite.trade"
API_VERSION = "3"


class KiteError(RuntimeError):
    """A Kite API call failed. ``message`` is safe to show a user."""

    def __init__(self, message: str, *, status: int = 502, error_type: str = "GeneralException"):
        super().__init__(message)
        self.message = message
        self.status = status
        self.error_type = error_type


@dataclass(frozen=True)
class KiteSession:
    """The subset of ``/session/token`` this app keeps."""

    user_id: str
    user_name: str
    access_token: str
    public_token: str = ""
    login_time: str = ""
    broker: str = "ZERODHA"
    email: str = ""
    exchanges: tuple[str, ...] = field(default_factory=tuple)

    def public_view(self) -> dict[str, Any]:
        """Everything the frontend may see — never the access token."""
        return {
            "user_id": self.user_id,
            "user_name": self.user_name,
            "email": self.email,
            "broker": self.broker,
            "login_time": self.login_time,
            "exchanges": list(self.exchanges),
        }


def build_login_url(api_key: str, *, redirect_params: str = "") -> str:
    """The URL the browser is sent to in step 1.

    ``redirect_params`` is echoed back verbatim on the redirect, which is how
    the OAuth state nonce survives the round trip — Kite has no ``state``
    parameter of its own.
    """
    query: dict[str, str] = {"v": API_VERSION, "api_key": api_key}
    if redirect_params:
        query["redirect_params"] = redirect_params
    return f"{LOGIN_URL}?{urlencode(query)}"


def request_checksum(api_key: str, request_token: str, api_secret: str) -> str:
    """SHA-256 of api_key + request_token + api_secret, as Kite specifies."""
    return hashlib.sha256(
        f"{api_key}{request_token}{api_secret}".encode()
    ).hexdigest()


def _unwrap(response: httpx.Response) -> Any:
    """Return a Kite envelope's ``data``, raising KiteError on anything else."""
    try:
        payload = response.json()
    except ValueError:
        raise KiteError(
            f"Kite returned a non-JSON response (HTTP {response.status_code}).",
            status=502,
        ) from None

    if response.status_code >= 400 or payload.get("status") == "error":
        raise KiteError(
            payload.get("message") or f"Kite request failed (HTTP {response.status_code}).",
            status=response.status_code if response.status_code >= 400 else 502,
            error_type=payload.get("error_type", "GeneralException"),
        )
    return payload.get("data", {})


class KiteClient:
    """Talks to the real Kite Connect API."""

    def __init__(self, api_key: str, api_secret: str, *, timeout: float = 10.0):
        self.api_key = api_key
        self.api_secret = api_secret
        self._timeout = timeout

    def login_url(self, *, redirect_params: str = "") -> str:
        return build_login_url(self.api_key, redirect_params=redirect_params)

    def _headers(self, access_token: str | None = None) -> dict[str, str]:
        headers = {"X-Kite-Version": API_VERSION}
        if access_token:
            headers["Authorization"] = f"token {self.api_key}:{access_token}"
        return headers

    async def exchange_request_token(self, request_token: str) -> KiteSession:
        """Step 3: trade the one-shot request token for an access token."""
        body = {
            "api_key": self.api_key,
            "request_token": request_token,
            "checksum": request_checksum(self.api_key, request_token, self.api_secret),
        }
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{API_ROOT}/session/token", data=body, headers=self._headers()
            )
        data = _unwrap(response)
        return KiteSession(
            user_id=data.get("user_id", ""),
            user_name=data.get("user_name", ""),
            access_token=data.get("access_token", ""),
            public_token=data.get("public_token", ""),
            login_time=data.get("login_time", ""),
            broker=data.get("broker", "ZERODHA"),
            email=data.get("email", ""),
            exchanges=tuple(data.get("exchanges", ())),
        )

    async def invalidate(self, access_token: str) -> None:
        """Best-effort logout; a token that is already dead is not an error."""
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            try:
                await client.delete(
                    f"{API_ROOT}/session/token",
                    params={"api_key": self.api_key, "access_token": access_token},
                    headers=self._headers(access_token),
                )
            except httpx.HTTPError:
                pass

    async def get(self, path: str, access_token: str) -> Any:
        """GET a portfolio endpoint (``/portfolio/holdings`` and friends)."""
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                f"{API_ROOT}{path}", headers=self._headers(access_token)
            )
        return _unwrap(response)


class StubKiteClient(KiteClient):
    """Stands in for Kite when no API credentials are configured.

    It short-circuits the network so the redirect handshake, the session
    cookie, and every frontend state can be driven end to end before a Zerodha
    developer app exists. Data is fixed and obviously fake.
    """

    STUB_REQUEST_TOKEN = "stub-request-token"

    def __init__(self) -> None:
        super().__init__(api_key="stub-api-key", api_secret="stub-api-secret")

    def login_url(self, *, redirect_params: str = "") -> str:
        # Bounce straight back to our own callback instead of Zerodha's.
        query = {"request_token": self.STUB_REQUEST_TOKEN, "action": "login", "status": "success"}
        if redirect_params:
            return f"?{urlencode(query)}&{redirect_params}"
        return f"?{urlencode(query)}"

    async def exchange_request_token(self, request_token: str) -> KiteSession:
        if not request_token:
            raise KiteError("Missing request token.", status=400, error_type="InputException")
        return KiteSession(
            user_id="AB1234",
            user_name="Stub User",
            access_token="stub-access-token",
            public_token="stub-public-token",
            login_time="2026-01-01 09:15:00",
            email="stub@example.invalid",
            exchanges=("NSE", "BSE", "NFO"),
        )

    async def invalidate(self, access_token: str) -> None:
        return None

    async def get(self, path: str, access_token: str) -> Any:
        """Serve the fixture for a known path; anything else is a real 501.

        Responses built from these are tagged ``mode: "stub"`` all the way to
        the UI, which shows the provenance rather than passing them off as an
        account.
        """
        from . import fixtures

        if path not in fixtures.BY_PATH:
            raise KiteError(
                f"No stub fixture for {path} — set KITE_API_KEY and "
                "KITE_API_SECRET to call the real API.",
                status=501,
                error_type="NotImplemented",
            )
        return fixtures.BY_PATH[path]
