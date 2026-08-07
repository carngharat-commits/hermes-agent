"""Intrinsic value: DCF, Earnings Power Value, and the quality scores.

Two independent estimates, deliberately:

* **DCF** projects free cash flow and discounts it. It rewards growth, and it
  is only as good as the growth assumption — small changes in the terminal
  rate move it a lot, which is why the assumptions travel with the answer.
* **EPV** (Greenwald) ignores growth entirely and capitalises current earning
  power. It is the sober floor: what the business is worth if it never grows
  again.

Intrinsic value blends them, weighted toward EPV when the two disagree
sharply — a wide spread means the DCF is carrying most of the value in
assumptions, and that deserves less confidence, not more.

Everything here is pure. Inputs in, numbers out, no I/O.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .providers import AnnualFinancials, Fundamentals

# Defaults for Indian equities. Overridable per call so a real provider's
# figures can drive them later.
DEFAULT_RISK_FREE = 0.068          # ~10Y GSec
DEFAULT_EQUITY_PREMIUM = 0.055
DEFAULT_TERMINAL_GROWTH = 0.035    # below long-run nominal GDP, on purpose
DEFAULT_TAX_RATE = 0.25
PROJECTION_YEARS = 10
ENGINE_VERSION = "valuation-0.1.0"

# Below this the DCF is doing too much of the work to trust the blend.
WIDE_SPREAD = 0.60


def cost_of_equity(
    beta: float,
    risk_free: float = DEFAULT_RISK_FREE,
    premium: float = DEFAULT_EQUITY_PREMIUM,
) -> float:
    """CAPM, floored so a low-beta name can't discount at less than the risk-free rate."""
    return max(risk_free + beta * premium, risk_free + 0.01)


def cagr(first: float, last: float, years: float) -> float | None:
    """Compound growth. Undefined when the start is non-positive."""
    if first <= 0 or years <= 0 or last <= 0:
        return None
    return (last / first) ** (1 / years) - 1


def historical_growth(annuals: tuple[AnnualFinancials, ...]) -> float | None:
    if len(annuals) < 2:
        return None
    span = len(annuals) - 1
    return cagr(annuals[0].revenue, annuals[-1].revenue, span)


def _fade(start: float, terminal: float, year: int, total: int) -> float:
    """Linearly fade the growth rate toward terminal over the projection.

    A flat rate for ten years then a cliff to terminal is the classic way to
    make a DCF say whatever you want; fading is both more defensible and less
    sensitive to the starting estimate.
    """
    if total <= 1:
        return terminal
    weight = (year - 1) / (total - 1)
    return start + (terminal - start) * weight


def dcf_value(
    fundamentals: Fundamentals,
    *,
    discount_rate: float | None = None,
    terminal_growth: float = DEFAULT_TERMINAL_GROWTH,
    years: int = PROJECTION_YEARS,
) -> dict[str, Any] | None:
    """Per-share DCF on free cash flow, with the assumptions attached."""
    latest = fundamentals.latest
    if latest is None or latest.shares_outstanding <= 0:
        return None
    if latest.free_cash_flow <= 0:
        # A negative-FCF business cannot be discounted into a meaningful
        # number; say so rather than emit a confident-looking zero.
        return None

    rate = discount_rate or cost_of_equity(
        fundamentals.beta, fundamentals.risk_free_rate or DEFAULT_RISK_FREE
    )
    if rate <= terminal_growth:
        # Gordon growth diverges; hold the discount rate above terminal.
        rate = terminal_growth + 0.02

    observed = historical_growth(fundamentals.annuals)
    # Cap the starting growth: a company recently compounding at 40% will not
    # do it for a decade, and an uncapped DCF happily assumes it will.
    start_growth = min(observed if observed is not None else terminal_growth, 0.18)
    start_growth = max(start_growth, terminal_growth)

    cash_flow = latest.free_cash_flow
    present_value = 0.0
    projection = []
    for year in range(1, years + 1):
        growth = _fade(start_growth, terminal_growth, year, years)
        cash_flow *= 1 + growth
        discounted = cash_flow / ((1 + rate) ** year)
        present_value += discounted
        projection.append({
            "year": year,
            "growth": round(growth, 4),
            "free_cash_flow": round(cash_flow, 2),
            "discounted": round(discounted, 2),
        })

    terminal_value = cash_flow * (1 + terminal_growth) / (rate - terminal_growth)
    discounted_terminal = terminal_value / ((1 + rate) ** years)

    enterprise = present_value + discounted_terminal
    equity_value = enterprise - latest.total_debt + latest.cash
    per_share = equity_value / latest.shares_outstanding

    return {
        "value_per_share": round(per_share, 2),
        "equity_value": round(equity_value, 2),
        "enterprise_value": round(enterprise, 2),
        "assumptions": {
            "discount_rate": round(rate, 4),
            "starting_growth": round(start_growth, 4),
            "terminal_growth": terminal_growth,
            "years": years,
            "observed_revenue_cagr": round(observed, 4) if observed is not None else None,
        },
        # The terminal value's share of the total. Above ~75% the answer is
        # mostly an assumption about year 11 onward.
        "terminal_share": round(discounted_terminal / enterprise, 4) if enterprise else None,
        "projection": projection,
    }


def epv_value(
    fundamentals: Fundamentals,
    *,
    discount_rate: float | None = None,
    tax_rate: float = DEFAULT_TAX_RATE,
) -> dict[str, Any] | None:
    """Greenwald Earnings Power Value: normalised earnings / cost of capital.

    Earnings are averaged across the available years to take out the cycle,
    which is the whole point — a steel company's peak year is not its earning
    power.
    """
    latest = fundamentals.latest
    if latest is None or latest.shares_outstanding <= 0 or not fundamentals.annuals:
        return None

    rate = discount_rate or cost_of_equity(
        fundamentals.beta, fundamentals.risk_free_rate or DEFAULT_RISK_FREE
    )
    operating = [a.operating_income for a in fundamentals.annuals]
    normalised = sum(operating) / len(operating)
    after_tax = normalised * (1 - tax_rate)
    if after_tax <= 0:
        return None

    enterprise = after_tax / rate
    equity_value = enterprise - latest.total_debt + latest.cash
    per_share = equity_value / latest.shares_outstanding

    return {
        "value_per_share": round(per_share, 2),
        "normalised_operating_income": round(normalised, 2),
        "after_tax_earnings": round(after_tax, 2),
        "assumptions": {
            "discount_rate": round(rate, 4),
            "tax_rate": tax_rate,
            "years_averaged": len(operating),
        },
    }


def financial_health(fundamentals: Fundamentals) -> dict[str, Any]:
    """0-100 from leverage, liquidity, cash conversion and equity growth."""
    latest = fundamentals.latest
    if latest is None:
        return {"score": 0.0, "components": {}}

    components: dict[str, float] = {}

    # Net debt to equity: 0 or less is ideal, above 2x is stressed.
    net_debt = latest.total_debt - latest.cash
    if latest.total_equity > 0:
        leverage = net_debt / latest.total_equity
        components["leverage"] = _band(leverage, good=0.0, bad=2.0, invert=True)
    else:
        components["leverage"] = 0.0

    # Cash as a share of debt.
    if latest.total_debt > 0:
        components["liquidity"] = _band(latest.cash / latest.total_debt, good=1.0, bad=0.05)
    else:
        components["liquidity"] = 100.0

    # FCF conversion: how much of reported profit shows up as cash.
    if latest.net_income > 0:
        components["cash_conversion"] = _band(
            latest.free_cash_flow / latest.net_income, good=1.0, bad=0.2
        )
    else:
        components["cash_conversion"] = 0.0

    equity_growth = cagr(
        fundamentals.annuals[0].total_equity,
        latest.total_equity,
        max(len(fundamentals.annuals) - 1, 1),
    )
    components["equity_growth"] = (
        _band(equity_growth, good=0.15, bad=-0.05) if equity_growth is not None else 50.0
    )

    score = sum(components.values()) / len(components)
    return {"score": round(score, 1), "components": {k: round(v, 1) for k, v in components.items()}}


def business_quality(fundamentals: Fundamentals) -> dict[str, Any]:
    """0-100 from margins, returns on equity, growth and margin stability."""
    latest = fundamentals.latest
    if latest is None or latest.revenue <= 0:
        return {"score": 0.0, "components": {}}

    components: dict[str, float] = {}
    components["net_margin"] = _band(latest.net_income / latest.revenue, good=0.20, bad=0.02)

    if latest.total_equity > 0:
        components["return_on_equity"] = _band(
            latest.net_income / latest.total_equity, good=0.22, bad=0.05
        )
    else:
        components["return_on_equity"] = 0.0

    growth = historical_growth(fundamentals.annuals)
    components["revenue_growth"] = (
        _band(growth, good=0.18, bad=0.0) if growth is not None else 50.0
    )

    # Margin stability: a business whose margin swings is lower quality than
    # one that holds it, even at the same average.
    margins = [a.net_income / a.revenue for a in fundamentals.annuals if a.revenue > 0]
    if len(margins) >= 2:
        mean = sum(margins) / len(margins)
        spread = (sum((m - mean) ** 2 for m in margins) / len(margins)) ** 0.5
        components["margin_stability"] = _band(
            spread / abs(mean) if mean else 1.0, good=0.05, bad=0.5, invert=True
        )
    else:
        components["margin_stability"] = 50.0

    score = sum(components.values()) / len(components)
    return {"score": round(score, 1), "components": {k: round(v, 1) for k, v in components.items()}}


def _band(value: float | None, *, good: float, bad: float, invert: bool = False) -> float:
    """Map a metric onto 0-100 by where it sits between `bad` and `good`."""
    if value is None:
        return 50.0
    if invert:
        if value <= good:
            return 100.0
        if value >= bad:
            return 0.0
        return 100.0 * (bad - value) / (bad - good)
    if value >= good:
        return 100.0
    if value <= bad:
        return 0.0
    return 100.0 * (value - bad) / (good - bad)


def value(
    fundamentals: Fundamentals,
    market_price: float,
    *,
    provider: str = "stub",
) -> dict[str, Any]:
    """Full valuation for one symbol, in the store's row shape.

    `margin_of_safety` is expressed the way an investor says it out loud: 0.28
    means the price is 28% below intrinsic value. `discount_premium` is the
    signed mirror of that — negative for a discount, positive for a premium.
    """
    dcf = dcf_value(fundamentals)
    epv = epv_value(fundamentals)
    health = financial_health(fundamentals)
    quality = business_quality(fundamentals)

    dcf_per_share = dcf["value_per_share"] if dcf else None
    epv_per_share = epv["value_per_share"] if epv else None

    intrinsic, blend = _blend(dcf_per_share, epv_per_share)

    # Net debt can exceed the modelled enterprise value, which drops equity
    # value below zero. A negative per-share number must never reach a screen:
    # it reads like a price, and the quality haircut would make a *worse*
    # business look *less* negative. Clamp to zero and say why.
    if intrinsic is not None and intrinsic <= 0:
        blend = {
            **blend,
            "equity_wiped": True,
            "modelled_value_per_share": round(intrinsic, 2),
            "reason": (
                "net debt exceeds the modelled enterprise value, so the equity "
                "has no residual value on these numbers"
            ),
        }
        intrinsic = 0.0

    margin_of_safety = None
    discount_premium = None
    # Explicit None checks: a clamped 0.0 is a real answer ("the equity has
    # no modelled value"), and truthiness would silently turn it into None.
    if intrinsic is not None and intrinsic > 0 and market_price > 0:
        margin_of_safety = (intrinsic - market_price) / intrinsic
        discount_premium = (market_price - intrinsic) / intrinsic

    latest = fundamentals.latest
    return {
        "symbol": fundamentals.symbol,
        "as_of": latest.period_end if latest else "",
        "fingerprint": fundamentals.fingerprint(),
        "provider": provider,
        "intrinsic_value": round(intrinsic, 2) if intrinsic is not None else None,
        # Fair value is intrinsic haircut by quality: a fragile business is not
        # worth its model output.
        "fair_value": _fair_value(intrinsic, health["score"], quality["score"]),
        "dcf_value": dcf_per_share,
        "epv_value": epv_per_share,
        "market_price": market_price,
        "margin_of_safety": round(margin_of_safety, 4) if margin_of_safety is not None else None,
        "discount_premium": round(discount_premium, 4) if discount_premium is not None else None,
        "financial_health": health["score"],
        "business_quality": quality["score"],
        "detail": {
            "engine": ENGINE_VERSION,
            "name": fundamentals.name,
            "sector": fundamentals.sector,
            "currency": fundamentals.currency,
            "dcf": dcf,
            "epv": epv,
            "health": health,
            "quality": quality,
            "blend": blend,
        },
    }


def _blend(dcf: float | None, epv: float | None) -> tuple[float | None, dict[str, Any]]:
    """Combine the two estimates, leaning on EPV when they disagree."""
    if dcf is None and epv is None:
        return None, {"method": "none", "reason": "neither model produced a value"}
    if dcf is None:
        return epv, {"method": "epv_only", "reason": "DCF unavailable (non-positive free cash flow)"}
    if epv is None:
        return dcf, {"method": "dcf_only", "reason": "EPV unavailable (non-positive normalised earnings)"}

    spread = abs(dcf - epv) / max(dcf, epv) if max(dcf, epv) > 0 else 0.0
    if spread > WIDE_SPREAD:
        weights = (0.35, 0.65)
        reason = (
            f"estimates differ by {spread:.0%}; weighted toward EPV because the "
            "DCF is carrying most of the value in growth assumptions"
        )
    else:
        weights = (0.5, 0.5)
        reason = f"estimates agree within {spread:.0%}; weighted evenly"

    blended = dcf * weights[0] + epv * weights[1]
    return blended, {
        "method": "weighted",
        "dcf_weight": weights[0],
        "epv_weight": weights[1],
        "spread": round(spread, 4),
        "reason": reason,
    }


def _fair_value(intrinsic: float | None, health: float, quality: float) -> float | None:
    """Intrinsic value discounted for balance-sheet and franchise risk.

    A full-quality business keeps its intrinsic value; a weak one is marked
    down up to 30%. This is the number to anchor a buy decision on.
    """
    if intrinsic is None:
        return None
    haircut = 0.30 * (1 - (health / 100 * 0.5 + quality / 100 * 0.5))
    return round(intrinsic * (1 - haircut), 2)
