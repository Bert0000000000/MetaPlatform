"""Pydantic response models for the analytics API."""
from __future__ import annotations

from pydantic import BaseModel


class OverviewStats(BaseModel):
    total_users: int
    total_apps: int
    total_requests: int
    active_tenants: int
    period_days: int


class UsagePoint(BaseModel):
    date: str
    service: str
    request_count: int
    token_count: int


class UsageResponse(BaseModel):
    points: list[UsagePoint]
    summary: dict


class UserActivityPoint(BaseModel):
    date: str
    dau: int
    new_users: int


class UserActivityResponse(BaseModel):
    points: list[UserActivityPoint]
    mau: int
    growth_rate: float


class ServiceRanking(BaseModel):
    service: str
    request_count: int
    avg_latency_ms: float
    error_rate: float


class ServiceRankingResponse(BaseModel):
    rankings: list[ServiceRanking]


class TrendPoint(BaseModel):
    date: str
    requests: int
    tokens: int
    storage_gb: float


class TrendResponse(BaseModel):
    points: list[TrendPoint]
    period_days: int
