"""Quotes with or without a broker, and the rule that a stub never overwrites."""

from __future__ import annotations

import asyncio
import json

import httpx
import pytest
from fastapi.testclient import TestClient

from tradepulse_server.app import create_app
from tradepulse_server.config import Settings
from tradepulse_server.intel.store import IntelStore
from tradepulse_server.kite import StubKiteClient
from tradepulse_server.intel.prices import PriceFeed
from tradepulse_server.quotes import (
    HttpJsonQuoteProvider, QuotePriceSource, QuoteService, StubQuoteProvider,
)


def run(coro):
    return asyncio.run(coro)


# --- stub -------------------------------------------------------------------

def test_stub_quotes_are_deterministic_within_a_minute_and_differ_by_symbol():
    stub = StubQuoteProvider()
    a = run(stub.quote(["TCS", "INFY"]))
    b = run(stub.quote(["TCS", "INFY"]))
    assert a["TCS"].price == b["TCS"].price
    assert a["TCS"].price != a["INFY"].price
    assert all(q.source == "stub" for q in a.values())


def test_stub_starts_from_the_last_stored_mark_when_there_is_one():
    store = IntelStore(":memory:")
    store.record_price("TCS", 3000.0)
    q = run(StubQuoteProvider(store).quote(["TCS"]))["TCS"]
    assert abs(q.price - 3000.0) / 3000.0 <= 0.016      # within the ±1.5% wobble


# --- http -------------------------------------------------------------------

def fake_vendor(payload_for):
    def handler(request: httpx.Request) -> httpx.Response:
        symbol = request.url.path.rsplit("/", 1)[-1]
        body = payload_for(symbol)
        if body is None:
            return httpx.Response(404, json={"error": "unknown"})
        return httpx.Response(200, json=body)
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def test_http_provider_follows_dotted_paths_with_symbol_substitution():
    client = fake_vendor(lambda s: {"data": {s: {"last": 123.456, "chg": -0.8}}})
    provider = HttpJsonQuoteProvider(
        "https://vendor.example/q/{symbol}", "data.{symbol}.last", "data.{symbol}.chg",
        headers={"X-Api-Key": "k"}, client=client,
    )
    quotes = run(provider.quote(["TCS"]))
    assert quotes["TCS"].price == 123.46
    assert quotes["TCS"].day_pct == -0.8
    assert quotes["TCS"].source == "http" and provider.live


def test_http_provider_loses_one_row_not_the_screen():
    client = fake_vendor(lambda s: None if s == "BAD" else {"price": 10})
    provider = HttpJsonQuoteProvider("https://v.example/{symbol}", "price", client=client)
    quotes = run(provider.quote(["GOOD", "BAD"]))
    assert set(quotes) == {"GOOD"}


# --- service ----------------------------------------------------------------

def feed(**kw) -> PriceFeed:
    return PriceFeed(IntelStore(":memory:"), StubKiteClient(), **kw)


def test_service_uses_stub_when_nothing_is_configured():
    service = QuoteService(feed(), http=None)
    body = run(service.quotes(["tcs", " infy "]))
    assert body["source"] == "stub" and body["live"] is False
    assert set(body["quotes"]) == {"TCS", "INFY"}      # normalised


def test_service_prefers_the_http_provider_over_the_stub():
    http = HttpJsonQuoteProvider("https://v.example/{symbol}", "price",
                                 client=fake_vendor(lambda s: {"price": 42}))
    body = run(QuoteService(feed(), http=http).quotes(["TCS"]))
    assert body["source"] == "http" and body["live"] is True
    assert body["quotes"]["TCS"]["price"] == 42


def test_service_prefers_a_promoted_kite_session_over_http():
    http = HttpJsonQuoteProvider("https://v.example/{symbol}", "price",
                                 client=fake_vendor(lambda s: {"price": 42}))
    f = feed()
    f.promote("token", "AB1234")
    assert QuoteService(f, http=http).status()["source"] == "kite"


def test_service_caches_for_the_ttl():
    calls = []
    def payload(s):
        calls.append(s); return {"price": 1}
    http = HttpJsonQuoteProvider("https://v.example/{symbol}", "price",
                                 client=fake_vendor(payload))
    service = QuoteService(feed(), http=http, ttl=60)
    run(service.quotes(["TCS"])); run(service.quotes(["TCS"]))
    assert calls == ["TCS"]


def test_a_live_provider_that_answers_nothing_falls_back_to_stub_for_the_call():
    http = HttpJsonQuoteProvider("https://v.example/{symbol}", "price",
                                 client=fake_vendor(lambda s: None))
    body = run(QuoteService(feed(), http=http).quotes(["TCS"]))
    assert body["quotes"]["TCS"]["source"] == "stub"
    assert body["live"] is False                        # never claim live for a stub


# --- the scheduler gets the same source ------------------------------------

def test_price_feed_uses_the_http_provider_before_stale_marks():
    http = HttpJsonQuoteProvider("https://v.example/{symbol}", "price",
                                 client=fake_vendor(lambda s: {"price": 777}))
    store = IntelStore(":memory:")
    store.record_price("TCS", 1.0)
    f = PriceFeed(store, StubKiteClient(), fallback=QuotePriceSource(http))
    assert f.source().name == "http"
    assert run(f.quote(["TCS"])) == {"TCS": 777.0}
    f.promote("t", "u")
    assert f.source().name == "kite"                    # a broker still wins


# --- route ------------------------------------------------------------------

def test_quotes_route_is_behind_the_login():
    c = TestClient(create_app(Settings(intel_db_path=":memory:", state_secret="s", passcode="p")))
    assert c.get("/api/quotes?symbols=TCS").status_code == 401


def test_quotes_route_returns_labelled_quotes():
    c = TestClient(create_app(Settings(auth_required=False, intel_db_path=":memory:", state_secret="s")))
    body = c.get("/api/quotes?symbols=TCS,INFY").json()
    assert body["source"] == "stub" and body["live"] is False
    assert {"TCS", "INFY"} <= set(body["quotes"])
    assert c.get("/api/quotes/status").json()["http_configured"] is False
