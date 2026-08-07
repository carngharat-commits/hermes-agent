#!/usr/bin/env python3
"""End-to-end simulation with dummy data, printing input and output at each stage.

Unit tests assert; this shows. Run it to watch a company's financials become a
valuation, a valuation become a recommendation, a recommendation meet real
prices, and the outcome move the AI's weights — with the numbers visible at
every hand-off so they can be sanity-checked by eye.

    cd server && PYTHONPATH=. ./.venv/bin/python simulate.py

Everything is synthetic and deterministic (fixed seed), so two runs agree and
a behaviour change shows up as a diff.
"""

from __future__ import annotations

import random
import sys
from datetime import datetime, timedelta, timezone

from tradepulse_server.intel import learning, performance
from tradepulse_server.intel.providers import AnnualFinancials, Fundamentals
from tradepulse_server.intel.service import IntelService
from tradepulse_server.intel.store import IntelStore
from tradepulse_server.intel.valuation import value as value_company

SEED = 20260804
WIDTH = 78


def rule(title: str = "") -> None:
    if title:
        print(f"\n{'─' * WIDTH}\n{title}\n{'─' * WIDTH}")
    else:
        print("─" * WIDTH)


def kv(label: str, value: object, indent: int = 2) -> None:
    print(f"{' ' * indent}{label:<28} {value}")


def money(value: float | None) -> str:
    """None means the model declined to answer — never print it as a number."""
    return "—  (not modelled)" if value is None else f"{value:,.2f}"


def percent(value: float | None) -> str:
    return "—  (undefined)" if value is None else f"{value:+.1%}"


# --------------------------------------------------------------- dummy input

def dummy_company(
    symbol: str, name: str, sector: str, *,
    revenue: float, margin: float, growth: float, fcf_conv: float,
    shares: float, debt: float, cash: float, equity: float, beta: float,
) -> Fundamentals:
    """Five years of financials, compounding from the given base."""
    years = []
    current = revenue
    for index in range(5):
        net = current * margin
        years.append(AnnualFinancials(
            period_end=f"{2022 + index}-03-31",
            revenue=round(current, 2),
            net_income=round(net, 2),
            operating_income=round(net * 1.35, 2),
            free_cash_flow=round(net * fcf_conv, 2),
            total_debt=round(debt * (1 + 0.03 * index), 2),
            cash=round(cash * (1 + 0.08 * index), 2),
            total_equity=round(equity * (1 + 0.11 * index), 2),
            total_assets=round(equity * 2.4 * (1 + 0.09 * index), 2),
            shares_outstanding=shares,
        ))
        current *= 1 + growth
    return Fundamentals(symbol=symbol, name=name, sector=sector, beta=beta,
                        annuals=tuple(years))


# Three deliberately different businesses: a cheap compounder, an expensive
# one, and a leveraged cyclical. If the engine is working they should not all
# get the same call.
COMPANIES = [
    ("BARGAIN", dummy_company(
        "BARGAIN", "Bargain Industries", "Industrials",
        revenue=50_000, margin=0.14, growth=0.12, fcf_conv=0.85,
        shares=500, debt=4_000, cash=9_000, equity=42_000, beta=0.9), 60.0),
    ("PRICEY", dummy_company(
        "PRICEY", "Pricey Consumer", "Consumer",
        revenue=20_000, margin=0.11, growth=0.09, fcf_conv=0.70,
        shares=300, debt=2_500, cash=3_000, equity=15_000, beta=1.0), 900.0),
    ("LEVERED", dummy_company(
        "LEVERED", "Levered Metals", "Metals",
        revenue=80_000, margin=0.035, growth=0.03, fcf_conv=0.45,
        shares=900, debt=60_000, cash=1_500, equity=28_000, beta=1.5), 45.0),
]

DUMMY_HOLDINGS = [
    {"sym": "BARGAIN", "qty": 400, "ltp": 60.0},
    {"sym": "PRICEY", "qty": 5, "ltp": 900.0},
    {"sym": "OTHER", "qty": 1000, "ltp": 50.0},
]


class SimProvider:
    """Serves the dummy companies above."""

    name = "simulation"

    def __init__(self):
        self._data = {sym: f for sym, f, _ in COMPANIES}

    def fetch(self, symbol):
        return self._data.get(symbol.upper())

    def covered(self):
        return sorted(self._data)


# ------------------------------------------------------------------- stages

def stage_1_valuation() -> None:
    rule("STAGE 1 — financials in, intrinsic value out")
    for symbol, fundamentals, price in COMPANIES:
        latest = fundamentals.latest
        print(f"\n{symbol} · {fundamentals.name} ({fundamentals.sector})")
        print("  INPUT (latest fiscal year)")
        kv("revenue", f"{latest.revenue:,.0f}", 4)
        kv("net income", f"{latest.net_income:,.0f}", 4)
        kv("free cash flow", f"{latest.free_cash_flow:,.0f}", 4)
        kv("total debt / cash", f"{latest.total_debt:,.0f} / {latest.cash:,.0f}", 4)
        kv("shares outstanding", f"{latest.shares_outstanding:,.0f}", 4)
        kv("market price", f"{price:,.2f}", 4)

        result = value_company(fundamentals, price, provider="simulation")
        print("  OUTPUT")
        kv("DCF per share", money(result["dcf_value"]), 4)
        kv("EPV per share", money(result["epv_value"]), 4)
        kv("intrinsic value", money(result["intrinsic_value"]), 4)
        kv("fair value", money(result["fair_value"]), 4)
        kv("margin of safety", percent(result["margin_of_safety"]), 4)
        kv("discount / premium", percent(result["discount_premium"]), 4)
        kv("financial health", f"{result['financial_health']:.0f}/100", 4)
        kv("business quality", f"{result['business_quality']:.0f}/100", 4)
        kv("blend rule", result["detail"]["blend"]["reason"], 4)

    print("\n  SANITY: the cheap compounder should show a positive margin of")
    print("  safety and the expensive one a negative one. If they match, the")
    print("  engine is not discriminating and something is wrong.")


def stage_2_recommendation(service: IntelService) -> list[dict]:
    rule("STAGE 2 — valuation + agents in, an explained recommendation out")
    recommendations = []
    for symbol, _, price in COMPANIES:
        print(f"\n{symbol} @ {price:,.2f}")
        print(f"  INPUT holdings: {DUMMY_HOLDINGS}")
        rec = service.recommend(symbol, price, holdings=DUMMY_HOLDINGS)
        recommendations.append(rec)

        print("  AGENT VIEWS")
        for view in rec["agent_views"]:
            score = "—" if view["score"] is None else f"{view['score']:+.0f}"
            kv(f"{view['agent']:<15} {view['stance']:<8}",
               f"score {score:>6}  conf {view['confidence']:.0f}%", 4)

        print("  OUTPUT")
        kv("action", rec["action"], 4)
        kv("confidence", f"{rec['confidence']:.0f}%", 4)
        kv("blended score", rec["evidence"]["blended_score"], 4)
        print("  REASONING")
        for line in rec["reasoning"].splitlines():
            print(f"    {line}" if line else "")
    return recommendations


def stage_3_prices(service: IntelService, recommendations: list[dict]) -> dict[str, float]:
    rule("STAGE 3 — 120 days of dummy prices in, outcomes out")
    random.seed(SEED)

    # A different path per name so the outcomes are not all the same story.
    drifts = {"BARGAIN": 0.0042, "PRICEY": -0.0030, "LEVERED": -0.0008}
    finals: dict[str, float] = {}
    start = datetime.now(timezone.utc) - timedelta(days=120)

    for symbol, _, price in COMPANIES:
        current = price
        path = []
        for day in range(120):
            current *= 1 + drifts[symbol] + random.uniform(-0.018, 0.018)
            path.append(current)
            service.store.record_price(
                symbol, round(current, 2),
                observed_at=(start + timedelta(days=day)).isoformat(),
                source="simulation",
            )
        finals[symbol] = round(current, 2)
        print(f"\n{symbol}")
        kv("start price", f"{price:,.2f}", 4)
        kv("end price", f"{finals[symbol]:,.2f}", 4)
        kv("path low / high", f"{min(path):,.2f} / {max(path):,.2f}", 4)
        kv("total move", f"{(finals[symbol] - price) / price:+.1%}", 4)

    # Backdate the calls so they are old enough to judge.
    with service.store.conn as conn:
        conn.execute("UPDATE recommendations SET created_at = ?", (start.isoformat(),))

    service.refresh_outcomes(finals)

    print("\n  OUTCOME PER RECOMMENDATION")
    for rec in recommendations:
        outcome = service.store.outcome(rec["id"])
        print(f"\n  {rec['symbol']} — {rec['action']} at {rec['market_price']:,.2f}")
        kv("verdict", outcome["verdict"], 6)
        kv("current price", f"{outcome['current_price']:,.2f}", 6)
        kv("holding period", f"{outcome['holding_days']} days", 6)
        kv("if followed: return", f"{outcome['absolute_return']:+.1%}", 6)
        kv("if followed: CAGR", f"{outcome['cagr']:+.1%}" if outcome["cagr"] is not None else "—", 6)
        kv("if followed: max drawdown", f"{outcome['max_drawdown']:.1%}", 6)
        kv("if ignored: gain missed", f"{outcome['gain_missed']:.1%}", 6)
        kv("if ignored: loss avoided", f"{outcome['loss_avoided']:.1%}", 6)
        kv("if ignored: capital protected", f"{outcome['capital_protected']:,.2f}", 6)
        kv("if ignored: opportunity cost", f"{outcome['opportunity_cost']:.1%}", 6)
    return finals


def stage_4_performance(service: IntelService) -> None:
    rule("STAGE 4 — outcomes in, the AI Performance dashboard out")
    report = service.performance()
    totals = report["totals"]

    print("\n  HEADLINE (per unit of capital committed, not rupees)")
    for label, key, fmt in (
        ("total recommendations", "total_recommendations", "{}"),
        ("judged / open", None, None),
        ("accuracy", "accuracy", "{:.0%}"),
        ("win rate", "win_rate", "{:.0%}"),
        ("average return", "average_return", "{:+.1%}"),
        ("wealth created", "wealth_created", "{:+.1%}"),
        ("losses avoided", "losses_avoided", "{:.1%}"),
        ("capital protected", "capital_protected", "{:,.2f}"),
        ("opportunity cost", "opportunity_cost", "{:.1%}"),
    ):
        if key is None:
            kv("judged / open", f"{totals['judged']} / {totals['open']}", 4)
            continue
        raw = totals[key]
        kv(label, "—" if raw is None else fmt.format(raw), 4)

    if totals["best"]:
        kv("best call", f"{totals['best']['symbol']} {totals['best']['action']} "
                        f"{totals['best']['absolute_return']:+.1%}", 4)
    if totals["worst"]:
        kv("worst call", f"{totals['worst']['symbol']} {totals['worst']['action']} "
                         f"{totals['worst']['absolute_return']:+.1%}", 4)

    print("\n  BY CALL TYPE")
    for action, stats in report["by_action"].items():
        kv(action, f"{stats['count']} call(s) · {stats['accuracy']:.0%} accurate · "
                   f"{stats['average_return']:+.1%} avg", 4)


def stage_5_learning(service: IntelService) -> None:
    rule("STAGE 5 — outcomes in, revised agent weights out")
    lesson = service.learn()

    print("\n  WHAT THE AI CONCLUDED")
    for review in lesson["reviews"]:
        print(f"\n  {review['symbol']} — {review['verdict']}")
        print(f"    {review['why']}")
        if review["what_worked"]:
            kv("worked", ", ".join(w["agent"] for w in review["what_worked"]), 6)
        if review["what_failed"]:
            kv("failed", ", ".join(f["agent"] for f in review["what_failed"]), 6)

    print("\n  WEIGHTS AFTER THIS ROUND")
    for weight in lesson["weights"]:
        kv(weight["agent"], f"{weight['weight']:.2f}  — {weight['rationale']}", 4)

    print("\n  SANITY: with only three judged calls every weight should still")
    print("  be at its default. Movement here would mean the loop is learning")
    print("  from a sample far too small to mean anything.")
    moved = [w for w in lesson["weights"] if w["sample_size"] >= learning.MIN_SAMPLE]
    print(f"  agents with enough history to re-weight: {len(moved)}")


def stage_6_edge_cases() -> None:
    rule("STAGE 6 — deliberately awkward input, and what comes back")
    cases = [
        ("company burning cash (negative FCF)", dummy_company(
            "BURNER", "Cash Burner", "Tech", revenue=1_000, margin=-0.20,
            growth=0.30, fcf_conv=1.0, shares=100, debt=500, cash=200,
            equity=800, beta=1.8), 25.0),
        ("company with no debt and huge cash", dummy_company(
            "FORTRESS", "Fortress Co", "IT", revenue=10_000, margin=0.25,
            growth=0.10, fcf_conv=0.95, shares=200, debt=0, cash=20_000,
            equity=30_000, beta=0.6), 100.0),
    ]
    for label, fundamentals, price in cases:
        result = value_company(fundamentals, price, provider="simulation")
        print(f"\n  {label}")
        kv("DCF", result["dcf_value"] if result["dcf_value"] is not None
           else "declined — cannot discount negative cash flow", 4)
        kv("EPV", result["epv_value"] if result["epv_value"] is not None
           else "declined — non-positive normalised earnings", 4)
        kv("intrinsic value", result["intrinsic_value"], 4)
        kv("blend rule", result["detail"]["blend"]["reason"], 4)

    print("\n  zero and empty inputs")
    empty = Fundamentals(symbol="EMPTY", name="No Filings", annuals=())
    result = value_company(empty, 100.0, provider="simulation")
    kv("intrinsic value with no financials", result["intrinsic_value"], 4)
    kv("margin of safety", result["margin_of_safety"], 4)
    print("  (None rather than 0 — an unknown value must not read as 'worthless')")

    print("\n  performance maths on a book with nothing in it")
    kv("aggregate([])", performance.aggregate([])["accuracy"], 4)
    print("  (None rather than 0% — no data is not the same as always wrong)")


def main() -> int:
    print("=" * WIDTH)
    print("TradePulse simulation — synthetic input, observable output")
    print(f"seed {SEED} · all figures are dummy data, not any real company")
    print("=" * WIDTH)

    service = IntelService(store=IntelStore(":memory:"), provider=SimProvider())

    stage_1_valuation()
    recommendations = stage_2_recommendation(service)
    stage_3_prices(service, recommendations)
    stage_4_performance(service)
    stage_5_learning(service)
    stage_6_edge_cases()

    rule("AUDIT TRAIL — nothing was overwritten")
    for symbol, _, _ in COMPANIES:
        history = service.store.recommendations(symbol)
        kv(symbol, f"{len(history)} recommendation(s) on record, "
                   f"versions {[h['version'] for h in history]}", 4)
    print("\n  A second call on a symbol appends a new version pointing at the")
    print("  one it supersedes. Re-run any stage and the history only grows.")

    rule()
    print("simulation complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())
