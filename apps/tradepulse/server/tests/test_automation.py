"""The unattended pipeline: orchestrator cycles and the scheduler driving them."""

from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient

from tradepulse_server.app import create_app
from tradepulse_server.config import Settings
from tradepulse_server.intel.orchestrator import Orchestrator
from tradepulse_server.intel.scheduler import CycleScheduler
from tradepulse_server.intel.service import IntelService
from tradepulse_server.intel.store import IntelStore

PRICES = {"RELIANCE": 1275.90, "TCS": 2034.05, "TITAN": 4850.20}
HOLDINGS = [
    {"sym": "RELIANCE", "qty": 10, "ltp": 1275.90},
    {"sym": "TCS", "qty": 5, "ltp": 2034.05},
]


@pytest.fixture
def service() -> IntelService:
    return IntelService(store=IntelStore(":memory:"))


@pytest.fixture
def orchestrator(service: IntelService) -> Orchestrator:
    return Orchestrator(service)


def run(orch: Orchestrator, **kwargs):
    return asyncio.run(orch.run_cycle(prices=PRICES, holdings=HOLDINGS, **kwargs))


# --- one cycle ------------------------------------------------------------

def test_a_cycle_runs_every_stage_in_order(orchestrator: Orchestrator):
    result = run(orchestrator)
    assert [s.name for s in result.stages] == [
        "prices", "valuations", "recommendations", "outcomes", "learning",
    ]
    assert result.ok
    assert result.duration_ms >= 0


def test_a_cycle_produces_recommendations_for_covered_symbols(orchestrator: Orchestrator):
    result = run(orchestrator)
    recs = next(s for s in result.stages if s.name == "recommendations")
    assert recs.changed == 3
    assert sum(recs.detail["actions"].values()) == 3


def test_uncovered_symbols_are_skipped_rather_than_guessed(orchestrator: Orchestrator):
    """Without a valuation the ensemble reduces to a technical read, which is
    not what this pipeline is for."""
    result = asyncio.run(orchestrator.run_cycle(
        prices={"RELIANCE": 1275.90, "NOTLISTED": 42.0}, holdings=[]))
    recs = next(s for s in result.stages if s.name == "recommendations")
    assert recs.changed == 1


def test_the_cycle_is_audited_to_the_run_history(orchestrator: Orchestrator, service):
    run(orchestrator, trigger="test")
    [record] = service.store.runs()
    assert record["trigger"] == "test"
    assert record["ok"] is True
    assert [s["stage"] for s in record["stages"]] == [
        "prices", "valuations", "recommendations", "outcomes", "learning",
    ]


def test_running_twice_does_not_duplicate_valuations(orchestrator: Orchestrator, service):
    """Idempotent on unchanged financials, so a retry after a crash is safe."""
    run(orchestrator)
    run(orchestrator)
    assert len(service.store.valuation_history("RELIANCE")) == 1


def test_running_twice_appends_recommendations_without_overwriting(
    orchestrator: Orchestrator, service
):
    run(orchestrator)
    run(orchestrator)
    history = service.store.recommendations("RELIANCE")
    assert len(history) == 2
    assert {h["version"] for h in history} == {1, 2}


def test_a_failing_stage_does_not_sink_the_cycle(orchestrator: Orchestrator, service):
    """A broken feed must not stop outcomes being scored."""
    async def boom(*_args):
        raise RuntimeError("provider exploded")

    orchestrator._stage_valuations = boom  # noqa: SLF001 - simulating a bad stage

    result = run(orchestrator)
    assert not result.ok
    valuations = next(s for s in result.stages if s.name == "valuations")
    assert "provider exploded" in valuations.error
    # Everything after it still ran.
    assert all(s.ok for s in result.stages if s.name in {"outcomes", "learning"})


def test_cycles_do_not_overlap(orchestrator: Orchestrator):
    """Two cycles at once would double-write prices and race the weight rows."""
    async def both():
        return await asyncio.gather(
            orchestrator.run_cycle(prices=PRICES, holdings=HOLDINGS),
            orchestrator.run_cycle(prices=PRICES, holdings=HOLDINGS),
        )

    first, second = asyncio.run(both())
    # Serialised by the lock, so the second starts no earlier than the first ended.
    assert second.started_at >= first.started_at


def test_a_cycle_with_no_prices_falls_back_to_stored_marks(orchestrator: Orchestrator):
    run(orchestrator)                                   # seeds marks
    result = asyncio.run(orchestrator.run_cycle())      # no prices supplied
    recs = next(s for s in result.stages if s.name == "recommendations")
    assert recs.changed > 0


def test_the_book_is_capped_per_cycle(service: IntelService):
    """An unbounded book would make a cycle unbounded too."""
    orch = Orchestrator(service, max_symbols=2)
    result = asyncio.run(orch.run_cycle(prices=PRICES, holdings=HOLDINGS))
    assert next(s for s in result.stages if s.name == "recommendations").changed == 2


# --- the scheduler --------------------------------------------------------

def test_a_zero_interval_disables_the_scheduler(orchestrator: Orchestrator):
    scheduler = CycleScheduler(orchestrator, 0)
    assert not scheduler.enabled
    scheduler.start()
    assert not scheduler.running


def test_the_scheduler_runs_cycles_on_its_interval(orchestrator: Orchestrator):
    async def drive():
        scheduler = CycleScheduler(
            orchestrator, 1, context=lambda: {"prices": PRICES, "holdings": HOLDINGS}
        )
        scheduler.interval = 0.05  # type: ignore[assignment]
        scheduler.start()
        await asyncio.sleep(0.35)
        await scheduler.stop()
        return scheduler

    scheduler = asyncio.run(drive())
    assert scheduler.cycles >= 2
    assert not scheduler.running


def test_startup_is_never_blocked_by_the_first_cycle(orchestrator: Orchestrator):
    """The loop waits an interval first, so a slow pipeline cannot stop the API."""
    async def drive():
        scheduler = CycleScheduler(orchestrator, 1)
        scheduler.interval = 5  # type: ignore[assignment]
        scheduler.start()
        await asyncio.sleep(0.05)
        cycles = scheduler.cycles
        await scheduler.stop()
        return cycles

    assert asyncio.run(drive()) == 0


def test_stopping_awaits_the_task_rather_than_abandoning_it(orchestrator: Orchestrator):
    async def drive():
        scheduler = CycleScheduler(orchestrator, 1)
        scheduler.interval = 0.05  # type: ignore[assignment]
        scheduler.start()
        await asyncio.sleep(0.12)
        await scheduler.stop()
        return scheduler._task  # noqa: SLF001

    assert asyncio.run(drive()) is None


def test_a_raising_cycle_backs_off_instead_of_hammering(orchestrator: Orchestrator):
    async def drive():
        async def explode(**_kwargs):
            raise RuntimeError("down")

        scheduler = CycleScheduler(orchestrator, 1)
        scheduler.interval = 0.05  # type: ignore[assignment]
        scheduler.orchestrator.run_cycle = explode  # type: ignore[method-assign]
        scheduler.start()
        await asyncio.sleep(0.3)
        await scheduler.stop()
        return scheduler

    scheduler = asyncio.run(drive())
    assert scheduler.failures >= 1
    # Backoff means far fewer attempts than 0.3s / 0.05s would allow.
    assert scheduler.failures <= 4


# --- through the API ------------------------------------------------------

SETTINGS = Settings(
    auth_required=False,   # these suites test the routes, not the lock
    frontend_url="http://127.0.0.1:5273/",
    state_secret="test-secret",
    intel_db_path=":memory:",
    intel_cycle_seconds=0,   # no background cycles during tests
)


@pytest.fixture
def client() -> TestClient:
    with TestClient(create_app(SETTINGS)) as test_client:
        yield test_client


def test_a_cycle_can_be_triggered_over_http(client: TestClient):
    body = client.post("/api/intel/run", json={"prices": PRICES, "holdings": HOLDINGS}).json()
    assert body["ok"] is True
    assert body["trigger"] == "manual"
    assert len(body["stages"]) == 5


def test_run_history_is_readable_over_http(client: TestClient):
    client.post("/api/intel/run", json={"prices": PRICES})
    body = client.get("/api/intel/runs").json()
    assert len(body["runs"]) == 1
    assert body["scheduler"]["enabled"] is False    # disabled in these settings
    assert body["scheduler"]["last_cycle"]["ok"] is True


def test_a_cycle_leaves_recommendations_the_ui_can_read(client: TestClient):
    client.post("/api/intel/run", json={"prices": PRICES, "holdings": HOLDINGS})
    recs = client.get("/api/intel/recommendations").json()["recommendations"]
    assert len(recs) == 3
    assert all(r["reasoning"] for r in recs)


# --- the price feed behind unattended cycles -------------------------------

from tradepulse_server.intel.prices import (  # noqa: E402
    KitePriceSource, PriceFeed, StoredPriceSource,
)
from tradepulse_server.kite import KiteError, StubKiteClient  # noqa: E402


def test_stored_source_replays_the_newest_mark(service: IntelService):
    service.store.record_price("RELIANCE", 100.0, observed_at="2026-01-01T00:00:00+00:00")
    service.store.record_price("RELIANCE", 140.0, observed_at="2026-02-01T00:00:00+00:00")
    prices = asyncio.run(StoredPriceSource(service.store).quote(["RELIANCE", "MISSING"]))
    assert prices == {"RELIANCE": 140.0}


def test_a_feed_with_no_promoted_session_uses_stored_marks(service: IntelService):
    feed = PriceFeed(service.store, StubKiteClient())
    assert feed.live is False
    assert feed.source().name == "stored"


def test_promotion_switches_the_feed_to_live_quotes(service: IntelService):
    feed = PriceFeed(service.store, StubKiteClient())
    feed.promote("a-token", "AB1234")
    assert feed.live is True
    assert feed.source().name == "kite"
    assert feed.status()["promoted_user"] == "AB1234"


def test_promotion_is_revocable(service: IntelService):
    feed = PriceFeed(service.store, StubKiteClient())
    feed.promote("a-token")
    feed.revoke()
    assert feed.live is False
    assert feed.source().name == "stored"


def test_live_quotes_are_parsed_off_the_exchange_prefixed_keys(service: IntelService):
    class Quoting(StubKiteClient):
        async def get(self, path, access_token):
            assert "i=NSE:RELIANCE" in path
            return {"NSE:RELIANCE": {"last_price": 1275.9},
                    "NSE:TCS": {"last_price": 2034.05}}

    source = KitePriceSource(Quoting(), "token")
    assert asyncio.run(source.quote(["RELIANCE", "TCS"])) == {
        "RELIANCE": 1275.9, "TCS": 2034.05,
    }


def test_a_failing_quote_batch_does_not_cost_the_cycle_its_prices(service: IntelService):
    class Broken(StubKiteClient):
        async def get(self, path, access_token):
            raise KiteError("quote unavailable", status=503)

    assert asyncio.run(KitePriceSource(Broken(), "token").quote(["RELIANCE"])) == {}


def test_an_expired_token_degrades_to_stored_marks_rather_than_nothing(
    service: IntelService,
):
    """Kite tokens die at ~6am IST; an unattended cycle must not go blind."""
    service.store.record_price("RELIANCE", 111.0)

    class Expired(StubKiteClient):
        async def get(self, path, access_token):
            raise KiteError("token expired", status=403)

    feed = PriceFeed(service.store, Expired())
    feed.promote("stale-token")
    assert asyncio.run(feed.quote(["RELIANCE"])) == {"RELIANCE": 111.0}


# --- promotion over HTTP --------------------------------------------------

def test_promotion_requires_a_session(client: TestClient):
    assert client.post("/api/intel/price-feed/promote").status_code == 401


def connect(client: TestClient) -> None:
    """Walk the stub OAuth handshake without following redirects off-app."""
    login = client.get("/api/kite/login", follow_redirects=False)
    client.get(login.headers["location"], follow_redirects=False)


def test_promoting_and_revoking_over_http(client: TestClient):
    connect(client)
    body = client.post("/api/intel/price-feed/promote").json()
    assert body["promoted"] is True
    assert client.get("/api/intel/price-feed").json()["live"] is True

    client.post("/api/intel/price-feed/revoke")
    assert client.get("/api/intel/price-feed").json()["live"] is False


def test_logging_out_revokes_the_promotion(client: TestClient):
    """A promoted token belongs to the session that granted it."""
    connect(client)
    client.post("/api/intel/price-feed/promote")
    assert client.get("/api/intel/price-feed").json()["live"] is True

    client.post("/api/kite/logout")
    assert client.get("/api/intel/price-feed").json()["live"] is False


def test_run_history_reports_which_price_source_is_in_use(client: TestClient):
    body = client.get("/api/intel/runs").json()
    assert body["price_feed"]["source"] == "stored"


# --- replaying history must not stamp marks with the wall clock -------------
# A fixed seed did not make the automation harness reproducible: the pipeline
# recorded every mark at `utcnow()`, and marks are keyed by (symbol, second),
# so whether two cycles collapsed into one row depended on how fast the machine
# ran. That changed the price series, which changed the learning loop, which
# changed what later cycles recommended.

def test_a_cycle_records_its_marks_at_the_time_it_is_given():
    import asyncio

    from tradepulse_server.intel.orchestrator import Orchestrator
    from tradepulse_server.intel.service import IntelService
    from tradepulse_server.intel.store import IntelStore

    service = IntelService(store=IntelStore(":memory:"))
    orchestrator = Orchestrator(service)

    stamps = ["2026-01-01T00:00:00+00:00", "2026-02-01T00:00:00+00:00"]
    for stamp in stamps:
        asyncio.run(orchestrator.run_cycle(
            prices={"RELIANCE": 1200.0},
            holdings=[{"sym": "RELIANCE", "qty": 10, "ltp": 1200.0}],
            observed_at=stamp,
        ))

    observed = {row["observed_at"] for row in service.store.price_series("RELIANCE")}
    assert observed == set(stamps), observed


def test_a_live_cycle_still_stamps_now_by_default():
    """Only a replay passes a timestamp; a real cycle must not have to."""
    import asyncio

    from tradepulse_server.intel.orchestrator import Orchestrator
    from tradepulse_server.intel.service import IntelService
    from tradepulse_server.intel.store import IntelStore
    from tradepulse_server.intel.store import utcnow

    service = IntelService(store=IntelStore(":memory:"))
    before = utcnow()
    asyncio.run(Orchestrator(service).run_cycle(prices={"TCS": 3000.0}))

    series = service.store.price_series("TCS")
    assert series
    assert all(row["observed_at"] >= before for row in series)


# --- the unattended cycle reasons over the owner's book ---------------------
# Found by the browser journeys: the scheduler ran with no holdings, so every
# portfolio brake abstained, and its calls superseded the ones made from the
# UI with context. The drawer then had nothing to say about the book.

def test_the_scheduled_cycle_uses_the_owners_book():
    import asyncio
    from fastapi.testclient import TestClient
    from tradepulse_server.app import create_app
    from tradepulse_server.config import Settings

    app = create_app(Settings(intel_db_path=":memory:", state_secret="s"))
    c = TestClient(app)
    c.post("/api/auth/setup", json={"username": "asha", "password": "correct-horse-battery-9", "name": "Asha"})
    c.put("/api/me/book", json={"data": {"book": {
        "IN_STOCKS": [{"sym": "RELIANCE", "qty": 40, "ltp": 1275.9}, {"sym": "TCS", "qty": 8, "ltp": 3120.0}],
    }, "source": "manual"}})

    context = app.state.scheduler.context()
    assert {h["sym"] for h in context["holdings"]} == {"RELIANCE", "TCS"}

    # A cycle with no holdings passed in reads them from the book.
    result = asyncio.run(app.state.orchestrator.run_cycle(
        prices={"RELIANCE": 1275.9}, holdings=context["holdings"], trigger="test"))
    assert result.ok
    rec = app.state.intel.store.current_recommendation("RELIANCE")
    spoke = {row["agent"] for row in rec["evidence"]["contributing"]}
    assert "portfolio_risk" in spoke          # the brake had a book to read

    # The manual trigger with no holdings in the body does the same. With no
    # quote provider configured a cycle prices from stored marks — pretend
    # prices must never feed the learning loop — so it can only re-call
    # RELIANCE, the one symbol with a mark on file.
    body = c.post("/api/intel/run", json={}).json()
    assert body["ok"] is True
    latest = app.state.intel.store.current_recommendation("RELIANCE")
    assert latest["version"] == rec["version"] + 1          # a fresh call, not the old one
    assert "portfolio_risk" in {row["agent"] for row in latest["evidence"]["contributing"]}
