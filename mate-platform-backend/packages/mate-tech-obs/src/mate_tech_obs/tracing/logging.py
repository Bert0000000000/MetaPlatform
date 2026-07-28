"""Loki + Tempo 配置 (ST-5.2.5 + ST-5.2.6)."""
from __future__ import annotations

import os

import structlog


def configure_json_logging(level: str = "INFO") -> None:
    import logging
    log_level = getattr(logging, level.upper(), logging.INFO)
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_loki_endpoint() -> str | None:
    return os.getenv("LOKI_ENDPOINT")


def get_tempo_endpoint() -> str | None:
    return os.getenv("TEMPO_ENDPOINT") or os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")