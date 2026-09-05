"""Prices for a symbol, with or without a broker.

The app's one live price source was a Kite session, which belongs to a
browser and to a Zerodha account. A user who only wants to *watch* scripts
had no way to see a price move. This module gives every screen a quote to
read, and says where it came from.

Three providers, one interface, picked in this order:

1. **Kite** — when a session has been promoted for background use. Real
   quotes from the broker.
2. **HTTP** — any JSON quote endpoint the operator configures with a URL
   template and a path to the price. No broker needed; any vendor works.
3. **Stub** — deterministic pretend prices, labelled as such all the way to
   the pill on screen. They exist so the app is exercisable with nothing
   configured, and the UI treats them by one rule: a stub quote may fill a
   price nobody supplied; it may never overwrite one somebody did.
"""

from __future__ import annotations

import hashlib
import logging
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Protocol

import httpx

from .kite import KiteError

logger = logging.getLogger("tradepulse.quotes")

QUOTE_TTL_SECONDS = 15.0
STUB_BUCKET_SECONDS = 60          # a stub price holds still for a minute


@dataclass(frozen=True)
class Quote:
    symbol: str
    price: float
    day_pct: float | None
    as_of: str
    source: str

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


class QuoteProvider(Protocol):
    name: str
    live: bool

    async def quote(self, symbols: list[str]) -> dict[str, Quote]: ...


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ------------------------------------------------------------------ stub

class StubQuoteProvider:
    """Pretend prices that stand still for a minute and never lie about it."""

    name = "stub"
    live = False

    def __init__(self, store=None):
        self.store = store

    def _base(self, symbol: str) -> float:
        if self.store is not None:
            series = self.store.price_series(symbol)
            if series:
                return float(series[-1]["price"])
        digest = int(hashlib.sha256(symbol.encode()).hexdigest()[:8], 16)
        return 50.0 + (digest % 40000) / 10.0        # ₹50 – ₹4050

    async def quote(self, symbols: list[str]) -> dict[str, Quote]:
        bucket = int(time.time() // STUB_BUCKET_SECONDS)
        out: dict[str, Quote] = {}
        for symbol in symbols:
            seed = int(hashlib.sha256(f"{symbol}:{bucket}".encode()).hexdigest()[:8], 16)
            wobble = ((seed % 3000) / 1000.0 - 1.5) / 100.0     # ±1.5%
            day = ((seed // 3000 % 6000) / 1000.0 - 3.0)         # ±3.0 pct points
            price = round(self._base(symbol) * (1 + wobble), 2)
            out[symbol] = Quote(symbol, price, round(day, 2), _now(), self.name)
        return out


# ------------------------------------------------------------------ http

def _walk(payload: Any, path: str, symbol: str) -> Any:
    """Follow a dotted path; `{symbol}` in a segment is substituted."""
    node = payload
    for raw in [p for p in path.split(".") if p]:
        key = raw.replace("{symbol}", symbol)
        if isinstance(node, list):
            node = node[int(key)]
        elif isinstance(node, dict):
            node = node[key]
        else:
            raise KeyError(key)
    return node


class HttpJsonQuoteProvider:
    """Any vendor that answers JSON for a symbol.

    `url` is a template with `{symbol}`; `price_path` and `change_path` are
    dotted paths into the response (`data.{symbol}.last`, `quotes.0.price`).
    Failures are per symbol: one bad answer costs that row, not the screen.
    """

    name = "http"
    live = True

    def __init__(self, url: str, price_path: str, change_path: str = "",
                 headers: dict[str, str] | None = None,
                 client: httpx.AsyncClient | None = None, timeout: float = 6.0):
        self.url = url
        self.price_path = price_path
        self.change_path = change_path
        self.headers = headers or {}
        self._client = client
        self.timeout = timeout

    async def quote(self, symbols: list[str]) -> dict[str, Quote]:
        out: dict[str, Quote] = {}
        client = self._client or httpx.AsyncClient(timeout=self.timeout)
        try:
            for symbol in symbols:
                try:
                    resp = await client.get(self.url.format(symbol=symbol), headers=self.headers)
                    resp.raise_for_status()
                    payload = resp.json()
                    price = float(_walk(payload, self.price_path, symbol))
                    change = None
                    if self.change_path:
                        try:
                            change = float(_walk(payload, self.change_path, symbol))
                        except (KeyError, IndexError, TypeError, ValueError):
                            change = None
                except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
                    logger.warning("quote for %s failed: %s", symbol, exc)
                    continue
                out[symbol] = Quote(symbol, round(price, 2), change, _now(), self.name)
        finally:
            if self._client is None:
                await client.aclose()
        return out


# ------------------------------------------------------------------ kite

class KiteQuoteProvider:
    """Broker quotes, once a session has been promoted for background use."""

    name = "kite"
    live = True

    def __init__(self, price_source):
        self.price_source = price_source     # prices.KitePriceSource

    async def quote(self, symbols: list[str]) -> dict[str, Quote]:
        try:
            prices = await self.price_source.quote(symbols)
        except KiteError as exc:
            logger.warning("kite quotes failed: %s", exc.message)
            return {}
        stamp = _now()
        return {s: Quote(s, float(p), None, stamp, self.name) for s, p in prices.items()}


class QuotePriceSource:
    """Adapts a QuoteProvider to the scheduler's plain price interface."""

    fresh = True

    def __init__(self, provider: QuoteProvider):
        self.provider = provider
        self.name = provider.name

    async def quote(self, symbols: list[str]) -> dict[str, float]:
        quotes = await self.provider.quote(symbols)
        return {s: q.price for s, q in quotes.items()}


# --------------------------------------------------------------- service

class QuoteService:
    """Picks the best provider at call time and caches briefly."""

    def __init__(self, price_feed, http: HttpJsonQuoteProvider | None, store=None,
                 ttl: float = QUOTE_TTL_SECONDS):
        self.price_feed = price_feed
        self.http = http
        self.stub = StubQuoteProvider(store)
        self.ttl = ttl
        self._cache: dict[tuple[str, str], tuple[float, Quote]] = {}

    def provider(self) -> QuoteProvider:
        if self.price_feed is not None and self.price_feed.live:
            return KiteQuoteProvider(self.price_feed.source())
        if self.http is not None:
            return self.http
        return self.stub

    async def quotes(self, symbols: list[str]) -> dict[str, Any]:
        provider = self.provider()
        wanted = sorted({s.strip().upper() for s in symbols if s and s.strip()})
        now = time.monotonic()
        fresh: dict[str, Quote] = {}
        missing: list[str] = []
        for symbol in wanted:
            hit = self._cache.get((provider.name, symbol))
            if hit and now - hit[0] < self.ttl:
                fresh[symbol] = hit[1]
            else:
                missing.append(symbol)
        if missing:
            fetched = await provider.quote(missing)
            for symbol, quote in fetched.items():
                self._cache[(provider.name, symbol)] = (now, quote)
                fresh[symbol] = quote
            if not fetched and provider.name != "stub":
                # A live provider that answers nothing must not leave the
                # screen blank; say so and fall back for this call.
                logger.warning("%s returned no quotes; using stub for this call", provider.name)
                for symbol, quote in (await self.stub.quote(missing)).items():
                    fresh[symbol] = quote
        source = provider.name if all(q.source == provider.name for q in fresh.values()) or not fresh \
            else "mixed"
        return {
            "source": source,
            "live": provider.live and source == provider.name,
            "as_of": _now(),
            "quotes": {s: q.as_dict() for s, q in fresh.items()},
        }

    def status(self) -> dict[str, Any]:
        provider = self.provider()
        return {
            "source": provider.name,
            "live": provider.live,
            "http_configured": self.http is not None,
            "kite_promoted": bool(self.price_feed is not None and self.price_feed.live),
        }


def build_http_provider(url: str, price_path: str, change_path: str,
                        auth_header: str) -> HttpJsonQuoteProvider | None:
    if not url:
        return None
    headers: dict[str, str] = {}
    if auth_header and ":" in auth_header:
        name, value = auth_header.split(":", 1)
        headers[name.strip()] = value.strip()
    return HttpJsonQuoteProvider(url, price_path or "price", change_path, headers)
