"""P1: vendored pricing table resolution (2026-09-09).

Resolution chain: aliases → overrides → vendored exact → family prefix →
unknown(cost 0 + warning). ARK ep-xxx endpoint IDs resolve via
LLMGW_MODEL_ALIASES only.
"""
from __future__ import annotations

import pytest

from mate_tech_llmgw.cost.pricing import (
    ModelPrice,
    PricingTable,
    load_pricing_from_env,
    load_vendored_prices,
    set_pricing,
)


@pytest.fixture(autouse=True)
def _reset_pricing_singleton():
    set_pricing(None)
    yield
    set_pricing(None)


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("LLMGW_PRICE_OVERRIDES", raising=False)
    monkeypatch.delenv("LLMGW_MODEL_ALIASES", raising=False)


def test_vendored_json_loads_and_covers_seven_providers() -> None:
    data = load_vendored_prices()
    for model in (
        "gpt-4o",  # openai
        "claude-3-5-sonnet-20241022",  # anthropic
        "deepseek-chat",  # deepseek
        "qwen-plus",  # dashscope
        "moonshot-v1-8k",  # moonshot
        "doubao-1.5-pro-32k",  # ARK chat
        "doubao-embedding",  # ARK embedding
    ):
        assert model in data, f"{model} missing from vendored prices"
        assert data[model]["input_cost_per_token"] > 0


def test_exact_hit_uses_litellm_values() -> None:
    table = load_pricing_from_env()
    price = table.get("deepseek-chat")
    assert price is not None
    assert price.input_per_token == pytest.approx(2.8e-07)
    assert price.output_per_token == pytest.approx(4.2e-07)
    assert price.cache_read_per_token == pytest.approx(2.8e-08)


def test_ark_endpoint_id_resolves_via_alias_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """ep-xxx has no catalog entry — LLMGW_MODEL_ALIASES is the only source."""
    monkeypatch.setenv(
        "LLMGW_MODEL_ALIASES",
        '{"ep-20240903abcd": "doubao-seed-1.6"}',
    )
    table = load_pricing_from_env()
    assert table.get("ep-20240903abcd") == table.get("doubao-seed-1.6")


def test_dated_variant_resolves_by_family_prefix() -> None:
    table = load_pricing_from_env()
    dated = table.get("doubao-1.5-pro-32k-250115")
    base = table.get("doubao-1.5-pro-32k")
    assert dated is not None and base is not None
    assert dated.input_per_token == base.input_per_token


def test_unknown_model_returns_none() -> None:
    table = load_pricing_from_env()
    assert table.get("totally-unknown-model-x") is None
    assert table.get("") is None


def test_price_overrides_env_replaces_entry(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "LLMGW_PRICE_OVERRIDES",
        '{"qwen-max": {"input_cost_per_token": 0.0000006, '
        '"output_cost_per_token": 0.0000024}}',
    )
    table = load_pricing_from_env()
    price = table.get("qwen-max")
    assert price is not None
    assert price.input_per_token == pytest.approx(6e-07)
    assert price.source == "override"


def test_cost_math_and_cache_aware_cost() -> None:
    price = ModelPrice(input_per_token=2.5e-06, output_per_token=1e-05,
                       cache_read_per_token=1.25e-06)
    assert price.cost(1000, 500) == pytest.approx(0.0075)
    # All prompt tokens cached → cache_read rate on prompt side.
    assert price.cost_cached(1000, 1000, 500) == pytest.approx(
        1000 * 1.25e-06 + 500 * 1e-05
    )
    # Partial cache: 400 cached + 600 uncached.
    assert price.cost_cached(400, 1000, 0) == pytest.approx(
        600 * 2.5e-06 + 400 * 1.25e-06
    )


def test_estimate_cost_delegates_to_pricing() -> None:
    from mate_tech_llmgw.cost.recorder import estimate_cost

    # doubao previously cost $0 (the bug P1 fixes) — now priced from ARK data.
    cost = estimate_cost("doubao-1.5-pro-32k", 1_000_000, 500_000)
    assert cost > 0
    # Sanity: ¥0.8/1M in ≈ $0.111/1M at 7.2 CNY/USD → 1M tokens ≈ $0.111.
    assert cost == pytest.approx(1_000_000 * 1.11e-07 + 500_000 * 2.78e-07, rel=1e-3)


def test_table_prefix_match_prefers_longest() -> None:
    vendored = load_vendored_prices()
    table = PricingTable(vendored)
    # "doubao-seed-1.6-flash" must NOT resolve to "doubao-seed-1.6" pricing —
    # the flash variant has its own entry and the exact hit wins.
    flash = table.get("doubao-seed-1.6-flash")
    pro = table.get("doubao-seed-1.6")
    assert flash is not None and pro is not None
    assert flash.input_per_token != pro.input_per_token
