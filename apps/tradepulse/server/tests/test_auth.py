"""The app's own login: the lock in front of every /api route."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from tradepulse_server.app import create_app
from tradepulse_server.auth import MAX_FAILURES, resolve_passcode
from tradepulse_server.config import Settings

SETTINGS = Settings(
    frontend_url="http://127.0.0.1:5273/",
    state_secret="test-secret",
    intel_db_path=":memory:",
    passcode="open-sesame",
    user_name="Priya",
)


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app(SETTINGS), follow_redirects=False)


GATED = [
    "/api/kite/status", "/api/kite/session", "/api/intel/coverage",
    "/api/intel/performance", "/api/intel/recommendations",
]


@pytest.mark.parametrize("path", GATED)
def test_every_api_route_is_closed_without_a_login(client: TestClient, path: str):
    response = client.get(path)
    assert response.status_code == 401
    assert response.json()["error_type"] == "LoginRequired"


def test_health_and_the_login_itself_stay_open(client: TestClient):
    assert client.get("/healthz").status_code == 200
    body = client.get("/api/auth/session").json()
    assert body == {"authenticated": False, "required": True}


def test_the_right_passcode_opens_the_door(client: TestClient):
    response = client.post("/api/auth/login", json={"passcode": "open-sesame"})
    assert response.status_code == 200
    assert response.json()["user"] == {"name": "Priya"}
    assert "tradepulse_auth" in response.cookies

    # The cookie now carries every request.
    assert client.get("/api/intel/coverage").status_code == 200
    assert client.get("/api/auth/session").json()["authenticated"] is True


def test_the_wrong_passcode_does_not(client: TestClient):
    response = client.post("/api/auth/login", json={"passcode": "guess"})
    assert response.status_code == 401
    assert "tradepulse_auth" not in response.cookies
    assert client.get("/api/intel/coverage").status_code == 401


def test_repeated_failures_lock_the_client_out(client: TestClient):
    for _ in range(MAX_FAILURES):
        assert client.post("/api/auth/login", json={"passcode": "nope"}).status_code == 401
    # Even the right passcode is refused while locked out.
    response = client.post("/api/auth/login", json={"passcode": "open-sesame"})
    assert response.status_code == 429
    assert response.json()["error_type"] == "LockedOut"


def test_logout_closes_the_app_and_the_broker_together(client: TestClient):
    client.post("/api/auth/login", json={"passcode": "open-sesame"})
    # Connect the (stub) broker on top of the login.
    # The stub's login redirect points straight at the callback.
    login = client.get("/api/kite/login")
    client.get(login.headers["location"])
    assert client.get("/api/kite/session").json()["authenticated"] is True

    client.post("/api/auth/logout")

    assert client.get("/api/auth/session").json()["authenticated"] is False
    assert client.get("/api/kite/session").status_code == 401     # gate first
    # And the broker session is gone too, not merely hidden behind the gate.
    assert len(client.app.state.sessions) == 0


def test_the_passcode_never_reaches_the_browser(client: TestClient):
    body = client.post("/api/auth/login", json={"passcode": "open-sesame"})
    assert "open-sesame" not in body.text
    assert "open-sesame" not in body.headers.get("set-cookie", "")


def test_no_passcode_configured_never_means_open(caplog):
    """A forgotten variable costs a copy-paste from the log, not an open door."""
    with caplog.at_level("WARNING", logger="tradepulse.auth"):
        generated = resolve_passcode("", required=True)
    assert len(generated) >= 12
    assert generated in caplog.text

    app = create_app(Settings(passcode="", intel_db_path=":memory:", state_secret="s"))
    c = TestClient(app)
    assert c.get("/api/intel/coverage").status_code == 401
    assert c.post("/api/auth/login", json={"passcode": app.state.passcode}).status_code == 200


def test_auth_can_be_switched_off_only_explicitly():
    app = create_app(Settings(auth_required=False, intel_db_path=":memory:", state_secret="s"))
    c = TestClient(app)
    assert c.get("/api/intel/coverage").status_code == 200
    assert c.get("/api/auth/session").json() == {
        "authenticated": True, "required": False, "user": {"name": "Investor"},
    }
