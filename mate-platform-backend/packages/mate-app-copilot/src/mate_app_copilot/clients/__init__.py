"""mate_app_copilot.clients — outbound client layer.

Wraps every service-to-service HTTP call behind the mate-clients ACL
(Bearer + X-Tenant-Id). The base config lives in :mod:`.base`; the
streaming client for mate-tech-llmgw lives in :mod:`.llmgw_stream`.
"""
from .base import AsyncCopilotClient
from .llmgw_stream import LlmgwStreamClient, LlmgwStreamError

__all__ = [
    "AsyncCopilotClient",
    "LlmgwStreamClient",
    "LlmgwStreamError",
]
