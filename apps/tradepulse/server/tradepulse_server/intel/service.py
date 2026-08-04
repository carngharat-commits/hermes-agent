"""The orchestration the API talks to.

Holds the wiring — store, provider, agents — so route handlers stay thin and
the whole pipeline is testable without HTTP.
"""

from __future__ import annotations

from typing import Any

from . import learning, performance, valuation
from .agents import ALL_AGENTS, Context, IntelligenceLayer
from .consolidator import consolidate
from .providers import FundamentalsProvider, StubFundamentalsProvider
from .store import IntelStore, utcnow


class IntelService:
    def __init__(
        self,
        store: IntelStore | None = None,
        provider: FundamentalsProvider | None = None,
        layer: IntelligenceLayer | None = None,
    ):
        self.store = store or IntelStore()
        self.provider = provider or StubFundamentalsProvider()
        self.layer = layer or IntelligenceLayer(ALL_AGENTS)

    # -- valuation ----------------------------------------------------------

    def valuation_for(self, symbol: str, market_price: float) -> dict[str, Any] | None:
        """Value a symbol, reusing the stored result when financials are unchanged.

        The fingerprint check is what makes "refresh when new statements land"
        cheap: same inputs, same row, no recompute.
        """
        fundamentals = self.provider.fetch(symbol)
        if fundamentals is None:
            return None

        result = valuation.value(fundamentals, market_price, provider=self.provider.name)
        stored = self.store.latest_valuation(symbol)
        if stored and stored["fingerprint"] == result["fingerprint"]:
            # Same financials — keep the stored row, but reflect today's price.
            refreshed = dict(stored)
            refreshed.update(_reprice(stored, market_price))
            return refreshed

        result["id"] = self.store.record_valuation(result)
        return result

    def valuation_history(self, symbol: str) -> list[dict[str, Any]]:
        return self.store.valuation_history(symbol)

    def covered_symbols(self) -> list[str]:
        return self.provider.covered()

    # -- recommendations ----------------------------------------------------

    def recommend(
        self,
        symbol: str,
        market_price: float,
        *,
        holdings: list[dict[str, Any]] | None = None,
        persist: bool = True,
    ) -> dict[str, Any]:
        """Run the agents, consolidate, and record the call permanently."""
        fundamentals = self.provider.fetch(symbol)
        result = self.valuation_for(symbol, market_price)
        history = [p["price"] for p in self.store.price_series(symbol)]

        context = Context(
            symbol=symbol,
            market_price=market_price,
            fundamentals=fundamentals,
            valuation=result,
            price_history=history,
            holdings=holdings or [],
        )
        views = self.layer.gather(context)

        weights = {a: w["weight"] for a, w in self.store.latest_weights().items()}
        recommendation = consolidate(
            symbol, market_price, views, valuation=result, weights=weights or None
        )
        recommendation["valuation_id"] = (result or {}).get("id")

        if persist:
            rec_id = self.store.record_recommendation(recommendation)
            self.store.record_agent_outputs(rec_id, [v.as_row(symbol) for v in views])
            self.store.record_price(symbol, market_price)
            recommendation["id"] = rec_id
            recommendation["created_at"] = self.store.recommendation(rec_id)["created_at"]

        recommendation["agent_views"] = [v.as_row(symbol) for v in views]
        return recommendation

    def history(self, symbol: str | None = None, limit: int = 200) -> list[dict[str, Any]]:
        return self.store.recommendations(symbol, limit)

    # -- performance --------------------------------------------------------

    def refresh_outcomes(self, prices: dict[str, float]) -> int:
        """Re-score every recommendation against the latest marks."""
        self.store.record_prices(prices.items(), source="refresh")
        scored = 0
        for rec in self.store.recommendations(limit=1000):
            current = prices.get(rec["symbol"])
            series = self.store.price_series(rec["symbol"])
            outcome = performance.evaluate(rec, series, current)
            self.store.record_outcome(outcome)
            scored += 1
        return scored

    def performance(self) -> dict[str, Any]:
        outcomes = self.store.outcomes()
        return {
            "totals": performance.aggregate(outcomes),
            "by_action": performance.by_action(outcomes),
            "outcomes": outcomes,
        }

    # -- learning -----------------------------------------------------------

    def learn(self) -> dict[str, Any]:
        """Review completed calls, then move the weights."""
        reviews = []
        for rec in self.store.recommendations(limit=1000):
            outcome = self.store.outcome(rec["id"])
            if not outcome or outcome["verdict"] == "OPEN":
                continue
            reviews.append(
                learning.review(rec, outcome, self.store.agent_outputs(rec["id"]))
            )

        current = {a: w["weight"] for a, w in self.store.latest_weights().items()}
        weights = learning.recompute_weights(reviews, current or None)
        self.store.record_weights(weights)

        return {
            "computed_at": utcnow(),
            "reviews": reviews,
            "weights": weights,
            "signals": learning.summarize(reviews),
        }


def _reprice(stored: dict[str, Any], market_price: float) -> dict[str, Any]:
    """Recompute only the price-dependent fields of a stored valuation."""
    intrinsic = stored.get("intrinsic_value")
    if not intrinsic or market_price <= 0:
        return {"market_price": market_price}
    return {
        "market_price": market_price,
        "margin_of_safety": round((intrinsic - market_price) / intrinsic, 4),
        "discount_premium": round((market_price - intrinsic) / intrinsic, 4),
    }
