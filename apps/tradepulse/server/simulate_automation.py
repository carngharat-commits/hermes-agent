#!/usr/bin/env python3
"""Drive the orchestrator over a simulated year and watch the loop learn.

`simulate.py` shows one pass through the pipeline. This shows what the pipeline
is actually for: many unattended cycles, accumulating enough judged calls that
the learning loop crosses its minimum sample and the agent weights start to
move on evidence rather than staying at their defaults.

    cd server && PYTHONPATH=. ./.venv/bin/python simulate_automation.py

The market here is rigged on purpose: prices are pulled toward intrinsic value,
recomputed each cycle, so valuation is genuinely predictive. If the loop works,
the agents that forecast should gain weight over the year. If every weight ends
at its default, the loop is running but not learning — which is the failure this
harness exists to catch.

It has already earned that. Three defects came out of running it: summed totals
double-counting overlapping calls on one symbol, a first version of the rigging
that inverted its own signal, and the learning loop grading a risk brake as if
it were a forecast.

Deterministic (fixed seed), so two runs agree and a behaviour change is a diff.
"""

from __future__ import annotations

import asyncio
import random
import sys
from datetime import datetime, timedelta, timezone

from tradepulse_server.intel.orchestrator import Orchestrator
from tradepulse_server.intel.providers import StubFundamentalsProvider
from tradepulse_server.intel.service import IntelService
from tradepulse_server.intel.store import IntelStore
from tradepulse_server.intel.valuation import value as value_company

SEED = 20260804
WIDTH = 84
CYCLES = 12
DAYS_PER_CYCLE = 30

# Starting prices for the stub book. Chosen to sit either side of each name's
# intrinsic value so the fundamental agent has something to be right about.
START_PRICES = {
    "RELIANCE": 260.0, "TCS": 1200.0, "AXISBANK": 380.0, "TATASTEEL": 120.0,
    "BHEL": 26.0, "IRCTC": 165.0, "CANBK": 35.0, "TITAN": 430.0,
}

HOLDINGS = [
    {"sym": "RELIANCE", "qty": 40, "ltp": 260.0},
    {"sym": "TCS", "qty": 8, "ltp": 1200.0},
    {"sym": "CANBK", "qty": 300, "ltp": 35.0},
]


def rule(title: str = "") -> None:
    print(f"\n{'─' * WIDTH}\n{title}\n{'─' * WIDTH}" if title else "─" * WIDTH)


def build_drifts(service: IntelService, prices: dict[str, float]) -> dict[str, float]:
    """Drift each name toward its intrinsic value, from wherever it is now.

    This is the rigging: a market that eventually respects valuation. Cheap
    names rise, expensive ones fall, and the pull weakens as the gap closes.

    Recomputed every cycle, and that matters. A first version fixed each drift
    once at t=0, so a cheap stock kept rising long after it became expensive —
    the planted signal inverted, the fundamental agent was punished for
    correctly calling overvaluation, and accuracy fell to 10% over the year.
    That was the harness lying, not the engine failing.
    """
    drifts = {}
    for symbol, price in prices.items():
        result = value_company(service.provider.fetch(symbol), price, provider="stub")
        margin = result.get("margin_of_safety")
        if margin is None:
            drifts[symbol] = 0.0
            continue
        drifts[symbol] = max(-0.0035, min(0.0035, margin * 0.010))
    return drifts


def print_valuation_setup(service: IntelService, drifts: dict[str, float]) -> None:
    rule("SETUP — the planted signal")
    print(f"  {'symbol':<12}{'price':>10}{'intrinsic':>12}{'margin':>10}{'daily drift':>14}")
    for symbol, price in START_PRICES.items():
        result = value_company(service.provider.fetch(symbol), price, provider="stub")
        margin = result.get("margin_of_safety")
        intrinsic = result.get("intrinsic_value")
        print(f"  {symbol:<12}{price:>10,.2f}{intrinsic:>12,.2f}"
              f"{('—' if margin is None else f'{margin:+.0%}'):>10}"
              f"{drifts[symbol]:>+14.4%}")
    print("\n  Prices are pulled toward intrinsic value, recomputed each cycle. An")
    print("  agent reading valuation should beat one reading a moving average.")


async def main() -> int:
    print("=" * WIDTH)
    print("TradePulse automation — 12 orchestrated cycles over a simulated year")
    print(f"seed {SEED} · synthetic prices · stub fundamentals")
    print("=" * WIDTH)

    random.seed(SEED)
    service = IntelService(store=IntelStore(":memory:"),
                           provider=StubFundamentalsProvider())
    orchestrator = Orchestrator(service)

    drifts = build_drifts(service, dict(START_PRICES))
    print_valuation_setup(service, drifts)

    rule("CYCLES")
    header = (f"  {'cycle':<7}{'recs':>6}{'judged':>8}{'accuracy':>10}"
              f"{'fundamental':>13}{'technical':>11}{'risk':>8}{'ms':>7}")
    print(header)
    print("  " + "-" * (len(header) - 2))

    prices = dict(START_PRICES)
    start = datetime.now(timezone.utc) - timedelta(days=CYCLES * DAYS_PER_CYCLE)
    weight_track: list[dict[str, float]] = []

    for cycle in range(1, CYCLES + 1):
        # Re-derive the pull from where prices actually are, so the planted
        # signal stays consistent with what the fundamental agent sees.
        drifts = build_drifts(service, prices)

        # Walk prices forward one cycle's worth of days, recording every mark
        # so the technical agent and the drawdown maths have a real path.
        for day in range(DAYS_PER_CYCLE):
            stamp = start + timedelta(days=(cycle - 1) * DAYS_PER_CYCLE + day)
            for symbol in prices:
                prices[symbol] *= 1 + drifts[symbol] + random.uniform(-0.012, 0.012)
                service.store.record_price(symbol, round(prices[symbol], 2),
                                           observed_at=stamp.isoformat(),
                                           source="simulation")

        holdings = [{**h, "ltp": prices.get(h["sym"], h["ltp"])} for h in HOLDINGS]
        result = await orchestrator.run_cycle(
            prices={s: round(p, 2) for s, p in prices.items()},
            holdings=holdings,
            trigger="simulation",
        )

        # Age this cycle's calls so later cycles can judge them. Without this
        # every recommendation stays OPEN and the loop never gets a sample.
        cycle_end = start + timedelta(days=cycle * DAYS_PER_CYCLE)
        with service.store.conn as conn:
            conn.execute(
                "UPDATE recommendations SET created_at = ? WHERE created_at > ?",
                (cycle_end.isoformat(), cycle_end.isoformat()),
            )

        recs = next(s for s in result.stages if s.name == "recommendations")
        outcomes = next(s for s in result.stages if s.name == "outcomes")
        weights = next(s for s in result.stages if s.name == "learning").detail["weights"]
        weight_track.append(dict(weights))

        accuracy = outcomes.detail.get("accuracy")
        print(f"  {cycle:<7}{recs.changed:>6}{outcomes.detail['judged']:>8}"
              f"{('—' if accuracy is None else f'{accuracy:.0%}'):>10}"
              f"{weights.get('fundamental', 0):>13.2f}{weights.get('technical', 0):>11.2f}"
              f"{weights.get('portfolio_risk', 0):>8.2f}{result.duration_ms:>7}")

    rule("DID IT LEARN?")
    first, last = weight_track[0], weight_track[-1]
    print(f"  {'agent':<18}{'start':>9}{'end':>9}{'change':>10}")
    for agent in sorted(last):
        delta = last[agent] - first[agent]
        print(f"  {agent:<18}{first[agent]:>9.2f}{last[agent]:>9.2f}{delta:>+10.2f}")

    lesson = service.learn()
    print(f"\n  reviewed {lesson['signals']['reviewed']} completed call(s)")
    for signal in lesson["signals"]["agents"]:
        print(f"    {signal['agent']:<18}{signal['hit_rate']:>7.0%} "
              f"over {signal['sample_size']} call(s)")

    moved = [a for a in last if abs(last[a] - first[a]) > 0.01]
    print(f"\n  weights that moved off their default: {moved or 'none'}")
    if not moved:
        print("  The loop ran but did not learn — either too few judged calls")
        print("  crossed MIN_SAMPLE, or no agent was consistently predictive.")

    rule("AUDIT")
    runs = service.store.runs(limit=CYCLES)
    ok = sum(1 for r in runs if r["ok"])
    total_ms = sum(r["duration_ms"] for r in runs)
    print(f"  cycles recorded          {len(runs)}")
    print(f"  cycles fully successful  {ok}/{len(runs)}")
    print(f"  total pipeline time      {total_ms} ms "
          f"({total_ms / max(len(runs), 1):.0f} ms per cycle)")
    print(f"  recommendations on file  {len(service.store.recommendations(limit=1000))}")
    print(f"  valuations on file       "
          f"{sum(len(service.store.valuation_history(s)) for s in START_PRICES)}")
    print("\n  Valuations stay at one row per symbol: the stub's financials never")
    print("  change, and an unchanged fingerprint is deliberately not re-stored.")

    perf = service.performance()["totals"]
    rule("FINAL PERFORMANCE")
    for label, key, fmt in (
        ("recommendations", "total_recommendations", "{}"),
        ("judged / open", None, None),
        ("accuracy", "accuracy", "{:.0%}"),
        ("win rate", "win_rate", "{:.0%}"),
        ("average return", "average_return", "{:+.1%}"),
        ("wealth created", "wealth_created", "{:+.1%}"),
        ("losses avoided", "losses_avoided", "{:.1%}"),
        ("positions counted", "positions_counted", "{}"),
    ):
        if key is None:
            print(f"  {'judged / open':<26}{perf['judged']} / {perf['open']}")
            continue
        raw = perf[key]
        print(f"  {label:<26}{'—' if raw is None else fmt.format(raw)}")

    rule()
    print("automation simulation complete")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
