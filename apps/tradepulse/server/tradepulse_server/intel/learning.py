"""The feedback loop: score each agent against what actually happened.

For every judged recommendation, the agents that pointed the right way get
credit and the ones that pointed the wrong way get charged. Weights move toward
the agents that have been predictive, so future blends lean on what has worked.

Two guards matter more than the arithmetic:

* **Nothing moves on a thin sample.** Below `MIN_SAMPLE` an agent keeps its
  default weight. Re-weighting on four data points is how a model learns noise.
* **Weights are bounded and moved gradually.** An agent can never be silenced
  or allowed to dominate on the strength of one bad quarter.

Weight history is appended, never overwritten, so drift is auditable.
"""

from __future__ import annotations

from typing import Any

from .consolidator import DEFAULT_WEIGHTS

MIN_SAMPLE = 10          # judged calls before an agent's weight moves at all
MIN_WEIGHT = 0.20
MAX_WEIGHT = 1.60
LEARNING_RATE = 0.35     # how far toward the evidence a weight moves per run


def review(recommendation: dict[str, Any], outcome: dict[str, Any],
           agent_outputs: list[dict[str, Any]]) -> dict[str, Any]:
    """What worked, what failed, and why — for one completed recommendation."""
    correct = outcome["verdict"] == "CORRECT"
    move = (outcome.get("detail") or {}).get("price_move", 0.0)

    worked, failed = [], []
    for output in agent_outputs:
        score = output.get("score")
        if score is None:
            continue
        # An agent was right if its direction matched the price move.
        agreed = (score > 0 and move > 0) or (score < 0 and move < 0)
        (worked if agreed else failed).append({
            "agent": output["agent"],
            "score": score,
            "summary": output.get("summary", ""),
        })

    return {
        "recommendation_id": recommendation["id"],
        "symbol": recommendation["symbol"],
        "action": recommendation["action"],
        "verdict": outcome["verdict"],
        "price_move": move,
        "what_worked": worked,
        "what_failed": failed,
        "why": _explain(recommendation, outcome, worked, failed, correct),
        "most_predictive": worked[0]["agent"] if worked else None,
        "least_predictive": failed[0]["agent"] if failed else None,
    }


def _explain(recommendation, outcome, worked, failed, correct: bool) -> str:
    move = (outcome.get("detail") or {}).get("price_move", 0.0)
    head = (
        f"{recommendation['action']} on {recommendation['symbol']} was "
        f"{'right' if correct else 'wrong'}: the price moved {move:+.1%} over "
        f"{outcome['holding_days']} days."
    )
    if worked:
        head += " Called correctly by " + ", ".join(w["agent"] for w in worked) + "."
    if failed:
        head += " Pointed the wrong way by " + ", ".join(f["agent"] for f in failed) + "."
    if outcome.get("max_drawdown", 0) < -0.15:
        head += (f" Drawdown reached {outcome['max_drawdown']:.0%} along the way — "
                 "holding it would have required conviction.")
    return head


def recompute_weights(
    reviews: list[dict[str, Any]],
    current: dict[str, float] | None = None,
) -> list[dict[str, Any]]:
    """New weights per agent from its hit rate across reviewed calls."""
    current = {**DEFAULT_WEIGHTS, **(current or {})}

    tally: dict[str, dict[str, int]] = {}
    for entry in reviews:
        for item in entry["what_worked"]:
            bucket = tally.setdefault(item["agent"], {"hits": 0, "total": 0})
            bucket["hits"] += 1
            bucket["total"] += 1
        for item in entry["what_failed"]:
            bucket = tally.setdefault(item["agent"], {"hits": 0, "total": 0})
            bucket["total"] += 1

    out = []
    for agent, default in current.items():
        counts = tally.get(agent, {"hits": 0, "total": 0})
        sample = counts["total"]

        if sample < MIN_SAMPLE:
            out.append({
                "agent": agent,
                "weight": round(default, 3),
                "hit_rate": round(counts["hits"] / sample, 3) if sample else None,
                "sample_size": sample,
                "rationale": (
                    f"Held at the default: {sample} judged call(s), "
                    f"below the {MIN_SAMPLE} needed to re-weight."
                ),
            })
            continue

        hit_rate = counts["hits"] / sample
        # 50% is coin-flip and maps to the default; 100% doubles it, 0% halves.
        target = default * (0.5 + hit_rate)
        moved = default + (target - default) * LEARNING_RATE
        weight = max(MIN_WEIGHT, min(MAX_WEIGHT, moved))

        out.append({
            "agent": agent,
            "weight": round(weight, 3),
            "hit_rate": round(hit_rate, 3),
            "sample_size": sample,
            "rationale": (
                f"{counts['hits']}/{sample} calls directionally right "
                f"({hit_rate:.0%}); weight {'raised' if weight > default else 'lowered'} "
                f"from {default:.2f} to {weight:.2f}."
            ),
        })
    return out


def summarize(reviews: list[dict[str, Any]]) -> dict[str, Any]:
    """Which signals have been carrying, and which have been dead weight."""
    per_agent: dict[str, dict[str, int]] = {}
    for entry in reviews:
        for item in entry["what_worked"]:
            per_agent.setdefault(item["agent"], {"hits": 0, "total": 0})["hits"] += 1
            per_agent[item["agent"]]["total"] += 1
        for item in entry["what_failed"]:
            per_agent.setdefault(item["agent"], {"hits": 0, "total": 0})["total"] += 1

    ranked = sorted(
        (
            {
                "agent": agent,
                "hit_rate": round(c["hits"] / c["total"], 3),
                "sample_size": c["total"],
            }
            for agent, c in per_agent.items() if c["total"]
        ),
        key=lambda r: r["hit_rate"],
        reverse=True,
    )
    return {
        "reviewed": len(reviews),
        "best_signals": ranked[:3],
        "worst_signals": ranked[-3:][::-1] if len(ranked) > 3 else [],
        "agents": ranked,
    }
