"""Intrinsic value engine: DCF, EPV, the blend, and the quality scores."""

from __future__ import annotations

import pytest

from tradepulse_server.intel.providers import (
    AnnualFinancials,
    Fundamentals,
    StubFundamentalsProvider,
)
from tradepulse_server.intel.valuation import (
    _band,
    business_quality,
    cost_of_equity,
    dcf_value,
    epv_value,
    financial_health,
    historical_growth,
    value,
)


def make(**overrides) -> Fundamentals:
    base = dict(
        revenue=1000.0, net_income=150.0, operating_income=200.0,
        free_cash_flow=120.0, total_debt=200.0, cash=100.0,
        total_equity=800.0, total_assets=1600.0, shares_outstanding=100.0,
    )
    base.update(overrides)
    years = tuple(
        AnnualFinancials(period_end=f"{2021 + i}-03-31", **{
            **base,
            "revenue": base["revenue"] * (1.1 ** i),
            "net_income": base["net_income"] * (1.1 ** i),
            "operating_income": base["operating_income"] * (1.1 ** i),
            "free_cash_flow": base["free_cash_flow"] * (1.1 ** i),
        })
        for i in range(4)
    )
    return Fundamentals(symbol="TEST", name="Test Co", annuals=years)


# --- building blocks ------------------------------------------------------

def test_cost_of_equity_rises_with_beta():
    assert cost_of_equity(1.5) > cost_of_equity(0.8)


def test_cost_of_equity_never_dips_to_the_risk_free_rate():
    """A near-zero-beta name still has to compensate for equity risk."""
    assert cost_of_equity(0.0, risk_free=0.068) > 0.068


def test_historical_growth_reads_the_series():
    assert historical_growth(make().annuals) == pytest.approx(0.10, abs=0.001)


def test_band_maps_onto_nought_to_hundred():
    assert _band(0.25, good=0.20, bad=0.02) == 100.0
    assert _band(0.01, good=0.20, bad=0.02) == 0.0
    assert _band(0.11, good=0.20, bad=0.02) == pytest.approx(50.0, abs=1.0)


def test_band_inverts_for_metrics_where_lower_is_better():
    assert _band(0.0, good=0.0, bad=2.0, invert=True) == 100.0
    assert _band(3.0, good=0.0, bad=2.0, invert=True) == 0.0


# --- DCF ------------------------------------------------------------------

def test_dcf_produces_a_per_share_value_with_its_assumptions():
    result = dcf_value(make())
    assert result["value_per_share"] > 0
    assert result["assumptions"]["terminal_growth"] == 0.035
    assert len(result["projection"]) == 10


def test_dcf_declines_to_value_a_cash_burning_business():
    """Discounting negative cash flow yields a confident-looking lie."""
    assert dcf_value(make(free_cash_flow=-50.0)) is None


def test_dcf_growth_is_capped():
    """An 80%-a-year run does not get extrapolated for a decade."""
    fast = Fundamentals(symbol="F", name="Fast", annuals=tuple(
        AnnualFinancials(
            period_end=f"{2021 + i}-03-31", revenue=100 * (1.8 ** i),
            net_income=20 * (1.8 ** i), operating_income=26 * (1.8 ** i),
            free_cash_flow=18 * (1.8 ** i), total_debt=10, cash=40,
            total_equity=120, total_assets=260, shares_outstanding=50,
        ) for i in range(4)
    ))
    assert dcf_value(fast)["assumptions"]["starting_growth"] == 0.18


def test_dcf_keeps_the_discount_rate_above_terminal_growth():
    """Otherwise the Gordon terminal value diverges to nonsense."""
    result = dcf_value(make(), discount_rate=0.02, terminal_growth=0.035)
    assert result["assumptions"]["discount_rate"] > 0.035
    assert result["value_per_share"] > 0


def test_terminal_share_is_reported():
    """How much of the answer is an assumption about year 11 onward."""
    assert 0 < dcf_value(make())["terminal_share"] < 1


# --- EPV ------------------------------------------------------------------

def test_epv_ignores_growth_and_averages_the_cycle():
    result = epv_value(make())
    assert result["value_per_share"] > 0
    assert result["assumptions"]["years_averaged"] == 4


def test_epv_is_lower_than_dcf_for_a_growing_business():
    """EPV is the no-growth floor; a compounding business should exceed it."""
    growing = make()
    assert epv_value(growing)["value_per_share"] < dcf_value(growing)["value_per_share"]


def test_epv_declines_when_normalised_earnings_are_negative():
    assert epv_value(make(operating_income=-100.0)) is None


# --- scores ---------------------------------------------------------------

def test_healthy_balance_sheet_scores_above_a_leveraged_one():
    strong = financial_health(make(total_debt=50.0, cash=400.0))["score"]
    weak = financial_health(make(total_debt=2000.0, cash=10.0))["score"]
    assert strong > weak
    assert 0 <= weak <= 100 and 0 <= strong <= 100


def test_quality_rewards_margin_and_returns():
    good = business_quality(make(net_income=250.0))["score"]
    poor = business_quality(make(net_income=10.0))["score"]
    assert good > poor


def test_quality_penalises_unstable_margins():
    steady = make()
    swingy = Fundamentals(symbol="S", name="Swingy", annuals=tuple(
        AnnualFinancials(
            period_end=f"{2021 + i}-03-31", revenue=1000,
            net_income=[300, 20, 280, 30][i], operating_income=[400, 30, 380, 40][i],
            free_cash_flow=[240, 15, 220, 25][i], total_debt=200, cash=100,
            total_equity=800, total_assets=1600, shares_outstanding=100,
        ) for i in range(4)
    ))
    assert (business_quality(steady)["components"]["margin_stability"]
            > business_quality(swingy)["components"]["margin_stability"])


# --- the full valuation ---------------------------------------------------

def test_margin_of_safety_is_positive_when_cheap():
    result = value(make(), market_price=1.0)
    assert result["margin_of_safety"] > 0.9       # trading far below intrinsic
    assert result["discount_premium"] < 0          # ...i.e. at a discount


def test_margin_of_safety_is_negative_when_expensive():
    intrinsic = value(make(), market_price=1.0)["intrinsic_value"]
    result = value(make(), market_price=intrinsic * 2)
    assert result["margin_of_safety"] < 0
    assert result["discount_premium"] > 0


def test_blend_leans_on_epv_when_the_models_disagree_widely():
    result = value(make(), market_price=10.0)
    blend = result["detail"]["blend"]
    if blend["method"] == "weighted" and blend["spread"] > 0.6:
        assert blend["epv_weight"] > blend["dcf_weight"]
    assert "reason" in blend


def test_fair_value_sits_at_or_below_intrinsic():
    """Fair value haircuts intrinsic for balance-sheet and franchise risk."""
    result = value(make(), market_price=10.0)
    assert result["fair_value"] <= result["intrinsic_value"]


def test_a_weak_business_gets_a_bigger_haircut():
    strong = value(make(total_debt=20.0, cash=500.0, net_income=280.0), market_price=10.0)
    weak = value(make(total_debt=3000.0, cash=5.0, net_income=8.0), market_price=10.0)
    assert (weak["fair_value"] / weak["intrinsic_value"]
            < strong["fair_value"] / strong["intrinsic_value"])


def test_valuation_carries_its_inputs_for_audit():
    result = value(make(), market_price=10.0)
    assert result["fingerprint"]
    assert result["detail"]["dcf"]["assumptions"]["discount_rate"] > 0
    assert result["detail"]["engine"].startswith("valuation-")


def test_fingerprint_changes_only_when_the_financials_do():
    assert make().fingerprint() == make().fingerprint()
    assert make().fingerprint() != make(revenue=2000.0).fingerprint()


# --- stub provider --------------------------------------------------------

def test_stub_provider_covers_the_demo_book():
    provider = StubFundamentalsProvider()
    assert "RELIANCE" in provider.covered()
    assert provider.fetch("reliance").name == "Reliance Industries"
    assert provider.fetch("NOTLISTED") is None


def test_every_stub_company_values_cleanly():
    provider = StubFundamentalsProvider()
    for symbol in provider.covered():
        result = value(provider.fetch(symbol), market_price=100.0, provider="stub")
        assert result["intrinsic_value"] is not None, symbol
        assert result["financial_health"] >= 0
        assert result["business_quality"] >= 0
