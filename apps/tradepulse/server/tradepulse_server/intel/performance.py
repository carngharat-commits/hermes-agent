"""What each recommendation was actually worth.

Two questions, because a recommendation has two audiences:

* **Followed** — you acted. Entry, current, return, CAGR, drawdown, holding
  period. Ordinary position accounting.
* **Ignored** — you didn't. This is the half that usually goes unmeasured, and
  it is where a SELL earns its keep: a SELL you ignored on a stock that then
  fell has a *loss avoided* of zero (you took the loss) while the same SELL
  followed protected capital. The sign conventions below are the whole point,
  so they are spelled out per field.

Everything is computed from recorded price marks. No prices, no claims.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable

# Actions that express "own it" vs "don't".
BULLISH = {"BUY"}
BEARISH = {"SELL", "REDUCE", "AVOID"}
NEUTRAL = {"HOLD"}

# Below this a call is too young to score; returns over days are noise.
MIN_DAYS_TO_JUDGE = 7


def _parse(stamp: str) -> datetime:
    value = datetime.fromisoformat(stamp)
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def max_drawdown(prices: Iterable[float]) -> float:
    """Deepest peak-to-trough fall, as a negative fraction.

    Measured on the path, not the endpoints: a position that doubled after
    halving still had a -50% drawdown, and that is the number that tells you
    whether you could have held it.
    """
    peak = None
    worst = 0.0
    for price in prices:
        if price <= 0:
            continue
        if peak is None or price > peak:
            peak = price
        if peak:
            worst = min(worst, (price - peak) / peak)
    return round(worst, 4)


def annualised(total_return: float, days: int) -> float | None:
    """CAGR from a holding-period return.

    Undefined under a week — annualising a three-day move produces numbers
    that look like conviction and are arithmetic.
    """
    if days < MIN_DAYS_TO_JUDGE:
        return None
    years = days / 365.25
    if years <= 0 or total_return <= -1:
        return None
    return round((1 + total_return) ** (1 / years) - 1, 4)


def evaluate(
    recommendation: dict[str, Any],
    price_series: list[dict[str, Any]],
    current_price: float | None = None,
    *,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Score one recommendation against what prices did next."""
    entry = float(recommendation["market_price"])
    created = _parse(recommendation["created_at"])
    moment = now or datetime.now(timezone.utc)
    holding_days = max((moment - created).days, 0)

    path = [float(p["price"]) for p in price_series if p["observed_at"] >= recommendation["created_at"]]
    if current_price is None:
        current_price = path[-1] if path else entry
    if not path:
        path = [entry, current_price]

    move = (current_price - entry) / entry if entry > 0 else 0.0
    action = recommendation["action"].upper()

    followed = {
        "entry_price": round(entry, 2),
        "current_price": round(current_price, 2),
        # A BUY earns the move; acting on SELL/REDUCE/AVOID means being out of
        # it, so the return of the *decision* is the inverse of the move.
        "absolute_return": round(move if action in BULLISH else -move, 4)
        if action not in NEUTRAL else round(move, 4),
        "max_drawdown": max_drawdown(path),
        "holding_days": holding_days,
    }
    followed["cagr"] = annualised(followed["absolute_return"], holding_days)

    ignored = _ignored(action, entry, current_price, move)

    verdict = _verdict(action, move, holding_days)

    return {
        "recommendation_id": recommendation["id"],
        "current_price": round(current_price, 2),
        "holding_days": holding_days,
        "entry_price": followed["entry_price"],
        "absolute_return": followed["absolute_return"],
        "cagr": followed["cagr"],
        "max_drawdown": followed["max_drawdown"],
        "gain_missed": ignored["gain_missed"],
        "loss_avoided": ignored["loss_avoided"],
        "capital_protected": ignored["capital_protected"],
        "opportunity_cost": ignored["opportunity_cost"],
        "verdict": verdict,
        "detail": {
            "action": action,
            "price_move": round(move, 4),
            "marks_used": len(path),
            "followed": followed,
            "ignored": ignored,
            "judged": holding_days >= MIN_DAYS_TO_JUDGE,
        },
    }


def _ignored(action: str, entry: float, current: float, move: float) -> dict[str, Any]:
    """What not acting cost — all four figures as fractions of the position.

    `gain_missed` and `loss_avoided` are mutually exclusive by construction:
    a call is either one or the other, never both, so summing across a book
    never double-counts.
    """
    gain_missed = 0.0
    loss_avoided = 0.0

    if action in BULLISH:
        # Didn't buy. Upside forgone, or a bullet dodged.
        if move > 0:
            gain_missed = round(move, 4)
        else:
            loss_avoided = round(-move, 4)
    elif action in BEARISH:
        # Didn't sell. Still holding through whatever happened next.
        if move < 0:
            gain_missed = 0.0
            loss_avoided = 0.0  # the loss was taken, not avoided
        else:
            gain_missed = 0.0

    return {
        "gain_missed": gain_missed,
        # Only a *followed* bearish call protects capital, which is why this
        # reads from the action rather than from the price alone.
        "loss_avoided": round(-move, 4) if action in BEARISH and move < 0 else loss_avoided,
        "capital_protected": round(entry * -move, 2) if action in BEARISH and move < 0 else 0.0,
        # What ignoring cost, per unit of capital, in the direction of the call.
        "opportunity_cost": round(abs(move), 4) if _was_right(action, move) else 0.0,
    }


def _was_right(action: str, move: float) -> bool:
    if action in BULLISH:
        return move > 0
    if action in BEARISH:
        return move < 0
    return False


def _verdict(action: str, move: float, holding_days: int) -> str:
    """CORRECT / INCORRECT / OPEN.

    A HOLD is judged on the position not moving much against you, and anything
    younger than a week stays OPEN rather than being scored on noise.
    """
    if holding_days < MIN_DAYS_TO_JUDGE:
        return "OPEN"
    if action in NEUTRAL:
        return "CORRECT" if abs(move) < 0.10 else "INCORRECT"
    return "CORRECT" if _was_right(action, move) else "INCORRECT"


def aggregate(outcomes: list[dict[str, Any]]) -> dict[str, Any]:
    """Book-level totals — the numbers the AI Performance dashboard shows."""
    judged = [o for o in outcomes if o["verdict"] in {"CORRECT", "INCORRECT"}]
    correct = [o for o in judged if o["verdict"] == "CORRECT"]
    returns = [o["absolute_return"] for o in judged if o["absolute_return"] is not None]
    winners = [r for r in returns if r > 0]

    wealth_created = sum(r for r in returns if r > 0)
    losses_avoided = sum(o["loss_avoided"] or 0 for o in judged)

    return {
        "total_recommendations": len(outcomes),
        "judged": len(judged),
        "open": len(outcomes) - len(judged),
        "accuracy": round(len(correct) / len(judged), 4) if judged else None,
        "win_rate": round(len(winners) / len(returns), 4) if returns else None,
        "average_return": round(sum(returns) / len(returns), 4) if returns else None,
        "average_loss_avoided": round(losses_avoided / len(judged), 4) if judged else None,
        # Expressed per unit of capital committed, not in rupees: position
        # sizing is the user's, and inventing one would fabricate the headline.
        "wealth_created": round(wealth_created, 4),
        "losses_avoided": round(losses_avoided, 4),
        "capital_protected": round(sum(o["capital_protected"] or 0 for o in judged), 2),
        "opportunity_cost": round(sum(o["opportunity_cost"] or 0 for o in judged), 4),
        "best": _extreme(judged, highest=True),
        "worst": _extreme(judged, highest=False),
    }


def _extreme(outcomes: list[dict[str, Any]], *, highest: bool) -> dict[str, Any] | None:
    scored = [o for o in outcomes if o.get("absolute_return") is not None]
    if not scored:
        return None
    pick = (max if highest else min)(scored, key=lambda o: o["absolute_return"])
    return {
        "recommendation_id": pick["recommendation_id"],
        "symbol": pick.get("symbol"),
        "action": pick.get("action"),
        "absolute_return": pick["absolute_return"],
        "verdict": pick["verdict"],
    }


def by_action(outcomes: list[dict[str, Any]]) -> dict[str, Any]:
    """Accuracy split by call type — which signals are actually carrying."""
    buckets: dict[str, list[dict[str, Any]]] = {}
    for outcome in outcomes:
        if outcome["verdict"] not in {"CORRECT", "INCORRECT"}:
            continue
        buckets.setdefault((outcome.get("action") or "?").upper(), []).append(outcome)

    return {
        action: {
            "count": len(rows),
            "accuracy": round(
                sum(1 for r in rows if r["verdict"] == "CORRECT") / len(rows), 4
            ),
            "average_return": round(
                sum(r["absolute_return"] for r in rows) / len(rows), 4
            ),
        }
        for action, rows in sorted(buckets.items())
    }
