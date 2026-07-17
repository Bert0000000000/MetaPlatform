"""Runtime rate-limit evaluation: in-memory sliding window counters.

Phase 2 acceptance fix: the configuration CRUD is already in place but
the actual interception logic was missing. This module introduces a
``RateLimitGuard`` that the chat / embedding services can call to
``check_and_increment``. Decisions are reported back to the audit log
so the existing ``/rate-limits/stats`` endpoints reflect real activity
instead of zero placeholders.
"""

from __future__ import annotations

import threading
import time
from collections import deque
from dataclasses import dataclass
from typing import Deque, Dict, List, Optional, Tuple

from app.ratelimits.schemas import RateLimitRecord, RateLimitScope, RateLimitType
from app.ratelimits.service import RateLimitService


@dataclass
class RateLimitDecision:
    """Result of a ``check_and_increment`` call."""

    allowed: bool
    rule_id: Optional[str] = None
    scope: Optional[str] = None
    target_id: Optional[str] = None
    type: Optional[str] = None
    limit: int = 0
    window_seconds: int = 0
    current: int = 0
    remaining: int = 0
    reason: str = ""

    def to_dict(self) -> dict:
        return {
            "allowed": self.allowed,
            "ruleId": self.rule_id,
            "scope": self.scope,
            "targetId": self.target_id,
            "type": self.type,
            "limit": self.limit,
            "windowSeconds": self.window_seconds,
            "current": self.current,
            "remaining": self.remaining,
            "reason": self.reason,
        }


class RateLimitGuard:
    """Thread-safe in-memory sliding window evaluator."""

    def __init__(self, service: RateLimitService) -> None:
        self._service = service
        self._lock = threading.RLock()
        # (tenant_id, rule_id) -> deque of monotonic timestamps
        self._hits: Dict[Tuple[str, str], Deque[float]] = {}

    # ----------------------------------------------------------------- API

    def check_and_increment(
        self,
        tenant_id: str,
        scope: RateLimitScope,
        target_id: str,
        type_: RateLimitType,
    ) -> RateLimitDecision:
        """Apply the most specific enabled rule and update its counter."""

        rule = self._service.find_enabled_rule(tenant_id, scope, target_id, type_)
        if rule is None:
            return RateLimitDecision(allowed=True, reason="no_rule")

        key = (tenant_id, rule.rate_limit_id)
        with self._lock:
            bucket = self._hits.setdefault(key, deque())
            now = time.monotonic()
            self._trim(bucket, rule.window_seconds, now)
            if len(bucket) >= rule.limit_value:
                return RateLimitDecision(
                    allowed=False,
                    rule_id=rule.rate_limit_id,
                    scope=rule.scope.value,
                    target_id=rule.target_id,
                    type=rule.type.value,
                    limit=rule.limit_value,
                    window_seconds=rule.window_seconds,
                    current=len(bucket),
                    remaining=0,
                    reason="limit_exceeded",
                )
            bucket.append(now)
            current = len(bucket)
            remaining = max(0, rule.limit_value - current)
            return RateLimitDecision(
                allowed=True,
                rule_id=rule.rate_limit_id,
                scope=rule.scope.value,
                target_id=rule.target_id,
                type=rule.type.value,
                limit=rule.limit_value,
                window_seconds=rule.window_seconds,
                current=current,
                remaining=remaining,
            )

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()

    # ------------------------------------------------------------ internals

    def _trim(self, bucket: Deque[float], window_seconds: int, now: float) -> None:
        cutoff = now - window_seconds
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()
