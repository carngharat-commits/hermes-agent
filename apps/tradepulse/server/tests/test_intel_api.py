"""The /api/intel/* surface the UI reads."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from tradepulse_server.app import create_app
from tradepulse_server.config import Settings

SETTINGS = Settings(
    frontend_url="http://127.0.0.1:5273/",
    state_secret="test-secret",
    # Each test app gets its own throwaway store; the production default is
    # a file, and sharing it across tests leaks state between them.
    intel_db_path=":memory:",
)


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app(SETTINGS), follow_redirects=False)


def test_coverage_reports_provider_symbols_and_agent_state(client: TestClient):
    body = client.get("/api/intel/coverage").json()
    assert body["provider"] == "stub"
    assert "RELIANCE" in body["symbols"]
    assert set(body["agents"]["active"]) == {
        "fundamental", "technical", "portfolio_risk",
        "cross_market", "diversification",
    }
    # The unwired agents are advertised with what they need, not hidden.
    pending = {a["agent"]: a["needs"] for a in body["agents"]["pending"]}
    assert set(pending) == {"news", "sentiment", "macro"}
    assert all(pending.values())


def test_valuation_returns_every_field_the_spec_asks_for(client: TestClient):
    body = client.get("/api/intel/valuation/RELIANCE?price=1275.90").json()
    valuation = body["valuation"]
    for field in ("intrinsic_value", "fair_value", "margin_of_safety",
                  "discount_premium", "dcf_value", "epv_value",
                  "financial_health", "business_quality"):
        assert valuation[field] is not None, field
    assert body["history"]


def test_uncovered_symbol_is_a_clean_404(client: TestClient):
    response = client.get("/api/intel/valuation/NOTLISTED?price=10")
    assert response.status_code == 404
    assert response.json()["error_type"] == "NotCovered"


def test_enrich_answers_a_whole_table_in_one_call(client: TestClient):
    body = client.post("/api/intel/enrich", json={"symbols": [
        {"sym": "RELIANCE", "ltp": 1275.90},
        {"sym": "TCS", "ltp": 2034.05},
        {"sym": "NOTLISTED", "ltp": 12.0},
    ]}).json()

    rows = {r["sym"]: r for r in body["rows"]}
    assert rows["RELIANCE"]["covered"] is True
    assert rows["RELIANCE"]["valuation"]["margin_of_safety"] is not None
    # Uncovered names come back flagged rather than missing, so the table can
    # say "no data" instead of silently dropping the row.
    assert rows["NOTLISTED"]["covered"] is False
    assert rows["NOTLISTED"]["valuation"] is None


def test_recommend_returns_an_explained_call(client: TestClient):
    body = client.post("/api/intel/recommend", json={
        "symbol": "RELIANCE", "price": 1275.90,
        "holdings": [{"sym": "RELIANCE", "qty": 10, "ltp": 1275.90}],
    }).json()

    assert body["action"] in {"BUY", "HOLD", "REDUCE", "SELL", "AVOID"}
    assert body["reasoning"].startswith(body["action"])
    assert "Reason:" in body["reasoning"]
    assert body["evidence"]["contributing"]
    assert body["id"]


def test_recommend_needs_a_symbol(client: TestClient):
    assert client.post("/api/intel/recommend", json={"price": 10}).status_code == 400


def test_recommendations_accumulate_and_never_overwrite(client: TestClient):
    client.post("/api/intel/recommend", json={"symbol": "TCS", "price": 2000})
    client.post("/api/intel/recommend", json={"symbol": "TCS", "price": 1200})

    body = client.get("/api/intel/recommendations?symbol=TCS").json()
    assert len(body["recommendations"]) == 2
    assert {r["version"] for r in body["recommendations"]} == {1, 2}


def test_performance_reports_totals_even_with_nothing_scored(client: TestClient):
    body = client.get("/api/intel/performance").json()
    assert body["totals"]["total_recommendations"] == 0
    assert body["totals"]["accuracy"] is None


def test_refresh_then_performance_scores_the_book(client: TestClient):
    client.post("/api/intel/recommend", json={"symbol": "RELIANCE", "price": 1000})
    client.post("/api/intel/recommend", json={"symbol": "TCS", "price": 2000})

    scored = client.post("/api/intel/refresh", json={
        "prices": {"RELIANCE": 1300, "TCS": 1700}
    }).json()
    assert scored["scored"] == 2

    body = client.get("/api/intel/performance").json()
    assert body["totals"]["total_recommendations"] == 2
    # Fresh calls stay OPEN — a week has not passed, so nothing is judged yet.
    assert body["totals"]["open"] == 2


def test_learn_runs_and_records_weights(client: TestClient):
    client.post("/api/intel/recommend", json={"symbol": "RELIANCE", "price": 1000})
    client.post("/api/intel/refresh", json={"prices": {"RELIANCE": 1300}})

    body = client.post("/api/intel/learn").json()
    assert "weights" in body
    assert all("rationale" in w for w in body["weights"])
    assert "signals" in body


def test_intel_routes_do_not_disturb_the_kite_ones(client: TestClient):
    """The spec's first requirement: nothing existing changes behaviour."""
    assert client.get("/api/kite/status").json()["mode"] == "stub"
    assert client.get("/api/kite/session").json()["authenticated"] is False
    assert client.get("/healthz").json()["ok"] is True


def test_enrich_reports_no_margin_for_an_unpriced_row(client: TestClient):
    """A watchlist row with no market price must not be given a discount.

    The UI filters these out before asking, but the endpoint is the contract:
    a caller that does ask gets an explicit null rather than a margin computed
    against whatever price the symbol was last valued at.
    """
    client.post("/api/intel/enrich", json={"symbols": [{"sym": "TITAN", "ltp": 3400.0}]})
    body = client.post("/api/intel/enrich",
                       json={"symbols": [{"sym": "TITAN", "ltp": 0}]}).json()

    row = body["rows"][0]
    assert row["covered"] is True
    assert row["valuation"]["intrinsic_value"] is not None   # the value stands
    assert row["valuation"]["margin_of_safety"] is None      # the comparison does not
    assert row["valuation"]["discount_premium"] is None
