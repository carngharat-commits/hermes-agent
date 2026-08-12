"""/api/kite/orders — the order book and GTT triggers the Orders tab reads."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from tradepulse_server.app import create_app
from tradepulse_server.config import Settings
from tradepulse_server.kite import KiteError, StubKiteClient

SETTINGS = Settings(
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


def test_orders_need_a_session(client: TestClient):
    assert client.get("/api/kite/orders").status_code == 401


def test_order_book_comes_back_in_the_ui_row_shape(client: TestClient):
    connect(client)
    body = client.get("/api/kite/orders").json()

    assert body["mode"] == "stub"
    assert body["unavailable"] == []

    reliance = next(o for o in body["orders"] if o["sym"] == "RELIANCE")
    assert reliance["status"] == "EXECUTED"
    assert reliance["side"] == "BUY"
    assert reliance["price"] == 1198.75
    assert reliance["broker"] == "Zerodha"

    rejected = next(o for o in body["orders"] if o["status"] == "REJECTED")
    assert rejected["reason"] == "Insufficient margin"

    assert any(o["status"] == "PENDING" for o in body["orders"])


def test_two_leg_gtt_arrives_as_two_rows(client: TestClient):
    connect(client)
    gtts = client.get("/api/kite/orders").json()["gtts"]

    steel = [g for g in gtts if g["sym"] == "TATASTEEL"]
    assert [g["trigger"] for g in steel] == [160.0, 230.0]
    assert len({g["id"] for g in gtts}) == len(gtts)  # keys are unique


def test_gtt_failure_leaves_the_order_book_standing(app, client: TestClient):
    """A Kite app without the GTT scope 403s on /gtt/triggers."""

    class NoGttKite(StubKiteClient):
        async def get(self, path: str, access_token: str):
            if path == "/gtt/triggers":
                raise KiteError("gtt not enabled", status=403)
            return await super().get(path, access_token)

    app.state.kite = NoGttKite()
    connect(client)

    body = client.get("/api/kite/orders").json()
    assert body["unavailable"] == ["gtt"]
    assert body["gtts"] == []
    assert len(body["orders"]) == 3


def test_repeat_reads_are_served_from_cache(app, client: TestClient):
    """Kite publishes per-endpoint rate limits; page loads must not fan out."""
    calls: list[str] = []

    class CountingKite(StubKiteClient):
        async def get(self, path: str, access_token: str):
            calls.append(path)
            return await super().get(path, access_token)

    app.state.kite = CountingKite()
    connect(client)

    client.get("/api/kite/orders")
    client.get("/api/kite/orders")
    client.get("/api/kite/portfolio")
    client.get("/api/kite/portfolio")

    # Five distinct Kite endpoints across those four requests, each hit once.
    assert sorted(calls) == sorted([
        "/orders", "/gtt/triggers",
        "/portfolio/holdings", "/portfolio/positions", "/user/margins",
    ])


def test_logout_drops_the_cached_reads(app, client: TestClient):
    calls: list[str] = []

    class CountingKite(StubKiteClient):
        async def get(self, path: str, access_token: str):
            calls.append(path)
            return await super().get(path, access_token)

    app.state.kite = CountingKite()
    connect(client)
    client.get("/api/kite/orders")
    client.post("/api/kite/logout")

    connect(client)
    client.get("/api/kite/orders")

    assert calls.count("/orders") == 2  # not served from the previous session


def test_healthz_reports_cache_activity(client: TestClient):
    connect(client)
    client.get("/api/kite/orders")
    client.get("/api/kite/orders")

    cache = client.get("/healthz").json()["cache"]
    assert cache["hits"] >= 2
    assert cache["entries"] >= 2
