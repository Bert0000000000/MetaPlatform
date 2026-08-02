"""mate_app_hub.runtime — runtime engine for APPHUB-RUNTIME-01 phase B.

Public API:
  - schema:  RuntimeContext / RenderNode / RuntimeAction / ActionResult
  - loader:  load_app_runtime
  - renderer: render_page
  - executor: execute_action
  - binding:  resolve_field_binding
  - authz:    check_runtime_access / check_publish_access / check_shortlink_access
  - errors:   RuntimeErrorCode
"""
from __future__ import annotations

from .authz import (
    check_publish_access,
    check_runtime_access,
    check_shortlink_access,
)
from .binding import resolve_field_binding
from .errors import RuntimeErrorCode
from .executor import (
    MockExecutor,
    RealExecutor,
    execute_action,
    get_executor,
)
from .loader import load_app_runtime
from .renderer import render_page
from .schema import (
    ActionResult,
    RenderNode,
    RuntimeAction,
    RuntimeContext,
)

__all__ = [
    "ActionResult",
    "MockExecutor",
    "RealExecutor",
    "RenderNode",
    "RuntimeAction",
    "RuntimeContext",
    "RuntimeErrorCode",
    "check_publish_access",
    "check_runtime_access",
    "check_shortlink_access",
    "execute_action",
    "get_executor",
    "load_app_runtime",
    "render_page",
    "resolve_field_binding",
]
