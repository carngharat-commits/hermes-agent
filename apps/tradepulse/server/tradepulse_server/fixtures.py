"""Kite-shaped payloads for the credential-free stub.

These exist so the whole live path — fetch, map, merge, render — can be driven
without a Zerodha developer app. The values are deliberately implausible as a
real book (five rows, round numbers) and every response that carries them is
tagged ``mode: "stub"`` so nothing downstream can mistake them for an account.
"""

from __future__ import annotations

from typing import Any


def _holding(
    symbol: str,
    isin: str,
    qty: int,
    avg: float,
    ltp: float,
    day_pct: float,
    *,
    t1: int = 0,
    collateral: int = 0,
) -> dict[str, Any]:
    return {
        "tradingsymbol": symbol,
        "exchange": "NSE",
        "isin": isin,
        "product": "CNC",
        "quantity": qty,
        "t1_quantity": t1,
        "realised_quantity": qty,
        "collateral_quantity": collateral,
        "average_price": avg,
        "last_price": ltp,
        "close_price": round(ltp / (1 + day_pct / 100), 2),
        "pnl": round(qty * (ltp - avg), 2),
        "day_change_percentage": day_pct,
    }


STUB_HOLDINGS: list[dict[str, Any]] = [
    _holding("RELIANCE", "INE002A01018", 10, 1200.00, 1275.90, 0.65),
    _holding("TCS", "INE467B01029", 5, 2000.00, 2034.05, -0.40),
    _holding("AXISBANK", "INE238A01034", 20, 1100.00, 1235.40, 0.97, t1=5),
    _holding("TATASTEEL", "INE081A01020", 100, 190.00, 187.27, 2.54, collateral=40),
    # Fully exited — proves the mapper drops these rather than showing a zero row.
    _holding("YESBANK", "INE528G01035", 0, 20.88, 22.84, 0.13),
]

STUB_POSITIONS: dict[str, Any] = {
    "net": [
        {
            "tradingsymbol": "NIFTY26AUGFUT",
            "exchange": "NFO",
            "product": "NRML",
            "quantity": -50,
            "average_price": 24800.00,
            "last_price": 24750.00,
            "pnl": 2500.00,
            "day_change_percentage": -0.20,
        }
    ],
    "day": [],
}

STUB_MARGINS: dict[str, Any] = {
    "equity": {
        "enabled": True,
        "net": 41000.50,
        "available": {"live_balance": 41000.50, "cash": 40000.00, "collateral": 1000.50},
        "utilised": {"debits": 0},
    },
    "commodity": {"enabled": False, "net": 0, "available": {}},
}

BY_PATH: dict[str, Any] = {
    "/portfolio/holdings": STUB_HOLDINGS,
    "/portfolio/positions": STUB_POSITIONS,
    "/user/margins": STUB_MARGINS,
}
