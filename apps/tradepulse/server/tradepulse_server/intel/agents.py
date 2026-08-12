"""Specialist agents and the intelligence layer they publish into.

Each agent answers one question about one symbol and returns a structured
``AgentView``: a stance, a score on a common -100..100 scale, its own
confidence, and the reasons behind both. The consolidator blends the views
into a single recommendation, so adding an agent never touches the caller.

The scale is the contract. An agent that cannot form a view returns
``abstain()`` rather than a neutral score — "no opinion" and "balanced" are
different things, and averaging them together is how ensembles get quietly
wrong.

Three agents here are real, deterministic computation. Three (news, sentiment,
macro) need live feeds and a language model; they implement the same interface
and abstain until wired, so the consolidator already handles their absence.
"""

from __future__ import annotations

import asyncio
import inspect
from dataclasses import dataclass, field
from typing import Any, Protocol

from . import valuation
from .providers import Fundamentals

SCALE = 100.0


@dataclass(frozen=True)
class AgentView:
    """One agent's opinion on one symbol."""

    agent: str
    stance: str                 # BULLISH | BEARISH | NEUTRAL | ABSTAIN
    score: float | None         # -100 (max bearish) .. +100 (max bullish)
    confidence: float           # 0..100
    summary: str
    reasons: tuple[str, ...] = field(default_factory=tuple)
    detail: dict[str, Any] = field(default_factory=dict)

    @property
    def abstained(self) -> bool:
        return self.stance == "ABSTAIN" or self.score is None

    def as_row(self, symbol: str) -> dict[str, Any]:
        return {
            "symbol": symbol,
            "agent": self.agent,
            "stance": self.stance,
            "score": self.score,
            "confidence": self.confidence,
            "summary": self.summary,
            "detail": {**self.detail, "reasons": list(self.reasons)},
        }


def abstain(agent: str, why: str) -> AgentView:
    return AgentView(agent=agent, stance="ABSTAIN", score=None, confidence=0.0,
                     summary=why, detail={"abstained": True})


@dataclass
class Context:
    """Everything the agents get to look at."""

    symbol: str
    market_price: float
    fundamentals: Fundamentals | None = None
    valuation: dict[str, Any] | None = None
    price_history: list[float] = field(default_factory=list)
    holdings: list[dict[str, Any]] = field(default_factory=list)
    news: list[dict[str, Any]] = field(default_factory=list)


class Agent(Protocol):
    name: str
    # Whether the agent is claiming the price will move in a direction.
    # The learning loop scores hit rate by comparing an agent's sign against
    # the price move, which only means something for agents that are actually
    # forecasting. A risk brake says "don't add more", not "this will fall" —
    # grading it that way drove it to the floor weight in a simulated year for
    # being bad at a job it never claimed to do.
    directional: bool

    def evaluate(self, context: Context) -> AgentView:
        ...


# --------------------------------------------------------------- fundamental

class FundamentalResearchAgent:
    """Reads the valuation: how far price sits from intrinsic, and on what quality."""

    name = "fundamental"
    directional = True

    def evaluate(self, context: Context) -> AgentView:
        result = context.valuation
        if not result or result.get("margin_of_safety") is None:
            return abstain(self.name, "No valuation available for this symbol.")

        margin = result["margin_of_safety"]
        health = result["financial_health"]
        quality = result["business_quality"]

        # A 40% discount is a full-conviction signal; scale linearly to it.
        score = max(-SCALE, min(SCALE, margin / 0.40 * SCALE))
        # Weak fundamentals damp the signal in both directions — cheap for a
        # reason is not the same as cheap.
        score *= 0.5 + 0.5 * ((health + quality) / 200)

        reasons = []
        if margin > 0:
            reasons.append(f"Trading {margin:.0%} below intrinsic value of "
                           f"₹{result['intrinsic_value']:,.0f}.")
        else:
            reasons.append(f"Trading {abs(margin):.0%} above intrinsic value of "
                           f"₹{result['intrinsic_value']:,.0f}.")
        reasons.append(f"Financial health {health:.0f}/100, business quality {quality:.0f}/100.")
        blend = (result.get("detail") or {}).get("blend") or {}
        if blend.get("reason"):
            reasons.append(f"Valuation method: {blend['reason']}.")

        return AgentView(
            agent=self.name,
            stance=_stance(score),
            score=round(score, 1),
            # Confidence tracks how much of the value survives without growth
            # assumptions: an EPV-backed number is firmer than a DCF-backed one.
            confidence=round(40 + 0.6 * ((health + quality) / 2), 1),
            summary=f"{margin:+.0%} margin of safety on a "
                    f"{'high' if quality > 65 else 'mixed'}-quality business.",
            reasons=tuple(reasons),
            detail={"margin_of_safety": margin, "financial_health": health,
                    "business_quality": quality},
        )


# ----------------------------------------------------------------- technical

class TechnicalAnalysisAgent:
    """Trend and momentum from the recorded price path."""

    name = "technical"
    directional = True
    MIN_MARKS = 20

    def evaluate(self, context: Context) -> AgentView:
        prices = context.price_history
        if len(prices) < self.MIN_MARKS:
            return abstain(
                self.name,
                f"Only {len(prices)} price marks; need {self.MIN_MARKS} to read a trend.",
            )

        short = sum(prices[-10:]) / 10
        long = sum(prices[-20:]) / 20
        last = prices[-1]
        high = max(prices)
        low = min(prices)

        trend = (short - long) / long if long else 0.0
        position = (last - low) / (high - low) if high > low else 0.5

        # Trend carries the signal; range position confirms or tempers it.
        score = max(-SCALE, min(SCALE, trend / 0.08 * SCALE)) * 0.7 + (position - 0.5) * 2 * SCALE * 0.3

        reasons = [
            f"10-mark average {'above' if trend > 0 else 'below'} the 20-mark average "
            f"by {abs(trend):.1%}.",
            f"Trading at {position:.0%} of its observed range.",
        ]

        return AgentView(
            agent=self.name,
            stance=_stance(score),
            score=round(score, 1),
            # More history, more confidence — capped, since this is a short window.
            confidence=round(min(70.0, 30 + len(prices)), 1),
            summary=f"{'Uptrend' if trend > 0 else 'Downtrend'} on the recorded path.",
            reasons=tuple(reasons),
            detail={"trend": round(trend, 4), "range_position": round(position, 4),
                    "marks": len(prices)},
        )


# ------------------------------------------------------------ portfolio risk

class PortfolioRiskAgent:
    """Concentration: what this position already is inside the book."""

    name = "portfolio_risk"
    directional = False
    HEAVY = 0.10   # a single name above 10% of the book

    def evaluate(self, context: Context) -> AgentView:
        holdings = context.holdings
        if not holdings:
            return abstain(self.name, "No holdings loaded.")

        def market_value(row: dict[str, Any]) -> float:
            return float(row.get("qty") or 0) * float(row.get("ltp") or 0)

        total = sum(market_value(h) for h in holdings)
        if total <= 0:
            return abstain(self.name, "Portfolio has no valued positions.")

        held = sum(market_value(h) for h in holdings if h.get("sym") == context.symbol)
        weight = held / total

        if held == 0:
            return AgentView(
                agent=self.name, stance="NEUTRAL", score=0.0, confidence=55.0,
                summary="Not currently held — a new position adds diversification.",
                reasons=("No existing exposure to this symbol.",),
                detail={"weight": 0.0, "held_value": 0.0},
            )

        # Above the threshold this argues against adding, regardless of how
        # attractive the name looks on its own.
        score = -SCALE * min(1.0, (weight - self.HEAVY) / self.HEAVY) if weight > self.HEAVY else 0.0

        return AgentView(
            agent=self.name,
            stance=_stance(score),
            score=round(score, 1),
            confidence=70.0,
            summary=f"Already {weight:.1%} of the book.",
            reasons=(
                f"Position is {weight:.1%} of portfolio value"
                + (f", above the {self.HEAVY:.0%} concentration threshold."
                   if weight > self.HEAVY else "."),
            ),
            detail={"weight": round(weight, 4), "held_value": round(held, 2),
                    "portfolio_value": round(total, 2)},
        )


# ------------------------------------------------- awaiting feeds and a model

class _PendingAgent:
    """Implements the contract, abstains until its data source is wired.

    Present rather than absent on purpose: the consolidator's handling of a
    missing view is exercised from day one, and the UI can show what the AI
    is not yet looking at instead of silently omitting it.
    """

    requirement = ""
    directional = True

    def evaluate(self, context: Context) -> AgentView:
        return abstain(self.name, self.requirement)


class MarketNewsAgent(_PendingAgent):
    name = "news"
    requirement = ("Needs a news feed (exchange filings, RBI/SEBI releases, "
                   "company announcements). No source configured.")


class SentimentAgent(_PendingAgent):
    name = "sentiment"
    requirement = "Needs a language model to score sentiment. None configured."


class MacroEconomyAgent(_PendingAgent):
    name = "macro"
    requirement = ("Needs macro series (rates, CPI, crude, USD-INR) and the "
                   "cross-market map. No source configured.")


DETERMINISTIC_AGENTS: tuple[Agent, ...] = (
    FundamentalResearchAgent(),
    TechnicalAnalysisAgent(),
    PortfolioRiskAgent(),
)

PENDING_AGENTS: tuple[Agent, ...] = (
    MarketNewsAgent(),
    SentimentAgent(),
    MacroEconomyAgent(),
)

ALL_AGENTS: tuple[Agent, ...] = DETERMINISTIC_AGENTS + PENDING_AGENTS


def _stance(score: float) -> str:
    if score >= 20:
        return "BULLISH"
    if score <= -20:
        return "BEARISH"
    return "NEUTRAL"


class IntelligenceLayer:
    """Runs the agents and collects their views.

    Agents fan out concurrently. The three deterministic ones are fast enough
    that it hardly matters, but news, sentiment and macro will each be a
    network call or a model round-trip — run in sequence that is the latency
    of the slowest three added together, and the ensemble stops being usable.

    An agent that raises is recorded as abstaining rather than taking the run
    down: one specialist failing should cost its contribution, not the
    recommendation. Same for one that hangs — see `timeout`.
    """

    def __init__(self, agents: tuple[Agent, ...] = ALL_AGENTS, *, timeout: float = 20.0):
        self.agents = agents
        self.timeout = timeout

    async def _run_one(self, agent: Agent, context: Context) -> AgentView:
        try:
            result = agent.evaluate(context)
            # Agents may be sync or async; a sync one must not block the loop
            # while the others are in flight.
            if inspect.isawaitable(result):
                return await asyncio.wait_for(result, timeout=self.timeout)
            return await asyncio.to_thread(lambda: result)
        except asyncio.TimeoutError:
            return abstain(agent.name, f"Agent timed out after {self.timeout:.0f}s.")
        except Exception as exc:  # noqa: BLE001 - isolation is the point
            return abstain(agent.name, f"Agent failed: {exc}")

    async def gather_async(self, context: Context) -> list[AgentView]:
        """Fan out to every agent, preserving declaration order in the result."""
        return list(await asyncio.gather(
            *(self._run_one(agent, context) for agent in self.agents)
        ))

    def gather(self, context: Context) -> list[AgentView]:
        """Synchronous entry point, for callers not already in a loop."""
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            return asyncio.run(self.gather_async(context))
        raise RuntimeError(
            "gather() called from inside an event loop; await gather_async() instead."
        )


def build_context(
    symbol: str,
    market_price: float,
    *,
    fundamentals: Fundamentals | None = None,
    price_history: list[float] | None = None,
    holdings: list[dict[str, Any]] | None = None,
) -> Context:
    """Assemble a Context, valuing the symbol if fundamentals are available."""
    result = None
    if fundamentals is not None:
        result = valuation.value(fundamentals, market_price)
    return Context(
        symbol=symbol,
        market_price=market_price,
        fundamentals=fundamentals,
        valuation=result,
        price_history=price_history or [],
        holdings=holdings or [],
    )
