"""Runs the orchestrator on an interval, unattended.

Deliberately a plain asyncio task rather than APScheduler or Celery: there is
one job, it is idempotent, and it does not need to survive a restart mid-run.
Adding a broker here would be infrastructure without a problem to solve. When
this needs to run across several workers, the job moves out — not this file's
complexity up.

Two properties matter more than the interval:

* **Startup is never blocked.** The first cycle waits one interval, so a slow
  or failing pipeline cannot stop the API from serving.
* **Shutdown is clean.** The task is cancelled and awaited, so a cycle in
  flight finishes or unwinds rather than being abandoned mid-write.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Callable

from .orchestrator import Orchestrator

logger = logging.getLogger("tradepulse.scheduler")

# A failing cycle backs off rather than hammering a broken dependency every
# interval. Capped so recovery is not delayed indefinitely.
BACKOFF_MULTIPLIER = 2.0
MAX_BACKOFF_INTERVALS = 8


class CycleScheduler:
    """Drives `Orchestrator.run_cycle` forever, until stopped."""

    def __init__(
        self,
        orchestrator: Orchestrator,
        interval_seconds: int,
        *,
        context: Callable[[], dict[str, Any]] | None = None,
    ):
        self.orchestrator = orchestrator
        self.interval = interval_seconds
        # What the cycle should reason over. A callable so the scheduler reads
        # current prices and holdings at fire time rather than capturing a
        # snapshot from whenever the app started.
        self.context = context or (lambda: {"prices": {}, "holdings": []})
        self._task: asyncio.Task | None = None
        self._stopping = asyncio.Event()
        self.cycles = 0
        self.failures = 0
        self.consecutive_failures = 0

    @property
    def enabled(self) -> bool:
        return self.interval > 0

    @property
    def running(self) -> bool:
        return self._task is not None and not self._task.done()

    def start(self) -> None:
        if not self.enabled:
            logger.info("cycle scheduler disabled (interval is 0)")
            return
        if self.running:
            return
        self._stopping.clear()
        self._task = asyncio.create_task(self._loop(), name="tradepulse-cycle")
        logger.info("cycle scheduler started, every %ss", self.interval)

    async def stop(self) -> None:
        self._stopping.set()
        task = self._task
        self._task = None
        if task is None:
            return
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        logger.info("cycle scheduler stopped after %s cycle(s)", self.cycles)

    async def _loop(self) -> None:
        delay = float(self.interval)
        while not self._stopping.is_set():
            # Wait first: the app must be able to serve before any cycle runs.
            try:
                await asyncio.wait_for(self._stopping.wait(), timeout=delay)
                return  # stop() was called during the wait
            except asyncio.TimeoutError:
                pass

            try:
                payload = self.context()
                refresh = payload.get("refresh")
                if refresh is not None:
                    # Quote fresh prices before the cycle rather than reusing
                    # whatever the last one left behind.
                    payload = {**payload, "prices": await refresh()}
                result = await self.orchestrator.run_cycle(
                    prices=payload.get("prices"),
                    holdings=payload.get("holdings"),
                    trigger="scheduler",
                )
                self.cycles += 1
                if result.ok:
                    self.consecutive_failures = 0
                    delay = float(self.interval)
                else:
                    failed = [s.name for s in result.stages if not s.ok]
                    logger.warning("cycle finished with failed stages: %s", failed)
                    delay = self._backoff()
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001 - the loop must outlive one bad cycle
                self.failures += 1
                logger.exception("cycle raised")
                delay = self._backoff()

    def _backoff(self) -> float:
        self.consecutive_failures += 1
        steps = min(self.consecutive_failures, MAX_BACKOFF_INTERVALS)
        return float(self.interval) * (BACKOFF_MULTIPLIER ** (steps - 1))

    def status(self) -> dict[str, Any]:
        last = self.orchestrator.last_result
        return {
            "enabled": self.enabled,
            "running": self.running,
            "interval_seconds": self.interval,
            "cycles": self.cycles,
            "failures": self.failures,
            "consecutive_failures": self.consecutive_failures,
            "last_cycle": last.as_dict() if last else None,
        }
