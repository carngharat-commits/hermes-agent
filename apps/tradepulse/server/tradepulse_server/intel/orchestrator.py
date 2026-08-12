"""One cycle of the intelligence pipeline, start to finish.

Until now every stage had to be poked by hand: value a symbol, ask for a
recommendation, refresh outcomes, run the learning loop. That is fine for a
demo and useless as a product — the learning loop only means something if it
runs unattended, repeatedly, over months.

A cycle is five stages:

    prices → valuations → recommendations → outcomes → learning

Ordering is not arbitrary. Prices come first because valuations and the
technical agent read them; recommendations need current valuations; outcomes
score recommendations against the prices just recorded; learning reads the
outcomes. Running them out of order silently scores calls against stale marks.

Every stage is:

* **idempotent** — a cycle that runs twice changes nothing the second time
  beyond a new price mark, so a retry after a crash is safe;
* **isolated** — a stage that raises is recorded as failed and the cycle
  carries on, because a broken news feed should not stop outcomes being
  scored;
* **audited** — what ran, how long it took, and what it changed goes to the
  run history, so an unattended pipeline can be inspected after the fact.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

from .service import IntelService
from .store import utcnow

# Recommend at most this many symbols per cycle. The ensemble is concurrent
# per symbol but symbols are walked in order, so an unbounded book would make
# a cycle unbounded too.
MAX_SYMBOLS_PER_CYCLE = 25

# Concurrent symbols in flight. Above this the fan-out stops helping and
# starts competing for the same provider.
SYMBOL_CONCURRENCY = 4


@dataclass
class StageResult:
    name: str
    ok: bool
    duration_ms: int
    changed: int = 0
    detail: dict[str, Any] = field(default_factory=dict)
    error: str = ""

    def as_dict(self) -> dict[str, Any]:
        return {
            "stage": self.name,
            "ok": self.ok,
            "duration_ms": self.duration_ms,
            "changed": self.changed,
            "detail": self.detail,
            "error": self.error,
        }


@dataclass
class CycleResult:
    started_at: str
    finished_at: str
    duration_ms: int
    stages: list[StageResult]
    trigger: str

    @property
    def ok(self) -> bool:
        return all(s.ok for s in self.stages)

    def as_dict(self) -> dict[str, Any]:
        return {
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "duration_ms": self.duration_ms,
            "trigger": self.trigger,
            "ok": self.ok,
            "stages": [s.as_dict() for s in self.stages],
        }


class Orchestrator:
    """Runs the pipeline. Holds no state beyond the service it drives."""

    def __init__(self, service: IntelService, *, max_symbols: int = MAX_SYMBOLS_PER_CYCLE):
        self.service = service
        self.max_symbols = max_symbols
        # Two cycles overlapping would double-write prices and race the
        # learning loop's weight rows against each other.
        self._lock = asyncio.Lock()
        self.last_result: CycleResult | None = None

    async def run_cycle(
        self,
        *,
        prices: dict[str, float] | None = None,
        holdings: list[dict[str, Any]] | None = None,
        trigger: str = "manual",
    ) -> CycleResult:
        """One full pass. Safe to call repeatedly; safe to call concurrently."""
        async with self._lock:
            return await self._run(prices or {}, holdings or [], trigger)

    async def _run(
        self, prices: dict[str, float], holdings: list[dict[str, Any]], trigger: str
    ) -> CycleResult:
        started = time.monotonic()
        started_at = utcnow()
        stages: list[StageResult] = []

        symbols = self._symbols(prices, holdings)

        stages.append(await self._stage("prices", self._stage_prices, prices))
        stages.append(await self._stage("valuations", self._stage_valuations, symbols, prices))
        stages.append(
            await self._stage("recommendations", self._stage_recommendations, symbols,
                              prices, holdings)
        )
        stages.append(await self._stage("outcomes", self._stage_outcomes, prices))
        stages.append(await self._stage("learning", self._stage_learning))

        duration = int((time.monotonic() - started) * 1000)
        result = CycleResult(
            started_at=started_at,
            finished_at=utcnow(),
            duration_ms=duration,
            stages=stages,
            trigger=trigger,
        )
        self.last_result = result
        self.service.store.record_run(result.as_dict())
        return result

    def _symbols(self, prices: dict[str, float], holdings: list[dict[str, Any]]) -> list[str]:
        """Which names this cycle covers.

        Only symbols the provider can value are worth running the ensemble on:
        without a valuation the fundamental agent abstains and the call reduces
        to a technical read, which is not what this pipeline is for.
        """
        covered = set(self.service.covered_symbols())
        wanted = {s.upper() for s in prices} | {
            str(h.get("sym", "")).upper() for h in holdings
        }
        chosen = sorted(covered & wanted) if wanted else sorted(covered)
        return chosen[: self.max_symbols]

    async def _stage(
        self, name: str, fn: Callable[..., Awaitable[tuple[int, dict[str, Any]]]], *args
    ) -> StageResult:
        started = time.monotonic()
        try:
            changed, detail = await fn(*args)
            return StageResult(name, True, int((time.monotonic() - started) * 1000),
                               changed, detail)
        except Exception as exc:  # noqa: BLE001 - one stage must not sink the cycle
            return StageResult(name, False, int((time.monotonic() - started) * 1000),
                               0, {}, f"{type(exc).__name__}: {exc}")

    # -- stages -------------------------------------------------------------

    async def _stage_prices(self, prices: dict[str, float]) -> tuple[int, dict[str, Any]]:
        """Record the marks this cycle will reason from."""
        if not prices:
            return 0, {"note": "no prices supplied; later stages use stored marks"}
        written = self.service.store.record_prices(
            ((sym.upper(), float(price)) for sym, price in prices.items()),
            source="cycle",
        )
        return written, {"symbols": sorted(s.upper() for s in prices)}

    async def _stage_valuations(
        self, symbols: list[str], prices: dict[str, float]
    ) -> tuple[int, dict[str, Any]]:
        """Refresh valuations. Unchanged financials reuse the stored row."""
        fresh = 0
        for symbol in symbols:
            price = float(prices.get(symbol, 0) or 0)
            before = self.service.store.latest_valuation(symbol)
            result = self.service.valuation_for(symbol, price)
            if result and (before is None or before["fingerprint"] != result["fingerprint"]):
                fresh += 1
        return fresh, {"evaluated": len(symbols), "new_statements": fresh}

    async def _stage_recommendations(
        self, symbols: list[str], prices: dict[str, float],
        holdings: list[dict[str, Any]],
    ) -> tuple[int, dict[str, Any]]:
        """Run the ensemble across the book, a few symbols at a time."""
        gate = asyncio.Semaphore(SYMBOL_CONCURRENCY)
        actions: dict[str, int] = {}

        async def one(symbol: str) -> dict[str, Any] | None:
            async with gate:
                price = float(prices.get(symbol, 0) or 0)
                if price <= 0:
                    series = self.service.store.price_series(symbol)
                    if not series:
                        return None
                    price = float(series[-1]["price"])
                return await self.service.recommend(symbol, price, holdings=holdings)

        results = await asyncio.gather(*(one(s) for s in symbols), return_exceptions=True)
        made = 0
        failures = []
        for symbol, outcome in zip(symbols, results):
            if isinstance(outcome, BaseException):
                failures.append({"symbol": symbol, "error": str(outcome)})
            elif outcome is not None:
                made += 1
                actions[outcome["action"]] = actions.get(outcome["action"], 0) + 1
        return made, {"actions": actions, "skipped": len(symbols) - made,
                      "failures": failures}

    async def _stage_outcomes(self, prices: dict[str, float]) -> tuple[int, dict[str, Any]]:
        """Score every recommendation against the marks recorded this cycle."""
        marks = {s.upper(): float(p) for s, p in prices.items()}
        if not marks:
            # Fall back to the newest stored mark per symbol so a cycle without
            # supplied prices still scores rather than skipping silently.
            for rec in self.service.store.recommendations(limit=1000):
                series = self.service.store.price_series(rec["symbol"])
                if series:
                    marks[rec["symbol"]] = float(series[-1]["price"])
        scored = self.service.refresh_outcomes(marks) if marks else 0
        totals = self.service.performance()["totals"]
        return scored, {"judged": totals["judged"], "open": totals["open"],
                        "accuracy": totals["accuracy"]}

    async def _stage_learning(self) -> tuple[int, dict[str, Any]]:
        """Review completed calls and move the weights."""
        lesson = self.service.learn()
        moved = [
            w for w in lesson["weights"]
            if w["sample_size"] >= 1 and "Held at the default" not in w["rationale"]
        ]
        return len(moved), {
            "reviewed": len(lesson["reviews"]),
            "weights": {w["agent"]: w["weight"] for w in lesson["weights"]},
            "moved": [w["agent"] for w in moved],
        }
