"""Turn a set of agent views into one recommendation, with its reasoning.

The spec's rule is the design constraint here: *users should never see an
unexplained AI decision*. So the explanation is not generated after the fact
from the answer — it is assembled from the same agent views that produced the
answer, which means it cannot drift from the maths.

Agents come in two kinds and are combined differently, which is the main thing
to understand here:

* **Forecasts** (fundamental, technical, news, sentiment, macro) claim the
  price will move. They set the direction, as a weighted mean.
* **Brakes** (portfolio risk, cross-market, diversification) claim only that
  the user already carries this exposure. They scale a bullish score down and
  are ignored on a bearish one — a brake can cap a BUY at a HOLD, and can
  never produce a REDUCE.

Weights come from the learning loop when it has enough history, and fall back
to defaults when it doesn't. Either way the weights used are recorded on the
recommendation, so an old call can always be re-read in the terms it was made.
"""

from __future__ import annotations

from typing import Any

from .agents import SCALE, AgentView, NON_DIRECTIONAL

ENGINE_VERSION = "consolidator-0.2.0"

# Starting weights, replaced per-agent by learned ones once the loop has data.
DEFAULT_WEIGHTS: dict[str, float] = {
    "fundamental": 1.0,
    "technical": 0.6,
    "portfolio_risk": 0.8,
    "cross_market": 0.5,
    "diversification": 0.5,
    "news": 0.7,
    "sentiment": 0.4,
    "macro": 0.6,
}

# Blended score thresholds for each call.
BANDS = (
    (45.0, "BUY"),
    (15.0, "HOLD"),
    (-15.0, "HOLD"),
    (-45.0, "REDUCE"),
)


def consolidate(
    symbol: str,
    market_price: float,
    views: list[AgentView],
    *,
    valuation: dict[str, Any] | None = None,
    weights: dict[str, float] | None = None,
) -> dict[str, Any]:
    """One recommendation from many views."""
    weights = {**DEFAULT_WEIGHTS, **(weights or {})}

    contributing = [v for v in views if not v.abstained]
    abstained = [v for v in views if v.abstained]

    if not contributing:
        return _no_view(symbol, market_price, abstained, weights)

    # Forecasts set the direction; brakes only restrain it. Averaging the two
    # together was a real defect — see `_restraint`.
    forecasts = [v for v in contributing if v.agent not in NON_DIRECTIONAL]
    brakes = [v for v in contributing if v.agent in NON_DIRECTIONAL]

    raw = _weighted_mean(forecasts, weights) if forecasts else 0.0
    factor, restraint = _restraint(brakes, weights)

    # A brake is a reason not to add, never a reason to sell. It can pull a
    # BUY back to a HOLD; it cannot push a HOLD into a REDUCE.
    blended = raw * factor if raw > 0 else raw
    action = _action(blended) if forecasts else "HOLD"

    confidence = _confidence(contributing, abstained, blended)

    return {
        "symbol": symbol,
        "action": action,
        "market_price": market_price,
        "intrinsic_value": (valuation or {}).get("intrinsic_value"),
        "confidence": round(confidence, 1),
        "technical_score": _score_of(views, "technical"),
        "fundamental_score": _score_of(views, "fundamental"),
        "macro_score": _score_of(views, "macro"),
        "news_sentiment": _score_of(views, "sentiment"),
        "reasoning": _reasoning(action, confidence, contributing, abstained,
                                raw=raw, blended=blended, brakes=brakes),
        "evidence": {
            "blended_score": round(blended, 1),
            "forecast_score": round(raw, 1),
            "restraint": round(restraint, 1),
            "restraint_factor": round(factor, 3),
            "weights_used": {v.agent: weights.get(v.agent, 0.5) for v in contributing},
            "contributing": [v.as_row(symbol) for v in contributing],
            "abstained": [{"agent": v.agent, "why": v.summary} for v in abstained],
            "engine": ENGINE_VERSION,
        },
        "engine_version": ENGINE_VERSION,
    }


def _weighted_mean(views: list[AgentView], weights: dict[str, float]) -> float:
    """Each view counts by its assigned weight and its own confidence.

    An agent that is unsure moves the blend less than one that is certain.
    """
    total = 0.0
    weighted = 0.0
    for view in views:
        effective = weights.get(view.agent, 0.5) * (view.confidence / 100)
        weighted += (view.score or 0.0) * effective
        total += effective
    return weighted / total if total else 0.0


def _restraint(
    brakes: list[AgentView], weights: dict[str, float]
) -> tuple[float, float]:
    """How hard the non-forecasting agents are pulling on the handbrake.

    Returns `(factor, restraint)` where factor is in 0..1 and multiplies a
    bullish score.

    This split exists because the first version had none. Brakes were averaged
    in alongside forecasts on the same -100..100 axis, and since a brake can
    only ever emit a score at or below zero, every one of them added to the
    ensemble dragged the mean bearish by construction. Running a simulated
    year with three brakes and two forecasts produced zero BUY calls out of
    96 and twenty-six REDUCEs, most of them generated purely by concentration
    — the engine telling a user to sell a good business because they already
    owned some of it.

    A brake means "you already have this exposure". That is a reason not to
    add. It is not a reason to sell, and it says nothing at all about a name
    the user does not hold.
    """
    if not brakes:
        return 1.0, 0.0
    restraint = _weighted_mean(brakes, weights)   # <= 0
    factor = max(0.0, min(1.0, 1 + restraint / SCALE))
    return factor, restraint


def _action(blended: float) -> str:
    for threshold, action in BANDS:
        if blended >= threshold:
            return action
    return "SELL"


def _confidence(
    contributing: list[AgentView], abstained: list[AgentView], blended: float
) -> float:
    """How much to trust the call.

    Three things raise it: the agents individually being confident, them
    agreeing with each other, and few of them having sat the question out. A
    lone confident agent should not produce a 90% call.
    """
    mean_confidence = sum(v.confidence for v in contributing) / len(contributing)

    scores = [v.score or 0.0 for v in contributing]
    if len(scores) > 1:
        mean = sum(scores) / len(scores)
        spread = (sum((s - mean) ** 2 for s in scores) / len(scores)) ** 0.5
        # 60 points of disagreement wipes out the agreement bonus entirely.
        agreement = max(0.0, 1 - spread / 60)
    else:
        agreement = 0.5

    coverage = len(contributing) / max(len(contributing) + len(abstained), 1)

    raw = mean_confidence * (0.55 + 0.25 * agreement + 0.20 * coverage)
    # A blended score near zero is a genuine "no strong view"; don't dress it
    # up with high confidence just because the agents agreed there's nothing.
    conviction = min(1.0, 0.6 + abs(blended) / 100 * 0.4)
    return max(5.0, min(97.0, raw * conviction))


def _reasoning(
    action: str, confidence: float, contributing: list[AgentView],
    abstained: list[AgentView], *,
    raw: float = 0.0, blended: float = 0.0, brakes: list[AgentView] | None = None,
) -> str:
    """The user-facing explanation, built from the views that set the score."""
    lines = [f"{action} — confidence {confidence:.0f}%", "", "Reason:"]
    for view in sorted(contributing, key=lambda v: abs(v.score or 0), reverse=True):
        for reason in view.reasons:
            lines.append(f"• {reason}")

    # If a brake changed the answer, say so — a user must never see a call
    # softened by something the explanation didn't mention.
    if brakes and raw > 0 and blended < raw - 0.05:
        held_back = ", ".join(sorted(v.agent.replace("_", " ") for v in brakes))
        downgraded = _action(raw) != action
        lines.append("")
        lines.append(
            f"• The case on its own scores {raw:.0f}; portfolio exposure "
            f"({held_back}) holds it back to {blended:.0f}"
            + (f", which is a {action} rather than a {_action(raw)}."
               if downgraded else ".")
        )
        lines.append("  This limits adding to the position. It is not a reason to sell.")

    if abstained:
        lines.append("")
        lines.append("Not considered:")
        for view in abstained:
            lines.append(f"• {view.agent}: {view.summary}")
    return "\n".join(lines)


def _score_of(views: list[AgentView], agent: str) -> float | None:
    for view in views:
        if view.agent == agent:
            return view.score
    return None


def _no_view(
    symbol: str, market_price: float, abstained: list[AgentView],
    weights: dict[str, float],
) -> dict[str, Any]:
    """Every agent sat it out — say so rather than inventing a HOLD."""
    return {
        "symbol": symbol,
        "action": "AVOID",
        "market_price": market_price,
        "intrinsic_value": None,
        "confidence": 5.0,
        "technical_score": None,
        "fundamental_score": None,
        "macro_score": None,
        "news_sentiment": None,
        "reasoning": (
            "AVOID — confidence 5%\n\nReason:\n"
            "• No agent could form a view on this symbol, so there is nothing to "
            "act on. This is an absence of analysis, not a negative one.\n\n"
            "Not considered:\n"
            + "\n".join(f"• {v.agent}: {v.summary}" for v in abstained)
        ),
        "evidence": {
            "blended_score": None,
            "weights_used": weights,
            "contributing": [],
            "abstained": [{"agent": v.agent, "why": v.summary} for v in abstained],
            "engine": ENGINE_VERSION,
        },
        "engine_version": ENGINE_VERSION,
    }
