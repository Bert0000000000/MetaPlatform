"""Cost tests (ST-5.5.5.2)."""
from __future__ import annotations

from mate_tech_llmgw.cost.recorder import PRICING, CostRecorder, estimate_cost


def test_estimate_cost_gpt4o() -> None:
    """gpt-4o: $5/1M prompt + $15/1M completion."""
    # 1000 prompt + 500 completion
    cost = estimate_cost("gpt-4o", 1000, 500)
    expected = 1000 / 1000 * 0.005 + 500 / 1000 * 0.015
    assert abs(cost - expected) < 1e-6


def test_estimate_cost_claude_opus() -> None:
    """claude-3-opus: $15/1M prompt + $75/1M completion."""
    cost = estimate_cost("claude-3-opus-20240229", 1000, 1000)
    expected = 0.015 + 0.075
    assert abs(cost - expected) < 1e-6


def test_estimate_cost_unknown_model_zero() -> None:
    """未知模型 → 0 cost."""
    assert estimate_cost("unknown-model", 1000, 1000) == 0.0


def test_pricing_table_has_4_providers() -> None:
    """ST-5.5.5 DoD: 至少 4 个 provider 定价."""
    assert "gpt-4o" in PRICING
    assert "gpt-4o-mini" in PRICING
    assert "claude-3-5-sonnet-20241022" in PRICING
    assert "claude-3-haiku-20240307" in PRICING


def test_cost_recorder_creates_record() -> None:
    """构造 CostRecorder 实例."""
    rec = CostRecorder(dsn="postgresql://test")
    assert rec._dsn == "postgresql://test"
    assert rec._pool is None


def test_cost_recorder_estimate_only_no_pool() -> None:
    """无 PG pool 时只计算不写入."""
    import asyncio

    from mate_tech_llmgw.cost.recorder import CostRecorder
    rec = CostRecorder()
    # 没有 pool，record() 不会抛错（写 PG 失败被 try-except 吞掉）
    async def go() -> None:
        r = await rec.record(
            model="gpt-4o",
            tenant_id="acme",
            usage={"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150},
        )
        assert r.cost_usd > 0
        assert r.model == "gpt-4o"

    asyncio.run(go())