"""Agent Tool management endpoints (P2-AGT-18/19)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request

from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_tool_service
from app.tools.schemas import tool_to_dict
from app.tools.service import ToolService

router = APIRouter(tags=["tools"])


@router.post("/tools", summary="注册工具")
async def register_tool(
    body: dict,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: ToolService = Depends(get_tool_service),
) -> dict:
    from app.tools.schemas import CreateToolRequest

    req = CreateToolRequest(**body)
    tool = await service.register(ctx.tenant_id, req)
    return success(tool_to_dict(tool), trace_id=ctx.trace_id)


@router.get("/tools", summary="工具列表")
async def list_tools(
    request: Request,
    agentId: str = Query(...),
    enabledOnly: bool = Query(default=False),
    ctx: RequestContext = Depends(request_context_dep),
    service: ToolService = Depends(get_tool_service),
) -> dict:
    tools = await service.list(
        ctx.tenant_id, agentId, enabled_only=enabledOnly
    )
    return success(
        [tool_to_dict(t) for t in tools],
        trace_id=ctx.trace_id,
    )


@router.get("/tools/{tool_id}", summary="工具详情")
async def get_tool(
    tool_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: ToolService = Depends(get_tool_service),
) -> dict:
    tool = await service.get(ctx.tenant_id, tool_id)
    return success(tool_to_dict(tool), trace_id=ctx.trace_id)


@router.put("/tools/{tool_id}", summary="更新工具")
async def update_tool(
    tool_id: str,
    body: dict,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: ToolService = Depends(get_tool_service),
) -> dict:
    from app.tools.schemas import UpdateToolRequest

    req = UpdateToolRequest(**body)
    tool = await service.update(ctx.tenant_id, tool_id, req)
    return success(tool_to_dict(tool), trace_id=ctx.trace_id)


@router.post("/tools/{tool_id}/enable", summary="启用工具")
async def enable_tool(
    tool_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: ToolService = Depends(get_tool_service),
) -> dict:
    tool = await service.enable(ctx.tenant_id, tool_id)
    return success(tool_to_dict(tool), trace_id=ctx.trace_id)


@router.post("/tools/{tool_id}/disable", summary="禁用工具")
async def disable_tool(
    tool_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: ToolService = Depends(get_tool_service),
) -> dict:
    tool = await service.disable(ctx.tenant_id, tool_id)
    return success(tool_to_dict(tool), trace_id=ctx.trace_id)


@router.post("/tools/{tool_id}/invoke", summary="调用工具")
async def invoke_tool(
    tool_id: str,
    body: dict,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: ToolService = Depends(get_tool_service),
) -> dict:
    from app.tools.schemas import InvokeToolRequest

    req = InvokeToolRequest(**body)
    result = await service.invoke(
        ctx.tenant_id, tool_id, req.input, trace_id=ctx.trace_id
    )
    return success(result, trace_id=ctx.trace_id)


@router.delete("/tools/{tool_id}", summary="删除工具")
async def delete_tool(
    tool_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: ToolService = Depends(get_tool_service),
) -> dict:
    ok = await service.delete(ctx.tenant_id, tool_id)
    return success({"deleted": ok, "toolId": tool_id}, trace_id=ctx.trace_id)
