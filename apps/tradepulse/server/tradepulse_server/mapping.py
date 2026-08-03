"""Translate Kite Connect payloads into the shapes the TradePulse UI reads.

The UI's holding shape comes from ``src/data/holdings.ts``::

    { sym, qty, avg, ltp, dayPct, broker, segment, isin?, pledged? }

Kite speaks a different vocabulary, and a few of the gaps need a decision
rather than a rename — those are called out inline. Everything here is pure:
dicts in, dicts out, no network, no config.
"""

from __future__ import annotations

from typing import Any, Iterable

BROKER = "Zerodha"
SEGMENT_EQUITY = "IN"


def _num(value: Any, default: float = 0.0) -> float:
    """Kite sends numbers as numbers, but a missing key must not crash a sync."""
    if isinstance(value, bool) or value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def map_holding(row: dict[str, Any]) -> dict[str, Any]:
    """One row of ``GET /portfolio/holdings``.

    Two judgement calls:

    * ``qty`` sums ``quantity`` and ``t1_quantity``. T1 stock is bought and
      paid for but still in settlement; the UI's notion of "what I own"
      includes it, and leaving it out makes a portfolio shrink for a day after
      every buy.
    * ``pledged`` is ``collateral_quantity > 0``. Kite reports pledging as a
      quantity split, not a flag, so any collateralised quantity marks the
      whole row — same granularity the UI's ABML rows already use.
    """
    quantity = _num(row.get("quantity")) + _num(row.get("t1_quantity"))
    return {
        "sym": row.get("tradingsymbol", ""),
        "qty": quantity,
        "avg": _num(row.get("average_price")),
        "ltp": _num(row.get("last_price")),
        "dayPct": _num(row.get("day_change_percentage")),
        "broker": BROKER,
        "segment": SEGMENT_EQUITY,
        "isin": row.get("isin", ""),
        "pledged": _num(row.get("collateral_quantity")) > 0,
        "exchange": row.get("exchange", ""),
    }


def map_holdings(rows: Iterable[dict[str, Any]] | None) -> list[dict[str, Any]]:
    """All holdings, dropping zero-quantity rows Kite keeps around post-exit."""
    mapped = [map_holding(row) for row in rows or []]
    return [h for h in mapped if h["sym"] and h["qty"] > 0]


def map_position(row: dict[str, Any]) -> dict[str, Any]:
    """One row of ``GET /portfolio/positions`` (the ``net`` bucket).

    Positions are not holdings: they can be short (negative quantity), they
    carry a product type (MIS/NRML/CNC), and they settle intraday. The UI has
    no positions surface yet, so this stays a flat normalized row rather than
    being forced into the holding shape.
    """
    return {
        "sym": row.get("tradingsymbol", ""),
        "exchange": row.get("exchange", ""),
        "product": row.get("product", ""),
        "qty": _num(row.get("quantity")),
        "avg": _num(row.get("average_price")),
        "ltp": _num(row.get("last_price")),
        "pnl": _num(row.get("pnl")),
        "dayPct": _num(row.get("day_change_percentage")),
        "broker": BROKER,
    }


def map_positions(payload: dict[str, Any] | None) -> list[dict[str, Any]]:
    """``/portfolio/positions`` returns ``{"net": [...], "day": [...]}``.

    ``net`` is the one that answers "what am I holding right now"; ``day`` is
    the intraday delta and would double-count against it.
    """
    rows = (payload or {}).get("net") or []
    mapped = [map_position(row) for row in rows]
    return [p for p in mapped if p["sym"] and p["qty"] != 0]


def map_margins(payload: dict[str, Any] | None) -> dict[str, Any]:
    """``GET /user/margins`` -> the two numbers the UI would show.

    ``available.live_balance`` is the spendable figure; ``net`` is what Kite
    itself shows as the margin available after utilised amounts.
    """
    payload = payload or {}
    out: dict[str, Any] = {}
    for bucket in ("equity", "commodity"):
        segment = payload.get(bucket) or {}
        if not segment:  # bucket absent entirely; a disabled one still reports
            continue
        available = segment.get("available") or {}
        out[bucket] = {
            "enabled": bool(segment.get("enabled", False)),
            "net": _num(segment.get("net")),
            "live_balance": _num(available.get("live_balance")),
            "cash": _num(available.get("cash")),
        }
    return out


# Kite reports a dozen order states; the UI's order row understands three
# (plus a catch-all that renders red). Anything still in flight is PENDING.
_TERMINAL_STATUS = {
    "COMPLETE": "EXECUTED",
    "REJECTED": "REJECTED",
    "CANCELLED": "CANCELLED",
}


def map_order(row: dict[str, Any]) -> dict[str, Any]:
    """One row of ``GET /orders``.

    ``price`` is the filled average where there is one: an executed order's
    limit price is what was asked, and ``average_price`` is what was paid.
    Showing the ask on a filled order would misreport the book.
    """
    raw_status = (row.get("status") or "").upper()
    average = _num(row.get("average_price"))
    return {
        "id": str(row.get("order_id", "")),
        "sym": row.get("tradingsymbol", ""),
        "side": row.get("transaction_type", ""),
        "type": row.get("product", ""),
        "qty": _num(row.get("quantity")),
        "price": average if average > 0 else _num(row.get("price")),
        "status": _TERMINAL_STATUS.get(raw_status, "PENDING"),
        "broker": BROKER,
        "when": row.get("order_timestamp", "") or "",
        "segment": SEGMENT_EQUITY,
        "reason": row.get("status_message") or "",
        "kiteStatus": raw_status,
    }


def map_orders(rows: Iterable[dict[str, Any]] | None) -> list[dict[str, Any]]:
    """Newest first, matching how the UI's order book is ordered."""
    mapped = [map_order(row) for row in rows or [] if row.get("tradingsymbol")]
    return sorted(mapped, key=lambda o: o["when"], reverse=True)


def map_gtt(trigger: dict[str, Any]) -> list[dict[str, Any]]:
    """One GTT -> one row per leg.

    A two-leg GTT (stop-loss + target) carries two trigger values and two
    orders. The UI's row is single-trigger, and the bundled snapshot already
    represents such a pair as two rows, so split rather than collapse.
    """
    condition = trigger.get("condition") or {}
    legs = trigger.get("orders") or []
    values = condition.get("trigger_values") or []
    status = (trigger.get("status") or "").upper()
    created = (trigger.get("created_at") or "").split(" ")[0]
    gtt_id = trigger.get("id", "")
    kind = trigger.get("type", "")

    rows: list[dict[str, Any]] = []
    for index, leg in enumerate(legs):
        value = values[index] if index < len(values) else (values[0] if values else 0)
        rows.append({
            # Legs of one trigger share a Kite id; suffix so React keys stay unique.
            "id": f"{gtt_id}" if len(legs) == 1 else f"{gtt_id}-{index + 1}",
            "sym": condition.get("tradingsymbol", "") or leg.get("tradingsymbol", ""),
            "trigger": _num(value),
            "action": leg.get("transaction_type", ""),
            "qty": _num(leg.get("quantity")),
            "status": status,
            "broker": BROKER,
            "created": created,
            # No free-text note exists on a Kite GTT; say what it actually is.
            "note": " · ".join(x for x in (kind, leg.get("order_type", "")) if x),
        })
    return rows


def map_gtts(triggers: Iterable[dict[str, Any]] | None) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for trigger in triggers or []:
        rows.extend(map_gtt(trigger))
    return [r for r in rows if r["sym"]]


def summarize(holdings: list[dict[str, Any]]) -> dict[str, Any]:
    """Totals the UI would otherwise recompute, so the two agree."""
    current = sum(h["qty"] * h["ltp"] for h in holdings)
    invested = sum(h["qty"] * h["avg"] for h in holdings)
    return {
        "count": len(holdings),
        "current_value": round(current, 2),
        "invested_value": round(invested, 2),
        "pnl": round(current - invested, 2),
        "pnl_pct": round((current - invested) / invested * 100, 4) if invested else 0.0,
    }
