"""In-memory analytics store with deterministic per-tenant seed data.

Generates 30 days x 10 services of synthetic-but-deterministic metrics.
The seed is derived from the tenant_id so that different tenants observe
different numbers (cross-tenant isolation is observable, not just enforced
by the guard). No real database is touched; this is a stand-in until the
DATA-D0-D8 platform lands.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from .models import (
    OverviewStats,
    ServiceRanking,
    ServiceRankingResponse,
    TrendPoint,
    TrendResponse,
    UsagePoint,
    UsageResponse,
    UserActivityPoint,
    UserActivityResponse,
)

SERVICES: tuple[str, ...] = (
    "iam",
    "kb",
    "rag",
    "llmgw",
    "mcp",
    "agent",
    "obs",
    "msg",
    "ont",
    "a2a",
)
SEED_DAYS = 30
MAX_DAYS = 30


def _tenant_seed(tenant_id: str) -> int:
    """Stable 32-bit hash of the tenant id (deterministic, no collisions
    for typical short tenant ids)."""
    h = 0
    for ch in tenant_id:
        h = (h * 131 + ord(ch)) & 0xFFFFFFFF
    return h


def _lcg(seed: int):
    """Linear-congruential generator yielding floats in [0, 1)."""
    state = seed & 0xFFFFFFFF

    def _next() -> float:
        nonlocal state
        state = (state * 1664525 + 1013904223) & 0xFFFFFFFF
        return state / 0x100000000

    return _next


def _stable_hash(text: str) -> int:
    """Process-independent string hash (FNV-1a 32-bit).

    Python's builtin hash() is salted per process, which would make the
    per-service baselines non-reproducible and tests flaky. This is stable.
    """
    h = 2166136261
    for ch in text:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h


class _DayRecord:
    """One day of per-service metrics + user/storage aggregates."""

    __slots__ = ("date", "requests", "tokens", "latency", "errors", "dau", "new_users")

    def __init__(
        self,
        d: str,
        requests: dict[str, int],
        tokens: dict[str, int],
        latency: dict[str, float],
        errors: dict[str, int],
        dau: int,
        new_users: int,
    ) -> None:
        self.date = d
        self.requests = requests
        self.tokens = tokens
        self.latency = latency
        self.errors = errors
        self.dau = dau
        self.new_users = new_users


def _generate_tenant_data(tenant_id: str) -> list[_DayRecord]:
    """Build 30 days of deterministic metrics for a tenant."""
    seed = _tenant_seed(tenant_id) or 1
    rng = _lcg(seed)
    today = date.today()
    records: list[_DayRecord] = []
    # baseline scales per tenant so totals differ across tenants
    base_scale = 0.6 + (seed % 100) / 100.0  # 0.6 .. 1.59
    for i in range(SEED_DAYS):
        d = today - timedelta(days=SEED_DAYS - 1 - i)
        # slow upward trend + weekly seasonality + noise
        trend = i * 0.01
        seasonal = 0.10 if d.weekday() < 5 else -0.18  # weekends weaker
        day_factor = base_scale * (1.0 + trend + seasonal)
        requests: dict[str, int] = {}
        tokens: dict[str, int] = {}
        latency: dict[str, float] = {}
        errors: dict[str, int] = {}
        for svc in SERVICES:
            base_req = 200 + (_stable_hash(svc) % 300)
            req = max(10, int(base_req * day_factor * (0.7 + rng() * 0.6)))
            tok = req * (20 + (_stable_hash(svc) % 80))
            lat = round(30.0 + rng() * 220.0, 1)
            err = int(req * (rng() * 0.03))  # 0..3% error rate
            requests[svc] = req
            tokens[svc] = tok
            latency[svc] = lat
            errors[svc] = err
        dau = max(20, int((400 + seed % 600) * day_factor * (0.8 + rng() * 0.4)))
        new_users = max(0, int(5 + rng() * 25))
        records.append(
            _DayRecord(
                d=d.isoformat(),
                requests=requests,
                tokens=tokens,
                latency=latency,
                errors=errors,
                dau=dau,
                new_users=new_users,
            )
        )
    return records


# Cache generated data per tenant (deterministic -> safe to memoise).
_CACHE: dict[str, list[_DayRecord]] = {}


def _data_for(tenant_id: str) -> list[_DayRecord]:
    recs = _CACHE.get(tenant_id)
    if recs is None:
        recs = _generate_tenant_data(tenant_id)
        _CACHE[tenant_id] = recs
    return recs


def _window(tenant_id: str, days: int) -> list[_DayRecord]:
    recs = _data_for(tenant_id)
    n = max(1, min(days, len(recs)))
    return recs[-n:]


def get_overview(tenant_id: str, days: int) -> OverviewStats:
    win = _window(tenant_id, days)
    total_requests = sum(sum(r.requests.values()) for r in win)
    seed = _tenant_seed(tenant_id) or 1
    # registered users: deterministic baseline independent of the window
    total_users = 120 + (seed % 900)
    total_apps = len(SERVICES)
    active_tenants = 1 + (seed % 6)
    return OverviewStats(
        total_users=total_users,
        total_apps=total_apps,
        total_requests=total_requests,
        active_tenants=active_tenants,
        period_days=len(win),
    )


def get_usage(tenant_id: str, days: int) -> UsageResponse:
    win = _window(tenant_id, days)
    points: list[UsagePoint] = []
    total_req = 0
    total_tok = 0
    svc_totals: dict[str, int] = {svc: 0 for svc in SERVICES}
    for r in win:
        for svc in SERVICES:
            req = r.requests[svc]
            tok = r.tokens[svc]
            points.append(
                UsagePoint(
                    date=r.date,
                    service=svc,
                    request_count=req,
                    token_count=tok,
                )
            )
            total_req += req
            total_tok += tok
            svc_totals[svc] += req
    top_service = max(SERVICES, key=lambda s: svc_totals[s]) if SERVICES else ""
    summary: dict[str, Any] = {
        "total_requests": total_req,
        "total_tokens": total_tok,
        "top_service": top_service,
        "service_count": len(SERVICES),
    }
    return UsageResponse(points=points, summary=summary)


def get_users(tenant_id: str, days: int) -> UserActivityResponse:
    win = _window(tenant_id, days)
    points = [
        UserActivityPoint(date=r.date, dau=r.dau, new_users=r.new_users) for r in win
    ]
    # MAU = sum of DAU over the full 30-day rolling window (active users
    # are not additive, but for a synthetic store this is a stable proxy).
    all_recs = _data_for(tenant_id)
    mau = sum(r.dau for r in all_recs)
    first_dau = win[0].dau if win else 1
    last_dau = win[-1].dau if win else 1
    growth_rate = round((last_dau - first_dau) / first_dau, 4) if first_dau else 0.0
    return UserActivityResponse(points=points, mau=mau, growth_rate=growth_rate)


def get_services(tenant_id: str, days: int) -> ServiceRankingResponse:
    win = _window(tenant_id, days)
    rankings: list[ServiceRanking] = []
    for svc in SERVICES:
        req_total = sum(r.requests[svc] for r in win)
        lat_avg = round(sum(r.latency[svc] for r in win) / len(win), 1) if win else 0.0
        err_total = sum(r.errors[svc] for r in win)
        error_rate = round(err_total / req_total, 4) if req_total else 0.0
        rankings.append(
            ServiceRanking(
                service=svc,
                request_count=req_total,
                avg_latency_ms=lat_avg,
                error_rate=error_rate,
            )
        )
    # sort by request_count desc (top N)
    rankings.sort(key=lambda x: x.request_count, reverse=True)
    return ServiceRankingResponse(rankings=rankings)


def get_trends(tenant_id: str, days: int) -> TrendResponse:
    win = _window(tenant_id, days)
    all_recs = _data_for(tenant_id)
    # storage grows monotonically from a tenant-specific baseline
    seed = _tenant_seed(tenant_id) or 1
    base_storage = 5.0 + (seed % 50)
    daily_growth = 0.4 + (seed % 30) / 100.0
    storage_by_offset = {
        i: round(base_storage + i * daily_growth, 2) for i in range(len(all_recs))
    }
    points: list[TrendPoint] = []
    # map each record to its global index for the storage curve
    global_index_start = len(all_recs) - len(win)
    for idx, r in enumerate(win):
        gi = global_index_start + idx
        points.append(
            TrendPoint(
                date=r.date,
                requests=sum(r.requests.values()),
                tokens=sum(r.tokens.values()),
                storage_gb=storage_by_offset.get(gi, base_storage),
            )
        )
    return TrendResponse(points=points, period_days=len(win))
