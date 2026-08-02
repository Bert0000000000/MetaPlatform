"""Runtime schema dataclasses for APPHUB-RUNTIME-01 phase B.

These dataclasses model the runtime context, render tree, and action
lifecycle used by the apphub runtime engine.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True, slots=True)
class RuntimeContext:
    app_id: str
    tenant_id: str
    version: str = "latest"
    user_role: str = "viewer"
    modules: list[dict] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class RenderNode:
    node_type: str  # "page" | "form" | "flow" | "board"
    title: str
    layout: dict[str, Any] = field(default_factory=dict)
    children: list[RenderNode] = field(default_factory=list)
    config: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class RuntimeAction:
    action_id: str
    action_type: str  # "submit_form" | "trigger_flow" | "call_api" | "navigate"
    target: str
    payload_schema: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class ActionResult:
    action_id: str
    success: bool
    data: dict[str, Any] = field(default_factory=dict)
    error: str | None = None
