"""Turn a set of agent views into one recommendation, with its reasoning.

The spec's rule is the design constraint here: *users should never see an
unexplained AI decision*. So the explanation is not generated after the fact
from the answer — it is assembled from the same agent views that produced the
answer, which means it cannot drift from the maths.

Weights come from the learning loop when it has enough history, and fall back
to defaults when it doesn't. Either way the weights used are recorded on the
recommendation, so an old call can always be re-read in the terms it was made.
"""

from __future__ import annotations

from typing import Any

from .agents import AgentView

ENGINE_VERSION = "consolidator-0.1.0"

# Starting weights, replaced per-agent by learned ones once the loop has data.
DEFAULT_WEIGHTS: dict[str, float] = {
    "fundamental": 1.0,
    "technical": 0.6,
    "portfolio_risk": 0.8,
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

    # Each view counts by its assigned weight and its own confidence: an agent
    # that is unsure moves the blend less than one that is certain.
    total_weight = 0.0
    weighted_sum = 0.0
    for view in contributing:
        effective = weights.get(view.agent, 0.5) * (view.confidence / 100)
        weighted_sum += (view.score or 0.0) * effective
        total_weight += effective

    blended = weighted_sum / total_weight if total_weight else 0.0
    action = _action(blended)

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
        "reasoning": _reasoning(action, confidence, contributing, abstained),
        "evidence": {
            "blended_score": round(blended, 1),
            "weights_used": {v.agent: weights.get(v.agent, 0.5) for v in contributing},
            "contributing": [v.as_row(symbol) for v in contributing],
            "abstained": [{"agent": v.agent, "why": v.summary} for v in abstained],
            "engine": ENGINE_VERSION,
        },
        "engine_version": ENGINE_VERSION,
    }


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
    abstained: list[AgentView],
) -> str:
    """The user-facing explanation, built from the views that set the score."""
    lines = [f"{action} — confidence {confidence:.0f}%", "", "Reason:"]
    for view in sorted(contributing, key=lambda v: abs(v.score or 0), reverse=True):
        for reason in view.reasons:
            lines.append(f"• {reason}")
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
