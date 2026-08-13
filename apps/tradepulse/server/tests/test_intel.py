"""Store, agents, consolidator, learning loop, and the service that joins them."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

import pytest

from tradepulse_server.intel import learning
from tradepulse_server.intel.agents import (
    AgentView,
    Context,
    FundamentalResearchAgent,
    IntelligenceLayer,
    PortfolioRiskAgent,
    TechnicalAnalysisAgent,
    abstain,
)
from tradepulse_server.intel.consolidator import consolidate
from tradepulse_server.intel.service import IntelService
from tradepulse_server.intel.store import IntelStore


@pytest.fixture
def store() -> IntelStore:
    return IntelStore(":memory:")


@pytest.fixture
def service() -> IntelService:
    return IntelService(store=IntelStore(":memory:"))


# --- store: the append-only guarantee -------------------------------------

def test_a_new_call_supersedes_rather_than_overwrites(store: IntelStore):
    first = store.record_recommendation({
        "symbol": "RELIANCE", "action": "BUY", "market_price": 1200,
        "confidence": 70, "reasoning": "cheap", "evidence": {},
    })
    second = store.record_recommendation({
        "symbol": "RELIANCE", "action": "SELL", "market_price": 1500,
        "confidence": 65, "reasoning": "expensive now", "evidence": {},
    })

    assert store.recommendation(first)["action"] == "BUY"   # untouched
    assert store.recommendation(second)["supersedes_id"] == first
    assert store.recommendation(second)["version"] == 2
    assert len(store.recommendations("RELIANCE")) == 2


def test_current_recommendation_is_the_newest_version(store: IntelStore):
    store.record_recommendation({"symbol": "TCS", "action": "HOLD", "market_price": 100,
                                 "confidence": 50, "reasoning": "", "evidence": {}})
    store.record_recommendation({"symbol": "TCS", "action": "BUY", "market_price": 90,
                                 "confidence": 60, "reasoning": "", "evidence": {}})
    assert store.current_recommendation("TCS")["action"] == "BUY"


def test_identical_valuations_do_not_duplicate(store: IntelStore):
    row = {"symbol": "TCS", "as_of": "2026-03-31", "fingerprint": "abc",
           "provider": "stub", "intrinsic_value": 100.0, "detail": {}}
    first = store.record_valuation(row)
    second = store.record_valuation(dict(row))
    assert first == second
    assert len(store.valuation_history("TCS")) == 1


def test_new_financials_extend_the_trend(store: IntelStore):
    base = {"symbol": "TCS", "provider": "stub", "detail": {}}
    store.record_valuation({**base, "as_of": "2025-03-31", "fingerprint": "a", "intrinsic_value": 90})
    store.record_valuation({**base, "as_of": "2026-03-31", "fingerprint": "b", "intrinsic_value": 120})
    history = store.valuation_history("TCS")
    assert [h["intrinsic_value"] for h in history] == [90, 120]


def test_outcomes_are_replaced_not_appended(store: IntelStore):
    rec_id = store.record_recommendation({"symbol": "X", "action": "BUY", "market_price": 10,
                                          "confidence": 50, "reasoning": "", "evidence": {}})
    for price in (12, 15):
        store.record_outcome({
            "recommendation_id": rec_id, "current_price": price, "holding_days": 30,
            "verdict": "CORRECT", "detail": {},
        })
    assert store.outcome(rec_id)["current_price"] == 15


def test_evidence_round_trips_as_structured_data(store: IntelStore):
    rec_id = store.record_recommendation({
        "symbol": "X", "action": "BUY", "market_price": 10, "confidence": 50,
        "reasoning": "", "evidence": {"blended_score": 55.5, "contributing": ["a"]},
    })
    assert store.recommendation(rec_id)["evidence"]["blended_score"] == 55.5


# --- agents ---------------------------------------------------------------

def test_fundamental_agent_is_bullish_on_a_wide_discount():
    view = FundamentalResearchAgent().evaluate(Context(
        symbol="X", market_price=70,
        valuation={"margin_of_safety": 0.35, "intrinsic_value": 108,
                   "financial_health": 80, "business_quality": 75, "detail": {}},
    ))
    assert view.stance == "BULLISH"
    assert view.score > 0
    assert any("below intrinsic value" in r for r in view.reasons)


def test_fundamental_agent_is_bearish_at_a_premium():
    view = FundamentalResearchAgent().evaluate(Context(
        symbol="X", market_price=200,
        valuation={"margin_of_safety": -0.40, "intrinsic_value": 140,
                   "financial_health": 60, "business_quality": 60, "detail": {}},
    ))
    assert view.stance == "BEARISH"


def test_weak_fundamentals_damp_the_signal():
    """Cheap for a reason should not read the same as cheap."""
    strong = FundamentalResearchAgent().evaluate(Context(
        symbol="X", market_price=70,
        valuation={"margin_of_safety": 0.35, "intrinsic_value": 108,
                   "financial_health": 90, "business_quality": 90, "detail": {}}))
    weak = FundamentalResearchAgent().evaluate(Context(
        symbol="X", market_price=70,
        valuation={"margin_of_safety": 0.35, "intrinsic_value": 108,
                   "financial_health": 15, "business_quality": 15, "detail": {}}))
    assert strong.score > weak.score


def test_agents_abstain_rather_than_returning_a_neutral_score():
    """'No opinion' and 'balanced' are different; averaging them is wrong."""
    view = FundamentalResearchAgent().evaluate(Context(symbol="X", market_price=10))
    assert view.abstained
    assert view.score is None


def test_technical_agent_needs_enough_marks():
    thin = TechnicalAnalysisAgent().evaluate(
        Context(symbol="X", market_price=10, price_history=[10, 11, 12]))
    assert thin.abstained
    assert "need 20" in thin.summary


def test_technical_agent_reads_an_uptrend():
    rising = [100 + i for i in range(30)]
    view = TechnicalAnalysisAgent().evaluate(
        Context(symbol="X", market_price=130, price_history=rising))
    assert view.stance == "BULLISH"


def test_risk_agent_pushes_back_on_a_concentrated_position():
    holdings = [{"sym": "X", "qty": 100, "ltp": 100}, {"sym": "Y", "qty": 10, "ltp": 100}]
    view = PortfolioRiskAgent().evaluate(
        Context(symbol="X", market_price=100, holdings=holdings))
    assert view.stance == "BEARISH"
    assert "of the book" in view.summary


def test_risk_agent_is_neutral_on_an_unheld_name():
    view = PortfolioRiskAgent().evaluate(Context(
        symbol="NEW", market_price=100,
        holdings=[{"sym": "X", "qty": 10, "ltp": 100}]))
    assert view.stance == "NEUTRAL"


def test_a_failing_agent_does_not_take_down_the_run():
    class Exploding:
        name = "boom"

        def evaluate(self, context):
            raise RuntimeError("kaboom")

    views = IntelligenceLayer((Exploding(),)).gather(Context(symbol="X", market_price=1))
    assert views[0].abstained
    assert "kaboom" in views[0].summary


# --- consolidator ---------------------------------------------------------

def bullish(agent="fundamental", score=70.0, confidence=80.0) -> AgentView:
    return AgentView(agent=agent, stance="BULLISH", score=score, confidence=confidence,
                     summary="cheap", reasons=("Trading below intrinsic value.",))


def test_agreeing_bullish_agents_produce_a_buy():
    result = consolidate("X", 100, [bullish(), bullish("technical", 60.0)])
    assert result["action"] == "BUY"
    assert result["confidence"] > 40


def test_disagreement_lowers_confidence():
    agree = consolidate("X", 100, [bullish(), bullish("technical", 70.0)])
    clash = consolidate("X", 100, [bullish(), bullish("technical", -70.0)])
    assert clash["confidence"] < agree["confidence"]


def test_abstentions_lower_confidence():
    full = consolidate("X", 100, [bullish(), bullish("technical", 65.0)])
    thin = consolidate("X", 100, [
        bullish(), bullish("technical", 65.0),
        abstain("news", "no feed"), abstain("macro", "no feed"),
    ])
    assert thin["confidence"] < full["confidence"]


def test_reasoning_is_built_from_the_contributing_views():
    result = consolidate("X", 100, [bullish(), abstain("news", "no feed configured")])
    assert "Trading below intrinsic value." in result["reasoning"]
    assert "Not considered:" in result["reasoning"]
    assert "news: no feed configured" in result["reasoning"]


def test_every_recommendation_carries_its_evidence():
    result = consolidate("X", 100, [bullish()])
    assert result["evidence"]["blended_score"] is not None
    assert result["evidence"]["contributing"]
    assert result["evidence"]["weights_used"]


def test_no_views_at_all_is_reported_as_such_not_as_a_hold():
    result = consolidate("X", 100, [abstain("news", "no feed"), abstain("macro", "no feed")])
    assert result["action"] == "AVOID"
    assert result["confidence"] == 5.0
    assert "absence of analysis" in result["reasoning"]


def test_learned_weights_override_the_defaults():
    heavy = consolidate("X", 100, [bullish("technical", 80.0), bullish("fundamental", -20.0)],
                        weights={"technical": 1.6, "fundamental": 0.2})
    light = consolidate("X", 100, [bullish("technical", 80.0), bullish("fundamental", -20.0)],
                        weights={"technical": 0.2, "fundamental": 1.6})
    assert heavy["evidence"]["blended_score"] > light["evidence"]["blended_score"]


# --- learning loop --------------------------------------------------------

def review_of(agent_scores: dict[str, float], move: float, verdict: str) -> dict:
    return learning.review(
        {"id": 1, "symbol": "X", "action": "BUY"},
        {"verdict": verdict, "holding_days": 90, "max_drawdown": -0.05,
         "detail": {"price_move": move}},
        [{"agent": a, "score": s, "summary": ""} for a, s in agent_scores.items()],
    )


def test_review_separates_what_worked_from_what_failed():
    result = review_of({"fundamental": 60.0, "technical": -40.0}, move=0.2, verdict="CORRECT")
    assert [w["agent"] for w in result["what_worked"]] == ["fundamental"]
    assert [f["agent"] for f in result["what_failed"]] == ["technical"]
    assert "was right" in result["why"]


def test_review_calls_out_a_punishing_drawdown():
    result = learning.review(
        {"id": 1, "symbol": "X", "action": "BUY"},
        {"verdict": "CORRECT", "holding_days": 200, "max_drawdown": -0.35,
         "detail": {"price_move": 0.4}},
        [{"agent": "fundamental", "score": 50.0, "summary": ""}],
    )
    assert "would have required conviction" in result["why"]


def test_weights_do_not_move_on_a_thin_sample():
    """Re-weighting on a handful of calls is learning noise."""
    weights = learning.recompute_weights([review_of({"technical": 50.0}, 0.1, "CORRECT")] * 3)
    technical = next(w for w in weights if w["agent"] == "technical")
    assert technical["weight"] == 0.6          # the default
    assert "below the 10 needed" in technical["rationale"]


def test_a_consistently_right_agent_gains_weight():
    weights = learning.recompute_weights([review_of({"technical": 50.0}, 0.1, "CORRECT")] * 12)
    technical = next(w for w in weights if w["agent"] == "technical")
    assert technical["weight"] > 0.6
    assert technical["hit_rate"] == 1.0


def test_a_consistently_wrong_agent_loses_weight_but_is_not_silenced():
    weights = learning.recompute_weights([review_of({"technical": 50.0}, -0.1, "INCORRECT")] * 12)
    technical = next(w for w in weights if w["agent"] == "technical")
    assert technical["weight"] < 0.6
    assert technical["weight"] >= learning.MIN_WEIGHT


def test_summarize_ranks_the_signals():
    reviews = ([review_of({"fundamental": 50.0, "technical": -50.0}, 0.1, "CORRECT")] * 10)
    ranking = learning.summarize(reviews)
    assert ranking["best_signals"][0]["agent"] == "fundamental"


# --- service end to end ---------------------------------------------------

def test_service_values_a_covered_symbol(service: IntelService):
    result = service.valuation_for("RELIANCE", 1275.90)
    assert result["intrinsic_value"] is not None
    assert result["provider"] == "stub"


def test_service_returns_nothing_for_an_uncovered_symbol(service: IntelService):
    assert service.valuation_for("NOTCOVERED", 100.0) is None


def test_unchanged_financials_reuse_the_stored_valuation(service: IntelService):
    first = service.valuation_for("TCS", 2000.0)
    second = service.valuation_for("TCS", 2100.0)
    assert first["fingerprint"] == second["fingerprint"]
    assert len(service.valuation_history("TCS")) == 1
    # ...but the price-dependent fields still track today's price.
    assert second["margin_of_safety"] != first["margin_of_safety"]


def test_recommend_persists_the_call_and_its_agent_views(service: IntelService):
    result = asyncio.run(service.recommend("RELIANCE", 1275.90, holdings=[
        {"sym": "RELIANCE", "qty": 10, "ltp": 1275.90},
        {"sym": "TCS", "qty": 50, "ltp": 2000.0},
    ]))
    assert result["id"]
    assert result["action"] in {"BUY", "HOLD", "REDUCE", "SELL", "AVOID"}
    assert result["reasoning"].startswith(result["action"])

    stored = service.store.recommendation(result["id"])
    assert stored["symbol"] == "RELIANCE"
    assert service.store.agent_outputs(result["id"])


def test_pending_agents_are_recorded_as_abstaining(service: IntelService):
    result = asyncio.run(service.recommend("RELIANCE", 1275.90))
    abstained = {a["agent"] for a in result["evidence"]["abstained"]}
    assert {"news", "sentiment", "macro"} <= abstained


def test_full_loop_recommend_score_then_learn(service: IntelService):
    older = (datetime.now(timezone.utc) - timedelta(days=120)).isoformat()

    for symbol, price in (("RELIANCE", 1000.0), ("TCS", 2000.0), ("TITAN", 3000.0)):
        rec = asyncio.run(service.recommend(symbol, price))
        # Backdate so the outcome engine will judge rather than hold it open.
        with service.store.conn as conn:
            conn.execute("UPDATE recommendations SET created_at = ? WHERE id = ?",
                         (older, rec["id"]))

    scored = service.refresh_outcomes({"RELIANCE": 1400.0, "TCS": 1800.0, "TITAN": 3300.0})
    assert scored == 3

    report = service.performance()
    assert report["totals"]["judged"] == 3
    assert report["totals"]["accuracy"] is not None

    lesson = service.learn()
    assert len(lesson["reviews"]) == 3
    assert lesson["weights"]
    assert service.store.latest_weights()


# --- the agent layer runs concurrently ------------------------------------

def test_agents_run_in_parallel_not_one_after_another():
    """Once news/sentiment/macro are network calls, serial execution is the
    latency of all of them added together."""
    import time

    class Slow:
        def __init__(self, name):
            self.name = name

        async def evaluate(self, context):
            await asyncio.sleep(0.2)
            return AgentView(agent=self.name, stance="NEUTRAL", score=0.0,
                             confidence=50.0, summary="slept")

    layer = IntelligenceLayer(tuple(Slow(f"a{i}") for i in range(5)))
    started = time.monotonic()
    views = asyncio.run(layer.gather_async(Context(symbol="X", market_price=1)))
    elapsed = time.monotonic() - started

    assert len(views) == 5
    assert elapsed < 0.6, f"five 0.2s agents took {elapsed:.2f}s — they ran serially"


def test_a_hanging_agent_is_dropped_rather_than_stalling_the_ensemble():
    class Hanging:
        name = "hangs"

        async def evaluate(self, context):
            await asyncio.sleep(30)

    class Quick:
        name = "quick"

        def evaluate(self, context):
            return AgentView(agent="quick", stance="BULLISH", score=50.0,
                             confidence=80.0, summary="fine")

    layer = IntelligenceLayer((Hanging(), Quick()), timeout=0.2)
    views = asyncio.run(layer.gather_async(Context(symbol="X", market_price=1)))

    assert views[0].abstained and "timed out" in views[0].summary
    assert views[1].score == 50.0     # the healthy agent still contributed


def test_views_come_back_in_declaration_order():
    """The consolidator and the stored evidence both read positionally."""
    class Named:
        def __init__(self, name, delay):
            self.name, self.delay = name, delay

        async def evaluate(self, context):
            await asyncio.sleep(self.delay)
            return AgentView(agent=self.name, stance="NEUTRAL", score=0.0,
                             confidence=10.0, summary="")

    layer = IntelligenceLayer((Named("first", 0.15), Named("second", 0.01)))
    views = asyncio.run(layer.gather_async(Context(symbol="X", market_price=1)))
    assert [v.agent for v in views] == ["first", "second"]


def test_sync_gather_refuses_to_run_inside_a_loop():
    """Calling it from a route would block the loop; the error says what to do."""
    async def inner():
        IntelligenceLayer(()).gather(Context(symbol="X", market_price=1))

    with pytest.raises(RuntimeError, match="gather_async"):
        asyncio.run(inner())


# --- the learning loop only grades forecasts -------------------------------
# Found by simulate_automation.py: portfolio_risk scored a 15% hit rate over a
# simulated year and was driven to the floor weight. It never forecasts a
# direction — it says "don't add more" — so its sign against the price move
# measures nothing.

def test_a_non_directional_agent_is_not_graded_on_direction():
    result = review_of({"fundamental": 60.0, "portfolio_risk": -80.0},
                       move=0.2, verdict="CORRECT")
    graded = {w["agent"] for w in result["what_worked"]} | {
        f["agent"] for f in result["what_failed"]}
    assert "portfolio_risk" not in graded
    assert "fundamental" in graded


def test_a_non_directional_agent_keeps_its_default_weight():
    reviews = [review_of({"fundamental": 50.0, "portfolio_risk": -90.0}, 0.1, "CORRECT")] * 15
    weights = {w["agent"]: w for w in learning.recompute_weights(reviews)}
    assert weights["portfolio_risk"]["weight"] == 0.8      # untouched default
    assert weights["portfolio_risk"]["sample_size"] == 0
    assert weights["fundamental"]["weight"] > 1.0          # graded and rewarded


def test_agents_declare_whether_they_forecast():
    from tradepulse_server.intel.agents import (
        FundamentalResearchAgent, PortfolioRiskAgent, TechnicalAnalysisAgent,
    )
    assert FundamentalResearchAgent.directional is True
    assert TechnicalAnalysisAgent.directional is True
    assert PortfolioRiskAgent.directional is False


# --- cross-market correlation ----------------------------------------------

def _walk(start: float, moves: list[float]) -> list[float]:
    """A price path from a list of returns."""
    path = [start]
    for move in moves:
        path.append(round(path[-1] * (1 + move), 4))
    return path


def test_correlation_is_measured_on_returns_not_levels():
    """Two names that merely both drifted up are not the same position.

    On levels they correlate near 1.0; on returns — which is what tells you
    whether they fall together — they don't.
    """
    from tradepulse_server.intel.agents import _correlation

    up_a = _walk(100, [0.02, -0.01] * 15)
    up_b = _walk(500, [-0.01, 0.02] * 15)     # also drifts up, moves opposite
    assert _correlation(up_a, up_b) < 0

    together = _walk(300, [0.02, -0.01] * 15)  # same moves as up_a
    assert _correlation(up_a, together) > 0.99


def test_cross_market_penalises_a_book_that_moves_as_one():
    from tradepulse_server.intel.agents import CrossMarketAgent

    moves = [0.02, -0.015, 0.01, -0.005] * 8
    view = CrossMarketAgent().evaluate(Context(
        symbol="A", market_price=100,
        price_history=_walk(100, moves),
        peer_history={"B": _walk(250, moves), "C": _walk(80, moves)},
    ))
    assert view.score < -50
    assert view.stance == "BEARISH"
    assert "B" in view.detail["tightly_coupled"] and "C" in view.detail["tightly_coupled"]


def test_cross_market_stays_out_of_the_way_when_the_book_is_uncorrelated():
    """Low correlation is a neutral fact, not a reason to buy."""
    from tradepulse_server.intel.agents import CrossMarketAgent

    view = CrossMarketAgent().evaluate(Context(
        symbol="A", market_price=100,
        price_history=_walk(100, [0.02, -0.02] * 16),
        peer_history={"B": _walk(250, [0.01, 0.01, -0.03, 0.005] * 8)},
    ))
    assert view.score <= 0        # it can only ever penalise


def test_cross_market_abstains_without_enough_overlap():
    from tradepulse_server.intel.agents import CrossMarketAgent

    view = CrossMarketAgent().evaluate(Context(
        symbol="A", market_price=100,
        price_history=[100.0] * 5,
        peer_history={"B": [50.0] * 5},
    ))
    assert view.abstained and "20" in view.summary


# --- sector diversification -------------------------------------------------

BANK_BOOK = [
    {"sym": "AXISBANK", "qty": 100, "ltp": 1000},
    {"sym": "CANBK", "qty": 100, "ltp": 1000},
    {"sym": "TCS", "qty": 10, "ltp": 1000},
]


def test_diversification_sees_a_sector_the_single_name_weight_hides():
    """No one name is heavy, yet two thirds of the book is one sector."""
    from tradepulse_server.intel.agents import DiversificationAgent, PortfolioRiskAgent

    context = Context(
        symbol="AXISBANK", market_price=1000, holdings=BANK_BOOK,
        sectors={"AXISBANK": "Banking", "CANBK": "Banking", "TCS": "IT"},
    )
    assert DiversificationAgent().evaluate(context).score < -50
    # The concentration brake waves it through — it only reads one row.
    assert PortfolioRiskAgent().evaluate(context).score < 0  # 47% of the book
    assert DiversificationAgent().evaluate(context).detail["sector_share"] > 0.6


def test_diversification_is_quiet_on_a_spread_book():
    from tradepulse_server.intel.agents import DiversificationAgent

    view = DiversificationAgent().evaluate(Context(
        symbol="TCS", market_price=1000,
        holdings=[{"sym": s, "qty": 10, "ltp": 1000}
                  for s in ("TCS", "AXISBANK", "RELIANCE", "TITAN")],
        sectors={"TCS": "IT", "AXISBANK": "Banking",
                 "RELIANCE": "Energy", "TITAN": "Consumer"},
    ))
    assert view.score == 0.0
    assert view.detail["sector_share"] == 0.25


def test_diversification_abstains_rather_than_guessing_a_sector():
    from tradepulse_server.intel.agents import DiversificationAgent

    view = DiversificationAgent().evaluate(Context(
        symbol="UNKNOWN", market_price=10, holdings=BANK_BOOK,
        sectors={"AXISBANK": "Banking"},
    ))
    assert view.abstained and "UNKNOWN" in view.summary


def test_both_new_brakes_are_non_directional():
    """They say 'you already own this exposure', not 'this will fall'."""
    from tradepulse_server.intel.agents import CrossMarketAgent, DiversificationAgent

    assert CrossMarketAgent.directional is False
    assert DiversificationAgent.directional is False
    assert {"cross_market", "diversification"} <= learning.NON_DIRECTIONAL


# --- the service actually feeds them ---------------------------------------
# Both agents were wired into the ensemble before anything populated their
# inputs, so they abstained in every real run while the unit tests above
# passed. This is the test that would have caught that.

def test_service_populates_peer_history_and_sectors(service: IntelService):
    book = [
        {"sym": "AXISBANK", "qty": 100, "ltp": 1000},
        {"sym": "CANBK", "qty": 100, "ltp": 1000},
        {"sym": "TCS", "qty": 10, "ltp": 3000},
    ]
    moves = [0.015, -0.01, 0.02, -0.005] * 8
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for symbol, path in (("AXISBANK", _walk(1000, moves)),
                         ("CANBK", _walk(400, moves)),
                         ("TCS", _walk(3000, moves))):
        for day, price in enumerate(path):
            # Marks are keyed by (symbol, observed_at); one per day, or they
            # collapse into a single row.
            service.store.record_price(
                symbol, price,
                observed_at=(base + timedelta(days=day)).isoformat(),
            )

    rec = asyncio.run(service.recommend("AXISBANK", 1000.0, holdings=book))
    views = {v["agent"]: v for v in rec["agent_views"]}

    assert not views["cross_market"]["detail"].get("abstained"), \
        views["cross_market"]["summary"]
    assert set(views["cross_market"]["detail"]["correlations"]) == {"CANBK", "TCS"}

    assert not views["diversification"]["detail"].get("abstained"), \
        views["diversification"]["summary"]
    assert views["diversification"]["detail"]["sector"] == "Banking"
    # Both banks group together even though neither row alone is heavy.
    assert views["diversification"]["detail"]["sector_share"] > 0.6

    # And the explanation names them, per the spec's no-unexplained-AI rule.
    assert "correlation" in rec["reasoning"].lower()
    assert "banking" in rec["reasoning"].lower()
