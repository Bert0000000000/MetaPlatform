"""Unit tests for mate_tech_llmgw.cost.ceiling (ADR-0018 §2.4)."""
from __future__ import annotations

import time
from datetime import UTC, datetime

import pytest

from mate_tech_llmgw.cost.ceiling import (
    MonthlyQuotaConfig,
    MonthlyTokenBucket,
    UserDailyCap,
    UserDailyCapConfig,
    UserDailyCapExceeded,
    detect_burst,
    scan_for_anomalies,
)
from mate_tech_llmgw.cost.recorder import UsageRecord


# ---------------------------------------------------------------------------
# MonthlyTokenBucket
# ---------------------------------------------------------------------------
def _record(tenant: str, user: str, pt: int, ct: int, cost: float, ts: float) -> UsageRecord:
    return UsageRecord(
        model="gpt-4o",
        tenant_id=tenant,
        user_id=user,
        prompt_tokens=pt,
        completion_tokens=ct,
        cost_usd=cost,
        ts=datetime.fromtimestamp(ts, tz=UTC),
    )


@pytest.mark.asyncio  # type: ignore[misc]
async def test_monthly_bucket_under_limit_ok() -> None:
    bucket = MonthlyTokenBucket(config=MonthlyQuotaConfig(monthly_token_limit=10_000))
    await bucket.check_and_record(tenant_id="acme", estimated_tokens=3_000)
    await bucket.check_and_record(tenant_id="acme", estimated_tokens=4_000)
    status = bucket.status("acme")
    assert status["tokens_used"] == 7_000


@pytest.mark.asyncio  # type: ignore[misc]
async def test_monthly_bucket_over_limit_raises() -> None:
    from mate_tech_llmgw.quota.bucket import QuotaExceededError

    bucket = MonthlyTokenBucket(config=MonthlyQuotaConfig(monthly_token_limit=1_000))
    await bucket.check_and_record(tenant_id="acme", estimated_tokens=800)
    with pytest.raises(QuotaExceededError) as ei:
        await bucket.check_and_record(tenant_id="acme", estimated_tokens=300)
    assert ei.value.retry_after >= 60


# ---------------------------------------------------------------------------
# UserDailyCap
# ---------------------------------------------------------------------------
def test_user_daily_cap_under_limit_ok() -> None:
    cap = UserDailyCap(config=UserDailyCapConfig(daily_cost_limit_usd=1.0))
    cap.check_and_record(tenant_id="acme", user_id="u-1", cost_usd=0.4)
    cap.check_and_record(tenant_id="acme", user_id="u-1", cost_usd=0.5)


def test_user_daily_cap_over_limit_raises() -> None:
    cap = UserDailyCap(config=UserDailyCapConfig(daily_cost_limit_usd=0.5))
    cap.check_and_record(tenant_id="acme", user_id="u-1", cost_usd=0.4)
    with pytest.raises(UserDailyCapExceeded) as ei:
        cap.check_and_record(tenant_id="acme", user_id="u-1", cost_usd=0.2)
    assert ei.value.user_id == "u-1"


# ---------------------------------------------------------------------------
# detect_burst
# ---------------------------------------------------------------------------
def test_detect_burst_true_when_burst_10x_median() -> None:
    base_ts = time.time() - 7_200
    records = [_record("acme", "u-x", 100, 100, 0.001, base_ts + i) for i in range(9)]
    # burst 在 window 内（最近 60s）
    records.append(_record("acme", "u-x", 100_000, 100_000, 5.0, time.time() - 30))
    assert detect_burst(records, user_id="u-x", window_sec=3_600, threshold_x=10.0) is True


def test_detect_burst_false_when_steady() -> None:
    now = time.time()
    records = [_record("acme", "u-y", 100, 100, 0.001, now - i * 60) for i in range(20)]
    assert detect_burst(records, user_id="u-y", window_sec=3_600, threshold_x=10.0) is False


def test_detect_burst_false_when_no_baseline() -> None:
    records = [_record("acme", "u-z", 100, 100, 0.001, time.time() - i) for i in range(3)]
    # baseline < 9 笔时不应该误报
    assert detect_burst(records, user_id="u-z", window_sec=3_600, threshold_x=10.0) is False


def test_scan_for_anomalies_returns_one() -> None:
    base_ts = time.time() - 7_200
    records = [_record("acme", "u-x", 100, 100, 0.001, base_ts + i) for i in range(9)]
    records.append(_record("acme", "u-x", 100_000, 100_000, 5.0, time.time() - 30))
    anomalies = scan_for_anomalies(records, window_sec=3_600, threshold_x=10.0)
    assert len(anomalies) == 1
    a = anomalies[0]
    assert a.user_id == "u-x"
    assert a.multiplier >= 10.0