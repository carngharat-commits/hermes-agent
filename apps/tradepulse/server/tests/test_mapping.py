"""Kite payload -> UI shape. Fixtures follow the field set Kite documents."""

from __future__ import annotations

from tradepulse_server.mapping import (
    map_holdings,
    map_margins,
    map_positions,
    summarize,
)

HOLDING = {
    "tradingsymbol": "RELIANCE",
    "exchange": "NSE",
    "instrument_token": 738561,
    "isin": "INE002A01018",
    "product": "CNC",
    "price": 0,
    "quantity": 8,
    "used_quantity": 0,
    "t1_quantity": 0,
    "realised_quantity": 8,
    "authorised_quantity": 0,
    "opening_quantity": 8,
    "collateral_quantity": 0,
    "collateral_type": "",
    "discrepancy": False,
    "average_price": 1283.21,
    "last_price": 1275.90,
    "close_price": 1267.65,
    "pnl": -58.48,
    "day_change": 8.25,
    "day_change_percentage": 0.65,
}


def test_maps_the_ui_holding_shape():
    [row] = map_holdings([HOLDING])
    assert row == {
        "sym": "RELIANCE",
        "qty": 8.0,
        "avg": 1283.21,
        "ltp": 1275.90,
        "dayPct": 0.65,
        "broker": "Zerodha",
        "segment": "IN",
        "isin": "INE002A01018",
        "pledged": False,
        "exchange": "NSE",
    }


def test_t1_quantity_counts_as_owned():
    [row] = map_holdings([{**HOLDING, "quantity": 8, "t1_quantity": 4}])
    assert row["qty"] == 12.0


def test_collateral_quantity_marks_a_row_pledged():
    [row] = map_holdings([{**HOLDING, "collateral_quantity": 5}])
    assert row["pledged"] is True


def test_fully_exited_rows_are_dropped():
    assert map_holdings([{**HOLDING, "quantity": 0, "t1_quantity": 0}]) == []


def test_missing_numbers_do_not_crash_a_sync():
    [row] = map_holdings([{"tradingsymbol": "X", "quantity": 1}])
    assert row["avg"] == 0.0
    assert row["ltp"] == 0.0
    assert row["dayPct"] == 0.0


def test_empty_and_absent_payloads():
    assert map_holdings(None) == []
    assert map_holdings([]) == []
    assert map_positions(None) == []
    assert map_margins(None) == {}


def test_positions_read_the_net_bucket_not_day():
    payload = {
        "net": [
            {
                "tradingsymbol": "NIFTY24AUGFUT",
                "exchange": "NFO",
                "product": "NRML",
                "quantity": -50,
                "average_price": 24800.0,
                "last_price": 24750.0,
                "pnl": 2500.0,
                "day_change_percentage": -0.2,
            }
        ],
        "day": [{"tradingsymbol": "SHOULD-NOT-APPEAR", "quantity": 1}],
    }
    [row] = map_positions(payload)
    assert row["sym"] == "NIFTY24AUGFUT"
    assert row["qty"] == -50.0  # shorts survive
    assert row["product"] == "NRML"


def test_closed_positions_are_dropped():
    assert map_positions({"net": [{"tradingsymbol": "X", "quantity": 0}]}) == []


def test_margins_pick_out_the_two_useful_numbers():
    payload = {
        "equity": {
            "enabled": True,
            "net": 41000.5,
            "available": {"live_balance": 41000.5, "cash": 40000.0, "collateral": 0},
            "utilised": {"debits": 0},
        },
        "commodity": {"enabled": False, "net": 0, "available": {}},
    }
    assert map_margins(payload) == {
        "equity": {
            "enabled": True,
            "net": 41000.5,
            "live_balance": 41000.5,
            "cash": 40000.0,
        },
        "commodity": {"enabled": False, "net": 0.0, "live_balance": 0.0, "cash": 0.0},
    }


def test_summary_totals_match_the_rows():
    holdings = map_holdings([HOLDING, {**HOLDING, "tradingsymbol": "TCS",
                                       "quantity": 2, "average_price": 100.0,
                                       "last_price": 150.0}])
    summary = summarize(holdings)
    assert summary["count"] == 2
    assert summary["current_value"] == round(8 * 1275.90 + 2 * 150.0, 2)
    assert summary["invested_value"] == round(8 * 1283.21 + 2 * 100.0, 2)
    assert summary["pnl"] == round(
        summary["current_value"] - summary["invested_value"], 2
    )


def test_summary_of_nothing_does_not_divide_by_zero():
    assert summarize([]) == {
        "count": 0,
        "current_value": 0,
        "invested_value": 0,
        "pnl": 0,
        "pnl_pct": 0.0,
    }
