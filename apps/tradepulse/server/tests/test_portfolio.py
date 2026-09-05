"""/api/kite/portfolio — the endpoint the UI actually consumes."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from tradepulse_server.app import create_app
from tradepulse_server.config import Settings
from tradepulse_server.kite import KiteError, StubKiteClient

SETTINGS = Settings(
    auth_required=False,   # these suites test the routes, not the lock
    frontend_url="http://127.0.0.1:5273/",
    state_secret="test-secret",
    # Each test app gets its own throwaway store; the production default is
    # a file, and sharing it across tests leaks state between them.
    intel_db_path=":memory:",
)


@pytest.fixture
def app():
    return create_app(SETTINGS)


@pytest.fixture
def client(app) -> TestClient:
    return TestClient(app, follow_redirects=False)


def connect(client: TestClient) -> None:
    client.get(client.get("/api/kite/login").headers["location"])


def test_portfolio_needs_a_session(client: TestClient):
    response = client.get("/api/kite/portfolio")
    assert response.status_code == 401
    assert response.json()["error_type"] == "TokenException"


def test_portfolio_returns_ui_shaped_holdings(client: TestClient):
    connect(client)
    body = client.get("/api/kite/portfolio").json()

    assert body["mode"] == "stub"
    assert body["broker"] == "Zerodha"
    assert body["unavailable"] == []

    symbols = [h["sym"] for h in body["holdings"]]
    assert "RELIANCE" in symbols
    assert "YESBANK" not in symbols  # zero-quantity row dropped by the mapper

    reliance = next(h for h in body["holdings"] if h["sym"] == "RELIANCE")
    assert set(reliance) == {
        "sym", "qty", "avg", "ltp", "dayPct", "broker", "segment",
        "isin", "pledged", "exchange",
    }
    assert reliance["segment"] == "IN"
    assert reliance["broker"] == "Zerodha"


def test_t1_and_pledged_flags_survive_the_round_trip(client: TestClient):
    connect(client)
    holdings = client.get("/api/kite/portfolio").json()["holdings"]

    axis = next(h for h in holdings if h["sym"] == "AXISBANK")
    assert axis["qty"] == 25.0  # 20 settled + 5 T1

    steel = next(h for h in holdings if h["sym"] == "TATASTEEL")
    assert steel["pledged"] is True


def test_summary_agrees_with_the_rows(client: TestClient):
    connect(client)
    body = client.get("/api/kite/portfolio").json()

    expected = sum(h["qty"] * h["ltp"] for h in body["holdings"])
    assert body["summary"]["count"] == len(body["holdings"])
    assert body["summary"]["current_value"] == pytest.approx(expected, abs=0.01)


def test_positions_and_margins_come_along(client: TestClient):
    connect(client)
    body = client.get("/api/kite/portfolio").json()

    assert body["positions"][0]["sym"] == "NIFTY26AUGFUT"
    assert body["margins"]["equity"]["live_balance"] == 41000.50


def test_a_failing_side_call_degrades_instead_of_failing_the_sync(app, client: TestClient):
    """A user without F&O access 403s on /portfolio/positions.

    Holdings are the load-bearing part of the response and must survive that.
    """
    class HalfBrokenKite(StubKiteClient):
        async def get(self, path: str, access_token: str):
            if path == "/portfolio/positions":
                raise KiteError("no f&o access", status=403)
            return await super().get(path, access_token)

    app.state.kite = HalfBrokenKite()
    connect(client)

    body = client.get("/api/kite/portfolio").json()
    assert body["unavailable"] == ["positions"]
    assert body["positions"] == []
    assert len(body["holdings"]) == 4  # holdings unaffected
    assert body["margins"]["equity"]["enabled"] is True
