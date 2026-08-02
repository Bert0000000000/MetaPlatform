"""Runtime executor — dispatches RuntimeAction calls (K3-4 RealExecutor).

APPHUB-RUNTIME-01 phase B. Two implementations live side by side:

* ``MockExecutor`` — original mock handlers. Used by tests that need
  to exercise the executor without external dependencies and by the
  fallback path when ``APPHUB_EXECUTOR_MODE=mock`` is set.
* ``RealExecutor`` — adapters that delegate to ``mate_clients.wfe /
  api_gateway / forms``. Each action emits an OTel span and tags the
  relevant identifiers (app_id, tenant_id, action target) so the
  call graph is traceable in production.

``get_executor()`` selects between the two based on the
``APPHUB_EXECUTOR_MODE`` env var; default is ``real`` so production
deployments get the real integrations unless the operator opts out.
"""
from __future__ import annotations

import os

from mate_clients.api_gateway import APIGatewayClient
from mate_clients.forms import FormsClient
from mate_clients.wfe import FlowableClient

from ..telemetry import get_tracer
from .schema import ActionResult, RuntimeAction, RuntimeContext


# ---------------------------------------------------------------------------
# Mock executor — keeps the original mock implementations so the existing
# test surface continues to work without external services.
# ---------------------------------------------------------------------------
async def execute_action(
    ctx: RuntimeContext, action: RuntimeAction, payload: dict,
) -> ActionResult:
    """Execute via the legacy mock dispatch (kept for backward-compat)."""
    with get_tracer().start_as_current_span("apphub.runtime.execute") as span:
        span.set_attribute("apphub.action_type", action.action_type)
        span.set_attribute("apphub.tenant_id", ctx.tenant_id)
        span.set_attribute("apphub.app_id", ctx.app_id)
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


# ---------------------------------------------------------------------------
# Real executor — delegates to mate_clients for the 4 action types.
# ---------------------------------------------------------------------------
class MockExecutor:
    """Marker for the legacy mock executor (same callable shape)."""

    async def dispatch(
        self, ctx: RuntimeContext, action: RuntimeAction, payload: dict,
    ) -> ActionResult:
        return await execute_action(ctx, action, payload)


class RealExecutor:
    """Real executor — adapters that delegate to ``mate_clients``."""

    def __init__(
        self,
        wfe: FlowableClient,
        gateway: APIGatewayClient,
        forms: FormsClient,
    ) -> None:
        self._wfe = wfe
        self._gateway = gateway
        self._forms = forms

    async def submit_form(
        self, ctx: RuntimeContext, action: RuntimeAction, payload: dict,
    ) -> ActionResult:
        """submit_form → FormsClient.submit"""
        with get_tracer().start_as_current_span("apphub.runtime.submit_form") as span:
            span.set_attribute("apphub.app_id", ctx.app_id)
            span.set_attribute("apphub.form_id", action.target)
            span.set_attribute("apphub.tenant_id", ctx.tenant_id)
            result = await self._forms.submit(
                app_id=ctx.app_id,
                form_id=action.target,
                payload=payload,
                tenant_id=ctx.tenant_id,
            )
            return ActionResult(
                action_id=action.action_id,
                success=True,
                data=result,
            )

    async def trigger_flow(
        self, ctx: RuntimeContext, action: RuntimeAction, payload: dict,
    ) -> ActionResult:
        """trigger_flow → FlowableClient.start_process"""
        with get_tracer().start_as_current_span("apphub.runtime.trigger_flow") as span:
            span.set_attribute("apphub.app_id", ctx.app_id)
            span.set_attribute("apphub.process_key", action.target)
            span.set_attribute("apphub.tenant_id", ctx.tenant_id)
            result = await self._wfe.start_process(
                process_key=action.target,
                business_key=ctx.app_id,
                variables=payload,
                tenant_id=ctx.tenant_id,
            )
            return ActionResult(
                action_id=action.action_id,
                success=True,
                data=result,
            )

    async def call_api(
        self, ctx: RuntimeContext, action: RuntimeAction, payload: dict,
    ) -> ActionResult:
        """call_api → APIGatewayClient.invoke"""
        with get_tracer().start_as_current_span("apphub.runtime.call_api") as span:
            span.set_attribute("apphub.app_id", ctx.app_id)
            span.set_attribute("apphub.api_id", action.target)
            span.set_attribute("apphub.tenant_id", ctx.tenant_id)
            result = await self._gateway.invoke(
                api_id=action.target,
                payload=payload,
                tenant_id=ctx.tenant_id,
            )
            return ActionResult(
                action_id=action.action_id,
                success=True,
                data=result,
            )

    async def navigate(
        self, ctx: RuntimeContext, action: RuntimeAction, payload: dict,
    ) -> ActionResult:
        """navigate → 仅返回跳转目标 (no external service)."""
        with get_tracer().start_as_current_span("apphub.runtime.navigate") as span:
            span.set_attribute("apphub.app_id", ctx.app_id)
            span.set_attribute("apphub.target", action.target)
            return ActionResult(
                action_id=action.action_id,
                success=True,
                data={"navigate": action.target},
            )

    async def dispatch(
        self, ctx: RuntimeContext, action: RuntimeAction, payload: dict,
    ) -> ActionResult:
        """Dispatch by action_type — selects one of the 4 handlers."""
        match action.action_type:
            case "submit_form":
                return await self.submit_form(ctx, action, payload)
            case "trigger_flow":
                return await self.trigger_flow(ctx, action, payload)
            case "call_api":
                return await self.call_api(ctx, action, payload)
            case "navigate":
                return await self.navigate(ctx, action, payload)
            case _:
                return ActionResult(
                    action_id=action.action_id,
                    success=False,
                    error=f"unknown action type: {action.action_type}",
                )


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------
def get_executor() -> RealExecutor | MockExecutor:
    """Return the configured executor (real by default, mock opt-in)."""
    mode = os.getenv("APPHUB_EXECUTOR_MODE", "real")
    if mode == "real":
        return RealExecutor(
            wfe=FlowableClient(
                base_url=os.getenv("WFE_BASE_URL", "http://localhost:8081"),
            ),
            gateway=APIGatewayClient(
                base_url=os.getenv("API_GATEWAY_BASE_URL", "http://localhost:8080"),
            ),
            forms=FormsClient(
                base_url=os.getenv("FORMS_BASE_URL", "http://localhost:8080"),
            ),
        )
    return MockExecutor()
