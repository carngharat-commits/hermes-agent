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
