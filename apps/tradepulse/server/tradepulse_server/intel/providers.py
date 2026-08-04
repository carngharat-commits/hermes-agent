"""Where financial statements come from.

Kite Connect does not serve fundamentals — it has quotes, holdings, orders and
candles, and nothing else. Alpha Spread, named in the spec, publishes no public
API. So intrinsic value needs a third-party fundamentals feed (EODHD, Financial
Modeling Prep and Trendlyne all cover Indian equities on paid plans).

Rather than block on credentials, the engine computes against this interface
and ships with a stub. Swapping in a real feed means writing one adapter and
setting keys — the valuation maths, the store, and every screen above it stay
untouched.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from typing import Protocol


@dataclass(frozen=True)
class AnnualFinancials:
    """One fiscal year, in the currency the stock trades in."""

    period_end: str          # ISO date, fiscal year end
    revenue: float
    net_income: float
    operating_income: float
    free_cash_flow: float
    total_debt: float
    cash: float
    total_equity: float
    total_assets: float
    shares_outstanding: float


@dataclass(frozen=True)
class Fundamentals:
    """Everything the valuation engine needs about one company."""

    symbol: str
    name: str
    currency: str = "INR"
    sector: str = ""
    # Oldest first. The engine needs several years to see a trend.
    annuals: tuple[AnnualFinancials, ...] = field(default_factory=tuple)
    beta: float = 1.0
    # Cost of equity input; falls back to the engine default when unset.
    risk_free_rate: float | None = None

    def fingerprint(self) -> str:
        """Stable hash of the inputs, so an unchanged refresh is a no-op."""
        payload = json.dumps(asdict(self), sort_keys=True, default=str)
        return hashlib.sha256(payload.encode()).hexdigest()[:32]

    @property
    def latest(self) -> AnnualFinancials | None:
        return self.annuals[-1] if self.annuals else None


class FundamentalsProvider(Protocol):
    """Source of financial statements."""

    name: str

    def fetch(self, symbol: str) -> Fundamentals | None:
        """Return the company's financials, or None if not covered."""
        ...

    def covered(self) -> list[str]:
        """Symbols this provider can answer for."""
        ...


class StubFundamentalsProvider:
    """Hand-built financials for a handful of symbols in the demo book.

    Numbers are plausible in shape and scale but are NOT the real filings — the
    point is to exercise the engine end to end, and every response derived from
    them is tagged ``provider: "stub"`` so the UI can say so. Wire a real
    provider before treating any of this as a valuation.
    """

    name = "stub"

    def __init__(self) -> None:
        self._data = {f.symbol: f for f in _STUB_COMPANIES}

    def fetch(self, symbol: str) -> Fundamentals | None:
        return self._data.get(symbol.upper())

    def covered(self) -> list[str]:
        return sorted(self._data)


def _years(
    start_revenue: float,
    growth: float,
    margin: float,
    fcf_conversion: float,
    shares: float,
    debt: float,
    cash: float,
    equity: float,
    *,
    count: int = 5,
    first_year: int = 2022,
) -> tuple[AnnualFinancials, ...]:
    """Build a compounding series so the trend lines have something to show."""
    out = []
    revenue = start_revenue
    for index in range(count):
        net = revenue * margin
        out.append(AnnualFinancials(
            period_end=f"{first_year + index}-03-31",
            revenue=round(revenue, 2),
            net_income=round(net, 2),
            operating_income=round(net * 1.35, 2),
            free_cash_flow=round(net * fcf_conversion, 2),
            total_debt=round(debt * (1 + 0.03 * index), 2),
            cash=round(cash * (1 + 0.08 * index), 2),
            total_equity=round(equity * (1 + 0.11 * index), 2),
            total_assets=round(equity * 2.4 * (1 + 0.09 * index), 2),
            shares_outstanding=shares,
        ))
        revenue *= 1 + growth
    return tuple(out)


# Figures in crore (₹ 10M) except share counts, which are in crore of shares.
_STUB_COMPANIES = [
    Fundamentals(
        symbol="RELIANCE", name="Reliance Industries", sector="Energy", beta=1.05,
        annuals=_years(792000, 0.085, 0.081, 0.62, 1353, 320000, 190000, 780000),
    ),
    Fundamentals(
        symbol="TCS", name="Tata Consultancy Services", sector="IT", beta=0.78,
        annuals=_years(225000, 0.072, 0.192, 0.88, 362, 8500, 52000, 95000),
    ),
    Fundamentals(
        symbol="AXISBANK", name="Axis Bank", sector="Banking", beta=1.18,
        annuals=_years(112000, 0.128, 0.215, 0.55, 308, 195000, 88000, 152000),
    ),
    Fundamentals(
        symbol="TATASTEEL", name="Tata Steel", sector="Metals", beta=1.42,
        annuals=_years(243000, 0.041, 0.038, 0.71, 1248, 88000, 21000, 92000),
    ),
    Fundamentals(
        symbol="BHEL", name="Bharat Heavy Electricals", sector="Industrials", beta=1.31,
        annuals=_years(23400, 0.152, 0.031, 0.44, 348, 4200, 8100, 27500),
    ),
    Fundamentals(
        symbol="IRCTC", name="IRCTC", sector="Services", beta=1.09,
        annuals=_years(4270, 0.115, 0.268, 0.91, 80, 120, 2400, 4100),
    ),
    Fundamentals(
        symbol="CANBK", name="Canara Bank", sector="Banking", beta=1.24,
        annuals=_years(102000, 0.096, 0.148, 0.51, 907, 168000, 74000, 88000),
    ),
    Fundamentals(
        symbol="TITAN", name="Titan Company", sector="Consumer", beta=0.95,
        annuals=_years(40600, 0.168, 0.078, 0.68, 89, 3900, 2200, 14800),
    ),
]
