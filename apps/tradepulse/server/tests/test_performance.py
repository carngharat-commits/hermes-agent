"""Outcome scoring: followed vs ignored, and the book-level aggregates."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from tradepulse_server.intel.performance import (
    aggregate,
    annualised,
    by_action,
    evaluate,
    max_drawdown,
)

NOW = datetime(2026, 8, 4, tzinfo=timezone.utc)


def rec(action: str, price: float = 100.0, days_ago: int = 100, rec_id: int = 1) -> dict:
    return {
        "id": rec_id,
        "symbol": "TEST",
        "action": action,
        "market_price": price,
        "created_at": (NOW - timedelta(days=days_ago)).isoformat(),
    }


def series(prices: list[float], days_ago: int = 100) -> list[dict]:
    start = NOW - timedelta(days=days_ago)
    return [
        {"observed_at": (start + timedelta(days=i)).isoformat(), "price": p}
        for i, p in enumerate(prices)
    ]


# --- building blocks ------------------------------------------------------

def test_max_drawdown_measures_the_path_not_the_endpoints():
    """Halving then doubling still had a -50% drawdown."""
    assert max_drawdown([100, 50, 100, 200]) == -0.5


def test_max_drawdown_of_a_monotonic_rise_is_zero():
    assert max_drawdown([100, 110, 120]) == 0.0


def test_annualised_refuses_to_extrapolate_a_few_days():
    assert annualised(0.05, days=3) is None
    assert annualised(0.05, days=365) == pytest.approx(0.05, abs=0.001)


def test_annualised_handles_a_total_wipeout():
    assert annualised(-1.0, days=365) is None


# --- followed outcomes ----------------------------------------------------

def test_a_buy_that_rose_returns_the_move():
    out = evaluate(rec("BUY"), series([100, 120]), current_price=120, now=NOW)
    assert out["absolute_return"] == 0.2
    assert out["verdict"] == "CORRECT"


def test_a_buy_that_fell_is_marked_incorrect():
    out = evaluate(rec("BUY"), series([100, 80]), current_price=80, now=NOW)
    assert out["absolute_return"] == -0.2
    assert out["verdict"] == "INCORRECT"


def test_acting_on_a_sell_earns_the_inverse_of_the_move():
    """Following a SELL means being out of it — a fall is a win."""
    out = evaluate(rec("SELL"), series([100, 70]), current_price=70, now=NOW)
    assert out["absolute_return"] == 0.3
    assert out["verdict"] == "CORRECT"


def test_a_sell_on_a_stock_that_then_rose_is_incorrect():
    out = evaluate(rec("SELL"), series([100, 130]), current_price=130, now=NOW)
    assert out["absolute_return"] == -0.3
    assert out["verdict"] == "INCORRECT"


def test_hold_is_judged_on_the_position_not_moving_much():
    assert evaluate(rec("HOLD"), series([100, 104]), current_price=104, now=NOW)["verdict"] == "CORRECT"
    assert evaluate(rec("HOLD"), series([100, 140]), current_price=140, now=NOW)["verdict"] == "INCORRECT"


def test_drawdown_comes_from_the_marks_between_then_and_now():
    out = evaluate(rec("BUY"), series([100, 60, 130]), current_price=130, now=NOW)
    assert out["max_drawdown"] == -0.4
    assert out["absolute_return"] == 0.3


def test_a_call_younger_than_a_week_stays_open():
    out = evaluate(rec("BUY", days_ago=2), series([100, 115], days_ago=2),
                   current_price=115, now=NOW)
    assert out["verdict"] == "OPEN"
    assert out["cagr"] is None


def test_evaluation_survives_having_no_price_marks():
    out = evaluate(rec("BUY"), [], current_price=None, now=NOW)
    assert out["current_price"] == 100.0
    assert out["absolute_return"] == 0.0


# --- ignored outcomes -----------------------------------------------------

def test_ignoring_a_buy_that_rose_is_a_missed_gain():
    out = evaluate(rec("BUY"), series([100, 150]), current_price=150, now=NOW)
    assert out["gain_missed"] == 0.5
    assert out["loss_avoided"] == 0.0


def test_ignoring_a_buy_that_fell_avoided_the_loss():
    out = evaluate(rec("BUY"), series([100, 75]), current_price=75, now=NOW)
    assert out["loss_avoided"] == 0.25
    assert out["gain_missed"] == 0.0


def test_gain_missed_and_loss_avoided_are_mutually_exclusive():
    """So summing across a book never double-counts."""
    for prices in ([100, 150], [100, 75], [100, 100]):
        out = evaluate(rec("BUY"), series(prices), current_price=prices[-1], now=NOW)
        assert out["gain_missed"] == 0.0 or out["loss_avoided"] == 0.0


def test_a_followed_sell_on_a_falling_stock_protects_capital():
    out = evaluate(rec("SELL", price=200.0), series([200, 150]), current_price=150, now=NOW)
    assert out["loss_avoided"] == 0.25
    assert out["capital_protected"] == pytest.approx(50.0)


def test_opportunity_cost_is_only_charged_when_the_call_was_right():
    right = evaluate(rec("BUY"), series([100, 130]), current_price=130, now=NOW)
    wrong = evaluate(rec("BUY"), series([100, 70]), current_price=70, now=NOW)
    assert right["opportunity_cost"] == 0.3
    assert wrong["opportunity_cost"] == 0.0


# --- aggregates -----------------------------------------------------------

def book() -> list[dict]:
    return [
        {**evaluate(rec("BUY", rec_id=1), series([100, 130]), 130, now=NOW),
         "symbol": "A", "action": "BUY"},
        {**evaluate(rec("BUY", rec_id=2), series([100, 80]), 80, now=NOW),
         "symbol": "B", "action": "BUY"},
        {**evaluate(rec("SELL", rec_id=3), series([100, 60]), 60, now=NOW),
         "symbol": "C", "action": "SELL"},
        {**evaluate(rec("BUY", rec_id=4, days_ago=2), series([100, 105], 2), 105, now=NOW),
         "symbol": "D", "action": "BUY"},
    ]


def test_aggregate_separates_judged_from_open():
    totals = aggregate(book())
    assert totals["total_recommendations"] == 4
    assert totals["judged"] == 3
    assert totals["open"] == 1


def test_accuracy_counts_only_judged_calls():
    """Two of three judged calls were right."""
    assert aggregate(book())["accuracy"] == pytest.approx(2 / 3, abs=0.001)


def test_wealth_created_sums_only_the_winners():
    """+0.30 from the BUY and +0.40 from the SELL; the -0.20 loser is excluded."""
    assert aggregate(book())["wealth_created"] == pytest.approx(0.7, abs=0.001)


def test_best_and_worst_are_identified():
    totals = aggregate(book())
    assert totals["best"]["symbol"] == "C"       # +30% from the SELL
    assert totals["worst"]["symbol"] == "B"      # -20% from the failed BUY


def test_aggregate_of_an_empty_book_does_not_divide_by_zero():
    totals = aggregate([])
    assert totals["accuracy"] is None
    assert totals["wealth_created"] == 0.0


def test_by_action_splits_accuracy_per_call_type():
    split = by_action(book())
    assert split["BUY"]["count"] == 2
    assert split["BUY"]["accuracy"] == 0.5
    assert split["SELL"]["accuracy"] == 1.0
