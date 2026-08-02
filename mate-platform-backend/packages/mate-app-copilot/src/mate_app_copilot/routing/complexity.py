"""Query complexity classification for copilot routing.

A query is classified as "deep research" when it is **long** (>= 30
characters) **and** contains at least one research-oriented keyword.
Short queries — even with keywords — are handled by the lightweight
llmgw chat path to avoid unnecessary latency.
"""
from __future__ import annotations

import re

#: Minimum query length (in characters) to be considered for deep routing.
MIN_DEEP_QUERY_LENGTH = 30

#: Keywords that indicate a research-oriented query. Matches both
#: Chinese (调研 / 研究 / 分析 / 对比 / 综述 / 行业 / 深度) and English
#: (research / analysis / market / industry).
DEEP_RESEARCH_KEYWORDS = re.compile(
    r"(调研|研究|分析|对比|综述|行业|深度|market|industry|research|analysis)",
    re.IGNORECASE,
)


def is_deep_research_query(query: str) -> bool:
    """Return True when *query* is long AND contains a research keyword.

    The length gate (>= 30 chars) prevents short keyword-bearing phrases
    like "分析一下" from being routed to the expensive DeerFlow path.
    """
    if len(query) < MIN_DEEP_QUERY_LENGTH:
        return False
    return bool(DEEP_RESEARCH_KEYWORDS.search(query))
