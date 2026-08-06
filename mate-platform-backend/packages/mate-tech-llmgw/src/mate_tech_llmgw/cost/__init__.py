"""mate_tech_llmgw.cost — public surface."""
from __future__ import annotations

from .ceiling import (
    CostAnomaly,
    MonthlyQuotaConfig,
    MonthlyTokenBucket,
    UserDailyCap,
    UserDailyCapConfig,
    UserDailyCapExceeded,
    detect_burst,
    scan_for_anomalies,
)
from .recorder import CostRecorder, PRICING, UsageRecord, estimate_cost

__all__ = [
    "CostAnomaly",
    "CostRecorder",
    "MonthlyQuotaConfig",
    "MonthlyTokenBucket",
    "PRICING",
    "UsageRecord",
    "UserDailyCap",
    "UserDailyCapConfig",
    "UserDailyCapExceeded",
    "detect_burst",
    "estimate_cost",
    "scan_for_anomalies",
]