"""APPHUB-RUNTIME-01 executor integration tests (K3-4).

Verifies the RealExecutor adapters delegate to mate_clients stubs and
produce the documented ``ActionResult`` shape for each action type.

Each test:

- Constructs a RealExecutor with the three stub clients
  (``wfe`` / ``api_gateway`` / ``forms``).
- Builds a RuntimeContext + RuntimeAction.
- Calls the relevant handler.
- Asserts on success + key data fields.

The stubs are deterministic — they return synthetic IDs derived
from a stable hash so the tests are repeatable without external
services.
"""
from __future__ import annotations

import pytest
from mate_app_hub.runtime.executor import (
    MockExecutor,
    RealExecutor,
    get_executor,
)
from mate_app_hub.runtime.schema import RuntimeAction, RuntimeContext

from mate_clients.api_gateway import APIGatewayClient
from mate_clients.forms import FormsClient
from mate_clients.wfe import FlowableClient


@pytest.fixture
def real_executor() -> RealExecutor:
    return RealExecutor(
        wfe=FlowableClient(base_url="http://localhost:8081"),
        gateway=APIGatewayClient(base_url="http://localhost:8080"),
        forms=FormsClient(base_url="http://localhost:8080"),
    )


@pytest.fixture
def ctx() -> RuntimeContext:
    return RuntimeContext(
        app_id="app-1",
        tenant_id="tenant-a",
        version="latest",
        modules=[],
    )


def test_real_executor_submit_form_returns_submission_id(real_executor: RealExecutor, ctx: RuntimeContext)-> None:
    """RealExecutor.submit_form → FormsClient.submit with synthetic id."""
    action = RuntimeAction(action_id="act-1", action_type="submit_form", target="form-1")
    import asyncio
    result = asyncio.run(
        real_executor.submit_form(ctx, action, {"name": "test"})
    )
    assert result.success is True
    assert result.action_id == "act-1"
    assert "form_submission_id" in result.data
    assert result.data["form_id"] == "form-1"
    assert result.data["app_id"] == "app-1"


def test_real_executor_trigger_flow_returns_process_instance_id(real_executor: RealExecutor, ctx: RuntimeContext)-> None:
    """RealExecutor.trigger_flow → FlowableClient.start_process."""
    action = RuntimeAction(
        action_id="act-2", action_type="trigger_flow", target="process.approval",
    )
    import asyncio
    result = asyncio.run(
        real_executor.trigger_flow(ctx, action, {"amount": 1000})
    )
    assert result.success is True
    assert "processInstanceId" in result.data
    assert result.data["process_key"] == "process.approval"
    assert result.data["business_key"] == "app-1"


def test_real_executor_call_api_returns_call_id(real_executor: RealExecutor, ctx: RuntimeContext)-> None:
    """RealExecutor.call_api → APIGatewayClient.invoke."""
    action = RuntimeAction(action_id="act-3", action_type="call_api", target="api.echo")
    import asyncio
    result = asyncio.run(
        real_executor.call_api(ctx, action, {"input": "hello"})
    )
    assert result.success is True
    assert "callId" in result.data
    assert result.data["api_id"] == "api.echo"
    assert result.data["echoed_payload"] == {"input": "hello"}


def test_real_executor_navigate_returns_target(real_executor: RealExecutor, ctx: RuntimeContext)-> None:
    """RealExecutor.navigate → 仅返回跳转目标."""
    action = RuntimeAction(
        action_id="act-4", action_type="navigate", target="/dashboard",
    )
    import asyncio
    result = asyncio.run(real_executor.navigate(ctx, action, {}))
    assert result.success is True
    assert result.data == {"navigate": "/dashboard"}


def test_real_executor_dispatch_routes_to_correct_handler(real_executor: RealExecutor, ctx: RuntimeContext)-> None:
    """RealExecutor.dispatch dispatches by action_type."""
    action = RuntimeAction(
        action_id="act-5", action_type="trigger_flow", target="process.x",
    )
    import asyncio
    result = asyncio.run(real_executor.dispatch(ctx, action, {}))
    assert result.success is True
    assert "processInstanceId" in result.data


def test_real_executor_dispatch_unknown_action_returns_error(real_executor: RealExecutor, ctx: RuntimeContext)-> None:
    """Unknown action_type → success=False with error message."""
    action = RuntimeAction(
        action_id="act-6", action_type="not_a_real_action", target="x",
    )
    import asyncio
    result = asyncio.run(real_executor.dispatch(ctx, action, {}))
    assert result.success is False
    assert "unknown action type" in (result.error or "")


def test_get_executor_returns_real_by_default()-> None:
    """get_executor() with no env override returns RealExecutor."""
    import os
    os.environ.pop("APPHUB_EXECUTOR_MODE", None)
    executor = get_executor()
    assert isinstance(executor, RealExecutor)


def test_get_executor_returns_mock_when_mode_is_mock()-> None:
    """APPHUB_EXECUTOR_MODE=mock → MockExecutor."""
    import os
    os.environ["APPHUB_EXECUTOR_MODE"] = "mock"
    try:
        executor = get_executor()
        assert isinstance(executor, MockExecutor)
    finally:
        os.environ.pop("APPHUB_EXECUTOR_MODE", None)


def test_mock_executor_dispatch_returns_legacy_shape(ctx: RuntimeContext)-> None:
    """MockExecutor.dispatch delegates to legacy execute_action."""
    import asyncio
    mock = MockExecutor()
    action = RuntimeAction(
        action_id="act-7", action_type="submit_form", target="form-1",
    )
    result = asyncio.run(mock.dispatch(ctx, action, {"x": 1}))
    assert result.success is True
    # Legacy shape: {"submitted": True, "target": ..., "payload": ...}
    assert result.data["submitted"] is True
    assert result.data["target"] == "form-1"
    assert result.data["payload"] == {"x": 1}
