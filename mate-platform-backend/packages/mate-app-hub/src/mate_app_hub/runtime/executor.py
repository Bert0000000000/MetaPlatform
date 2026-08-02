"""Runtime executor — dispatches RuntimeAction calls.

APPHUB-RUNTIME-01 phase B. All action handlers are mock implementations;
the real integrations (wfe for trigger_flow, API gateway for call_api)
land in subsequent phases.
"""
from __future__ import annotations

from .schema import ActionResult, RuntimeAction, RuntimeContext


async def execute_action(
    ctx: RuntimeContext, action: RuntimeAction, payload: dict,
) -> ActionResult:
    """Execute a runtime action and return the result.

    Supported action types:
      - submit_form  → mock success (real path: wfe form submission)
      - trigger_flow → mock success (real path: Flowable BPMN)
      - call_api     → mock success (real path: API gateway)
      - navigate     → returns the target URL
    Unknown action types return ``success=False``.
    """
    if action.action_type == "submit_form":
        return ActionResult(
            action_id=action.action_id,
            success=True,
            data={"submitted": True, "target": action.target, "payload": payload},
        )
    if action.action_type == "trigger_flow":
        return ActionResult(
            action_id=action.action_id,
            success=True,
            data={"triggered": True, "flow_id": action.target},
        )
    if action.action_type == "call_api":
        return ActionResult(
            action_id=action.action_id,
            success=True,
            data={"called": True, "endpoint": action.target},
        )
    if action.action_type == "navigate":
        return ActionResult(
            action_id=action.action_id,
            success=True,
            data={"url": action.target},
        )
    return ActionResult(
        action_id=action.action_id,
        success=False,
        error=f"unknown action type: {action.action_type}",
    )
