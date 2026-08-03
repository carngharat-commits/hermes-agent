"""Kite payload -> UI shape. Fixtures follow the field set Kite documents."""

from __future__ import annotations

from tradepulse_server.mapping import (
    map_gtts,
    map_holdings,
    map_margins,
    map_orders,
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


# --- orders ---------------------------------------------------------------

ORDER = {
    "order_id": "260731000000001",
    "status": "COMPLETE",
    "tradingsymbol": "RELIANCE",
    "exchange": "NSE",
    "transaction_type": "BUY",
    "order_type": "LIMIT",
    "product": "CNC",
    "price": 1200.00,
    "average_price": 1198.75,
    "quantity": 10,
    "order_timestamp": "2026-07-29 09:32:11",
    "status_message": None,
}


def test_order_maps_to_the_ui_row_shape():
    [row] = map_orders([ORDER])
    assert row == {
        "id": "260731000000001",
        "sym": "RELIANCE",
        "side": "BUY",
        "type": "CNC",
        "qty": 10.0,
        "price": 1198.75,  # filled average, not the limit price
        "status": "EXECUTED",
        "broker": "Zerodha",
        "when": "2026-07-29 09:32:11",
        "segment": "IN",
        "reason": "",
        "kiteStatus": "COMPLETE",
    }


def test_unfilled_order_shows_the_limit_price():
    [row] = map_orders([{**ORDER, "status": "OPEN", "average_price": 0.0}])
    assert row["price"] == 1200.00
    assert row["status"] == "PENDING"


def test_in_flight_kite_statuses_all_read_as_pending():
    for raw in ("OPEN", "TRIGGER PENDING", "VALIDATION PENDING", "PUT ORDER REQ RECEIVED"):
        [row] = map_orders([{**ORDER, "status": raw}])
        assert row["status"] == "PENDING", raw
        assert row["kiteStatus"] == raw  # the real state is still available


def test_terminal_statuses_are_distinguished():
    assert map_orders([{**ORDER, "status": "REJECTED"}])[0]["status"] == "REJECTED"
    assert map_orders([{**ORDER, "status": "CANCELLED"}])[0]["status"] == "CANCELLED"


def test_rejection_reason_is_carried_through():
    [row] = map_orders([
        {**ORDER, "status": "REJECTED", "status_message": "Insufficient margin"}
    ])
    assert row["reason"] == "Insufficient margin"


def test_orders_come_back_newest_first():
    rows = map_orders([
        {**ORDER, "order_id": "1", "order_timestamp": "2026-07-01 10:00:00"},
        {**ORDER, "order_id": "2", "order_timestamp": "2026-07-31 10:00:00"},
    ])
    assert [r["id"] for r in rows] == ["2", "1"]


# --- GTT ------------------------------------------------------------------

def test_single_leg_gtt_maps_to_one_row():
    [row] = map_gtts([{
        "id": 901001,
        "type": "single",
        "status": "active",
        "created_at": "2026-07-15 10:02:00",
        "condition": {"tradingsymbol": "RELIANCE", "trigger_values": [1400.0]},
        "orders": [{"transaction_type": "SELL", "order_type": "LIMIT", "quantity": 10}],
    }])
    assert row["id"] == "901001"
    assert row["sym"] == "RELIANCE"
    assert row["trigger"] == 1400.0
    assert row["action"] == "SELL"
    assert row["qty"] == 10.0
    assert row["status"] == "ACTIVE"
    assert row["created"] == "2026-07-15"
    assert row["note"] == "single · LIMIT"


def test_two_leg_gtt_splits_into_a_row_per_leg_with_unique_ids():
    rows = map_gtts([{
        "id": 901002,
        "type": "two-leg",
        "status": "active",
        "created_at": "2026-07-22 14:41:00",
        "condition": {"tradingsymbol": "TATASTEEL", "trigger_values": [160.0, 230.0]},
        "orders": [
            {"transaction_type": "SELL", "order_type": "LIMIT", "quantity": 100},
            {"transaction_type": "SELL", "order_type": "LIMIT", "quantity": 100},
        ],
    }])
    assert [r["trigger"] for r in rows] == [160.0, 230.0]
    assert [r["id"] for r in rows] == ["901002-1", "901002-2"]  # React keys stay unique


def test_gtt_with_no_legs_yields_nothing():
    assert map_gtts([{"id": 1, "condition": {"tradingsymbol": "X"}, "orders": []}]) == []
    assert map_gtts(None) == []
