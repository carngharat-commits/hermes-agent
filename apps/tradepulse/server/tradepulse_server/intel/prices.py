"""Where an unattended cycle gets its prices.

The awkward fact this exists to solve: a Kite session belongs to a browser. It
arrives as an HttpOnly cookie on a request, and a background job has no
request. So the scheduler had nothing to quote from and fell back to re-scoring
against marks it had already stored — which makes the pipeline look like it is
running while it learns nothing new.

Two sources, one interface:

* `StoredPriceSource` — last recorded mark per symbol. Honest about being
  stale; it is what a cycle uses when no broker is connected.
* `KitePriceSource` — real quotes, but only once a session has been explicitly
  **promoted** for background use (see `promote`). Promotion is deliberate and
  revocable rather than implicit: a background job quietly borrowing whichever
  browser session happened to log in last is a surprise nobody wants, and the
  token it borrows is a bearer credential for the whole trading account.
"""

from __future__ import annotations

import logging
from typing import Any, Protocol

from ..kite import KiteClient, KiteError

logger = logging.getLogger("tradepulse.prices")

# Kite quotes up to 500 instruments per call; stay well inside it.
QUOTE_BATCH = 100


class PriceSource(Protocol):
    name: str

    async def quote(self, symbols: list[str]) -> dict[str, float]:
        """Latest price per symbol. Missing symbols are simply absent."""
        ...


class StoredPriceSource:
    """Replays the newest mark this app has already seen.

    Deliberately not an error case. With no broker connected there is no
    fresher truth available, and a cycle that still runs keeps outcomes and
    the learning loop moving over the history that does exist.
    """

    name = "stored"
    fresh = False

    def __init__(self, store):
        self.store = store

    async def quote(self, symbols: list[str]) -> dict[str, float]:
        out: dict[str, float] = {}
        for symbol in symbols:
            series = self.store.price_series(symbol)
            if series:
                out[symbol] = float(series[-1]["price"])
        return out


class KitePriceSource:
    """Live quotes for a session promoted to drive background cycles."""

    name = "kite"
    fresh = True

    def __init__(self, client: KiteClient, access_token: str, *, exchange: str = "NSE"):
        self.client = client
        self.access_token = access_token
        self.exchange = exchange

    async def quote(self, symbols: list[str]) -> dict[str, float]:
        out: dict[str, float] = {}
        for start in range(0, len(symbols), QUOTE_BATCH):
            batch = symbols[start : start + QUOTE_BATCH]
            keys = [f"{self.exchange}:{s}" for s in batch]
            query = "&".join(f"i={k}" for k in keys)
            try:
                data = await self.client.get(f"/quote/ltp?{query}", self.access_token)
            except KiteError as exc:
                # One bad batch must not cost the whole cycle its prices.
                logger.warning("quote batch failed: %s", exc.message)
                continue
            for key, payload in (data or {}).items():
                symbol = key.split(":", 1)[-1]
                price = (payload or {}).get("last_price")
                if price:
                    out[symbol] = float(price)
        return out


class PriceFeed:
    """Picks the best available source at fire time.

    Holds the promoted session rather than a live quote client, so the
    scheduler reads whatever is current on each cycle instead of capturing a
    token that will expire at ~6am IST.
    """

    def __init__(self, store, client: KiteClient):
        self.store = store
        self.client = client
        self._promoted_token: str | None = None
        self._promoted_user: str = ""

    def promote(self, access_token: str, user_id: str = "") -> None:
        """Let background cycles quote with this session's token."""
        self._promoted_token = access_token
        self._promoted_user = user_id
        logger.info("price feed promoted to live quotes for %s", user_id or "session")

    def revoke(self) -> None:
        self._promoted_token = None
        self._promoted_user = ""

    @property
    def live(self) -> bool:
        return self._promoted_token is not None

    def source(self) -> PriceSource:
        if self._promoted_token:
            return KitePriceSource(self.client, self._promoted_token)
        return StoredPriceSource(self.store)

    async def quote(self, symbols: list[str]) -> dict[str, float]:
        source = self.source()
        prices = await source.quote(symbols)
        if not prices and source.name == "kite":
            # A promoted token that stops answering (expired overnight, most
            # likely) should degrade to stored marks, not to nothing.
            logger.warning("live quotes returned nothing; falling back to stored marks")
            return await StoredPriceSource(self.store).quote(symbols)
        return prices

    def status(self) -> dict[str, Any]:
        return {
            "source": self.source().name,
            "live": self.live,
            "promoted_user": self._promoted_user,
        }
