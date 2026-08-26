"""Stable policy configuration for the order-review workflow."""

from __future__ import annotations

import os

DEFAULT_ORDER_REVIEW_THRESHOLD_CENTS = 100_000
ORDER_REVIEW_THRESHOLD_ENV = "ORDER_REVIEW_THRESHOLD_CENTS"


def resolve_order_review_threshold_cents(override: int | None = None) -> int:
    """Resolve and validate the shared high-value order threshold."""
    if override is None:
        raw_value = os.getenv(ORDER_REVIEW_THRESHOLD_ENV)
        if raw_value is None:
            return DEFAULT_ORDER_REVIEW_THRESHOLD_CENTS
        try:
            threshold_cents = int(raw_value)
        except ValueError as error:
            raise ValueError(
                f"{ORDER_REVIEW_THRESHOLD_ENV} must be a positive integer"
            ) from error
    else:
        threshold_cents = override

    if isinstance(threshold_cents, bool) or threshold_cents <= 0:
        raise ValueError(f"{ORDER_REVIEW_THRESHOLD_ENV} must be a positive integer")
    return threshold_cents
