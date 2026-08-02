"""mate_app_copilot.routing — query complexity routing.

``is_deep_research_query()`` classifies a user query as "deep research"
(long + research keywords) so the dispatcher can route it to the A2A
DeerFlow agent instead of the lightweight llmgw chat.
"""
from __future__ import annotations

from .complexity import DEEP_RESEARCH_KEYWORDS, is_deep_research_query
from .dispatcher import dispatch

__all__ = [
    "DEEP_RESEARCH_KEYWORDS",
    "dispatch",
    "is_deep_research_query",
]
