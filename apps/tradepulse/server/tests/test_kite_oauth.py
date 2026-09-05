"""Kite OAuth flow tests — run against the stub client, no network."""

from __future__ import annotations

import hashlib
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient

from tradepulse_server.app import STATE_PARAM, create_app
from tradepulse_server.config import Settings
from tradepulse_server.kite import (
    KiteSession,
    build_login_url,
    request_checksum,
)
from tradepulse_server.sessions import SessionStore, issue_state, verify_state

STUB_SETTINGS = Settings(
    auth_required=False,   # these suites test the routes, not the lock
    frontend_url="http://127.0.0.1:5273/",
    state_secret="test-secret",
    intel_db_path=":memory:",
)


@pytest.fixture
def client() -> TestClient:
    # follow_redirects=False so each hop in the handshake is assertable.
    return TestClient(create_app(STUB_SETTINGS), follow_redirects=False)


# --- pure helpers ---------------------------------------------------------

def test_checksum_matches_kite_spec():
    assert request_checksum("key", "token", "secret") == hashlib.sha256(
        b"keytokensecret"
    ).hexdigest()


def test_login_url_carries_api_key_and_redirect_params():
    url = build_login_url("my-key", redirect_params="tp_state=abc")
    query = parse_qs(urlparse(url).query)
    assert urlparse(url).netloc == "kite.zerodha.com"
    assert query["api_key"] == ["my-key"]
    assert query["v"] == ["3"]
    assert query["redirect_params"] == ["tp_state=abc"]


def test_state_round_trips_and_rejects_tampering():
    state = issue_state("secret")
    assert verify_state("secret", state)
    assert not verify_state("other-secret", state)
    assert not verify_state("secret", state[:-1] + ("0" if state[-1] != "0" else "1"))
    assert not verify_state("secret", None)
    assert not verify_state("secret", "not.a.state")


def test_session_store_hands_out_opaque_ids():
    store = SessionStore()
    session = KiteSession(user_id="AB1234", user_name="X", access_token="secret-token")
    session_id = store.create(session)

    assert session_id != "secret-token"
    assert store.get(session_id) is session
    assert store.get("nope") is None
    assert store.pop(session_id) is session
    assert store.get(session_id) is None


def test_public_view_never_leaks_the_access_token():
    view = KiteSession(user_id="AB1234", user_name="X", access_token="secret-token").public_view()
    assert "secret-token" not in str(view)
    assert "access_token" not in view


# --- HTTP flow ------------------------------------------------------------

def test_status_reports_stub_mode(client: TestClient):
    body = client.get("/api/kite/status").json()
    assert body == {
        "configured": False,
        "mode": "stub",
        "redirect_url": STUB_SETTINGS.redirect_url,
    }


def test_login_redirects_with_a_signed_state(client: TestClient):
    response = client.get("/api/kite/login")
    assert response.status_code == 307

    query = parse_qs(urlparse(response.headers["location"]).query)
    assert verify_state(STUB_SETTINGS.state_secret, query[STATE_PARAM][0])


def test_full_handshake_sets_a_session_cookie(client: TestClient):
    login = client.get("/api/kite/login")
    callback_url = login.headers["location"]

    callback = client.get(callback_url)
    assert callback.status_code == 303
    assert "kite=connected" in callback.headers["location"]

    session = client.get("/api/kite/session").json()
    assert session["authenticated"] is True
    assert session["profile"]["user_id"] == "AB1234"
    assert "access_token" not in str(session)


def test_callback_without_state_is_rejected(client: TestClient):
    response = client.get("/api/kite/callback?request_token=stub-request-token&status=success")
    assert response.status_code == 303
    assert "kite_error=state_mismatch" in response.headers["location"]
    assert client.get("/api/kite/session").json()["authenticated"] is False


def test_callback_with_a_forged_state_is_rejected(client: TestClient):
    forged = issue_state("attacker-secret")
    response = client.get(
        f"/api/kite/callback?request_token=t&status=success&{STATE_PARAM}={forged}"
    )
    assert "kite_error=state_mismatch" in response.headers["location"]
    assert client.get("/api/kite/session").json()["authenticated"] is False


def test_cancelled_login_reports_the_reason(client: TestClient):
    state = issue_state(STUB_SETTINGS.state_secret)
    response = client.get(f"/api/kite/callback?status=cancelled&{STATE_PARAM}={state}")
    assert "kite_error=login_cancelled" in response.headers["location"]


def test_logout_clears_the_session(client: TestClient):
    client.get(client.get("/api/kite/login").headers["location"])
    assert client.get("/api/kite/session").json()["authenticated"] is True

    assert client.post("/api/kite/logout").status_code == 200
    assert client.get("/api/kite/session").json()["authenticated"] is False


def test_portfolio_routes_need_a_session(client: TestClient):
    response = client.get("/api/kite/holdings")
    assert response.status_code == 401
    assert response.json()["error_type"] == "TokenException"


def test_portfolio_routes_serve_stub_fixtures_once_connected(client: TestClient):
    client.get(client.get("/api/kite/login").headers["location"])

    response = client.get("/api/kite/holdings")
    assert response.status_code == 200
    assert response.json()["data"][0]["tradingsymbol"] == "RELIANCE"


def test_unfixtured_paths_still_report_not_implemented():
    from tradepulse_server.kite import KiteError, StubKiteClient

    stub = StubKiteClient()
    with pytest.raises(KiteError) as caught:
        import asyncio

        asyncio.run(stub.get("/instruments", "stub-access-token"))
    assert caught.value.status == 501
