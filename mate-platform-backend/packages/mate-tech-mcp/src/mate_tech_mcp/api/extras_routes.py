"""MCP center extra routes (audit + collaborations + tools/{id}/versions + aliases).

填补 MCP 中心 UI 调用的、但 mate-tech-mcp 尚未实现的端点。
全部用 tenant-scoped 内存 stub + 合理结构返回（不引入新依赖），
不引入 PG / Kafka / 新 schema。后续批次如有持久化需求再升级。

覆盖：

  - /api/v1/mcp/audit/logs            GET
  - /api/v1/mcp/audit/logs/{id}        GET
  - /api/v1/mcp/audit/statistics       GET
  - /api/v1/mcp/audit/trends           GET
  - /api/v1/mcp/audit/analytics        GET
  - /api/v1/mcp/audit/{id}/trace       GET
  - /api/v1/mcp/audit/export           GET
  - /api/v1/mcp/collaborations/logs    GET
  - /api/v1/mcp/collaborations/logs/{id} GET
  - /api/v1/mcp/collaborations         POST
  - /api/v1/mcp/tools/{tid}/versions             GET
  - /api/v1/mcp/tools/{tid}/versions/{vid}       GET
  - /api/v1/mcp/tools/{tid}/versions/{vid}/rollback        POST
  - /api/v1/mcp/tools/{tid}/versions/{vid}/set-current     POST
  - /api/v1/mcp/tools/{tid}/versions/compare    GET
  - /api/v1/mcp/resources/{rid}        GET / PUT / DELETE
  - /api/v1/mcp/servers/{sid}          GET
  - /api/v1/mcp/servers/{sid}/status   GET
  - /api/v1/mcp/permissions            GET / POST   (alias for /iam/policies)

tenant 通过 require_tenant(ADR-0014) 强制隔离；
所有 mutating 端点都是 stub（只回 echo），
读端点返回合理空结构以便前端不再 404。
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Query, Request, Response
from mate_platform.tenancy.guards import require_tenant
from pydantic import BaseModel, Field

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/mcp", tags=["mcp-extras"])


def _tid(request: Request) -> str:
    return str(require_tenant(request.state.ctx))


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _gen(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


# ---------------------------------------------------------------------------
# Audit (list / detail / stats / trends / analytics / trace / export)
# ---------------------------------------------------------------------------
@router.get("/audit/logs")
async def list_audit_logs(
    request: Request,
    toolId: str = "",
    serverId: str = "",
    clientId: str = "",
    status: str = "",
    startTime: str = "",
    endTime: str = "",
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=200),
) -> dict[str, Any]:
    """Audit 日志查询 — 当前未持久化，返回空分页。"""
    _tid(request)
    return {
        "items": [],
        "total": 0,
        "page": page,
        "size": size,
        "totalPages": 0,
    }


@router.get("/audit/logs/{aid}")
async def get_audit_log(request: Request, aid: str) -> dict[str, Any]:
    """Audit 日志详情 — 未持久化返回 404。"""
    _tid(request)
    raise HTTPException(status_code=404, detail="audit log not found")


@router.get("/audit/statistics")
async def audit_statistics(
    request: Request,
    startTime: str = "",
    endTime: str = "",
) -> dict[str, Any]:
    """Audit 统计 — 返回空结构，前端按字段名取值即可。"""
    _tid(request)
    return {
        "totalCount": 0,
        "successCount": 0,
        "errorCount": 0,
        "avgDurationMs": 0,
        "totalInputTokens": 0,
        "totalOutputTokens": 0,
        "byTool": [],
        "byStatus": [],
        "byServer": [],
        "byClient": [],
    }


@router.get("/audit/trends")
async def audit_trends(
    request: Request,
    startTime: str = "",
    endTime: str = "",
    granularity: str = "hour",
) -> list[dict[str, Any]]:
    """Audit 时序 — 返回空数组。"""
    _tid(request)
    return []


@router.get("/audit/analytics")
async def audit_analytics(
    request: Request,
    dimension: str = "tool",
    startTime: str = "",
    endTime: str = "",
) -> list[dict[str, Any]]:
    """Audit 维度聚合 — 返回空数组。"""
    _tid(request)
    return []


@router.get("/audit/{aid}/trace")
async def audit_trace(request: Request, aid: str) -> list[dict[str, Any]]:
    """Audit trace 链路 — 返回空数组。"""
    _tid(request)
    return []


@router.get("/audit/export")
async def audit_export(
    request: Request,
    format: str = "csv",
    startTime: str = "",
    endTime: str = "",
) -> Response:
    """Audit 导出 — 返回空 CSV。"""
    _tid(request)
    if format == "csv":
        content = "id,timestamp,toolId,serverId,clientId,status,durationMs\n"
        return Response(
            content=content,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=audit-logs.csv"},
        )
    return Response(content="[]", media_type="application/json")


# ---------------------------------------------------------------------------
# Collaborations (A2A 跨 Agent 协作日志)
# ---------------------------------------------------------------------------
@router.get("/collaborations/logs")
async def list_collaboration_logs(
    request: Request,
    callerId: str = "",
    calleeId: str = "",
    protocolType: str = "",
    status: str = "",
    startTime: str = "",
    endTime: str = "",
    traceId: str = "",
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=200),
) -> dict[str, Any]:
    """Collaboration 日志 — 返回空分页。"""
    _tid(request)
    return {
        "items": [],
        "total": 0,
        "page": page,
        "size": size,
        "totalPages": 0,
    }


@router.get("/collaborations/logs/{cid}")
async def get_collaboration_log(request: Request, cid: str) -> dict[str, Any]:
    """Collaboration 详情 — 未持久化返回 404。"""
    _tid(request)
    raise HTTPException(status_code=404, detail="collaboration log not found")


class CollaborationCreate(BaseModel):
    model_config = {"extra": "ignore"}
    callerId: str = Field(min_length=1)
    calleeId: str = Field(min_length=1)
    protocolType: str = "A2A"
    status: str = "SUCCESS"
    note: str = ""


@router.post("/collaborations", status_code=201)
async def create_collaboration(
    request: Request, req: CollaborationCreate
) -> dict[str, Any]:
    """Collaboration 写入 — stub 回显。"""
    _tid(request)
    return {
        "id": _gen("col"),
        **req.model_dump(),
        "createdAt": _now(),
    }


# ---------------------------------------------------------------------------
# Tools /versions 系列 — 工具版本管理（stub）
# ---------------------------------------------------------------------------
@router.get("/tools/{name}")
async def get_tool_detail(request: Request, name: str) -> dict[str, Any]:
    """工具详情（origin_routes.py 只有 POST/PUT/DELETE，前端
    ToolDetailPage / ToolEditPage 调 GET，name == frontend id）。"""
    tid = _tid(request)
    from ..repositories import get_tool_by_name

    tool = get_tool_by_name(tid, name)
    if tool is None:
        raise HTTPException(status_code=404, detail=f"tool '{name}' not found")
    return {
        "id": tool.name,
        "name": tool.name,
        "code": tool.name,
        "category": tool.category,
        "version": tool.version,
        "description": tool.description,
        "inputSchema": tool.input_schema,
        "outputSchema": tool.output_schema,
        "toolType": tool.tool_type,
        "endpoint": tool.endpoint,
        "beanClass": tool.bean_class,
        "enabled": tool.enabled,
    }


@router.get("/tools/{tid}/versions")
async def list_tool_versions(request: Request, tid: str) -> list[dict[str, Any]]:
    """工具版本列表 — 当前未持久化，返回空数组。"""
    _tid(request)
    return []


@router.get("/tools/{tid}/versions/{vid}")
async def get_tool_version(request: Request, tid: str, vid: str) -> dict[str, Any]:
    """工具版本详情 — 未持久化返回 404。"""
    _tid(request)
    raise HTTPException(status_code=404, detail="tool version not found")


@router.post("/tools/{tid}/versions/{vid}/rollback")
async def rollback_tool_version(
    request: Request, tid: str, vid: str
) -> dict[str, Any]:
    """回滚到指定版本 — stub。"""
    _tid(request)
    raise HTTPException(status_code=404, detail="tool version not found")


@router.post("/tools/{tid}/versions/{vid}/set-current")
async def set_current_tool_version(
    request: Request, tid: str, vid: str
) -> dict[str, Any]:
    """设为当前版本 — stub。"""
    _tid(request)
    raise HTTPException(status_code=404, detail="tool version not found")


@router.get("/tools/{tid}/versions/compare")
async def compare_tool_versions(
    request: Request,
    tid: str,
    leftVersionId: str = "",
    rightVersionId: str = "",
) -> dict[str, Any]:
    """版本对比 — stub。"""
    _tid(request)
    return {"left": {}, "right": {}, "differences": []}


# ---------------------------------------------------------------------------
# Resources /{rid} — 资源详情 stub（origin_routes.py 只有 list）
# ---------------------------------------------------------------------------
@router.get("/resources/{rid}")
async def get_resource(request: Request, rid: str) -> dict[str, Any]:
    """资源详情 — 未持久化返回 404。"""
    _tid(request)
    raise HTTPException(status_code=404, detail="resource not found")


@router.put("/resources/{rid}")
async def update_resource(request: Request, rid: str) -> dict[str, Any]:
    """资源更新 — stub。"""
    _tid(request)
    raise HTTPException(status_code=404, detail="resource not found")


@router.delete("/resources/{rid}")
async def delete_resource(request: Request, rid: str) -> dict[str, Any]:
    """资源删除 — stub。"""
    _tid(request)
    raise HTTPException(status_code=404, detail="resource not found")


# ---------------------------------------------------------------------------
# Servers /{sid} + /status — 服务详情 stub
# ---------------------------------------------------------------------------
@router.get("/servers/{sid}")
async def get_server(request: Request, sid: str) -> dict[str, Any]:
    """Server 详情 — 复用 external-agent 数据（management_routes.py
    已经把 external-agent 当作 MCP server 注册）。"""
    tid = _tid(request)
    from ..management_repo import get_external_agent

    agent = get_external_agent(tid, sid)
    if agent is None:
        raise HTTPException(status_code=404, detail="server not found")
    return {
        "id": agent.id,
        "name": agent.name,
        "description": agent.description,
        "transportType": agent.protocol_type,
        "status": "online" if agent.status == "ACTIVE" else "offline",
        "endpoint": agent.endpoint,
        "lastConnectedAt": agent.last_connected_at,
        "createdAt": agent.created_at,
    }


@router.get("/servers/{sid}/status")
async def get_server_status(request: Request, sid: str) -> dict[str, Any]:
    """Server 实时状态 — 返回 unknown（agent 层无心跳）。"""
    tid = _tid(request)
    from ..management_repo import get_external_agent

    agent = get_external_agent(tid, sid)
    if agent is None:
        raise HTTPException(status_code=404, detail="server not found")
    return {
        "id": sid,
        "status": "unknown",
        "lastCheckedAt": _now(),
        "uptimeSec": 0,
        "requestCount": 0,
        "errorRate": 0.0,
    }


# ---------------------------------------------------------------------------
# Permissions — /iam/policies 别名（前端 permissions.ts 在用）
# ---------------------------------------------------------------------------
@router.get("/permissions")
async def list_permissions_alias(
    request: Request,
    page: int = Query(1, ge=1),
    size: int = Query(100, ge=1, le=1000),
    keyword: str = "",
) -> dict[str, Any]:
    """Permission rules — 与 /iam/policies 同源（同一 in-memory store）。"""
    from ..management_repo import list_policies

    tid = _tid(request)
    items = list_policies(tid)
    if keyword:
        kw = keyword.lower()
        items = [p for p in items if kw in p.name.lower()]
    start = (page - 1) * size
    return {
        "items": [
            {
                "id": p.id,
                "name": p.name,
                "subjectType": p.subject_type,
                "subjectId": p.subject_id,
                "resourceType": p.resource_type,
                "resourceIds": list(p.resource_ids),
                "action": p.action,
                "effect": p.effect,
                "conditionExpression": p.condition_expression,
                "priority": p.priority,
                "enabled": p.enabled,
                "createdAt": p.created_at,
                "updatedAt": p.updated_at,
            }
            for p in items[start : start + size]
        ],
        "total": len(items),
        "page": page,
        "size": size,
    }


class PermissionCreate(BaseModel):
    model_config = {"extra": "ignore"}
    name: str = Field(min_length=1)
    subjectType: str = "AGENT"
    subjectId: str = ""
    resourceType: str = "TOOL"
    resourceIds: list[str] = Field(default_factory=list)
    action: str = "INVOKE"
    effect: str = "ALLOW"
    conditionExpression: str = ""
    priority: int = 100
    enabled: bool = True


@router.post("/permissions", status_code=201)
async def create_permission_alias(
    request: Request, req: PermissionCreate
) -> dict[str, Any]:
    """Create permission rule — alias for /iam/policies POST。"""
    from ..management_repo import Policy, put_policy

    tid = _tid(request)
    now = _now()
    policy = Policy(
        id=_gen("pol"),
        tenant_id=tid,
        name=req.name,
        subject_type=req.subjectType,
        subject_id=req.subjectId,
        resource_type=req.resourceType,
        resource_ids=tuple(req.resourceIds),
        action=req.action,
        effect=req.effect,
        condition_expression=req.conditionExpression,
        effective_start_at="",
        effective_end_at="",
        priority=req.priority,
        enabled=req.enabled,
        created_at=now,
        updated_at=now,
    )
    saved = put_policy(tid, policy)
    return {
        "id": saved.id,
        "name": saved.name,
        "subjectType": saved.subject_type,
        "subjectId": saved.subject_id,
        "resourceType": saved.resource_type,
        "resourceIds": list(saved.resource_ids),
        "action": saved.action,
        "effect": saved.effect,
        "conditionExpression": saved.condition_expression,
        "priority": saved.priority,
        "enabled": saved.enabled,
        "createdAt": saved.created_at,
        "updatedAt": saved.updated_at,
    }


@router.put("/permissions/{pid}")
async def update_permission_alias(
    request: Request, pid: str, req: PermissionCreate
) -> dict[str, Any]:
    """Update permission rule — alias for /iam/policies PUT。"""
    from ..management_repo import Policy, get_policy, put_policy

    tid = _tid(request)
    existing = get_policy(tid, pid)
    if existing is None:
        raise HTTPException(status_code=404, detail="permission not found")
    now = _now()
    updated = Policy(
        id=pid,
        tenant_id=tid,
        name=req.name,
        subject_type=req.subjectType,
        subject_id=req.subjectId,
        resource_type=req.resourceType,
        resource_ids=tuple(req.resourceIds),
        action=req.action,
        effect=req.effect,
        condition_expression=req.conditionExpression,
        effective_start_at=existing.effective_start_at,
        effective_end_at=existing.effective_end_at,
        priority=req.priority,
        enabled=req.enabled,
        created_at=existing.created_at,
        updated_at=now,
    )
    saved = put_policy(tid, updated)
    return {
        "id": saved.id,
        "name": saved.name,
        "subjectType": saved.subject_type,
        "subjectId": saved.subject_id,
        "resourceType": saved.resource_type,
        "resourceIds": list(saved.resource_ids),
        "action": saved.action,
        "effect": saved.effect,
        "conditionExpression": saved.condition_expression,
        "priority": saved.priority,
        "enabled": saved.enabled,
        "createdAt": saved.created_at,
        "updatedAt": saved.updated_at,
    }


@router.delete("/permissions/{pid}", status_code=204)
async def delete_permission_alias(request: Request, pid: str) -> Response:
    """Delete permission rule — alias for /iam/policies DELETE。"""
    from ..management_repo import delete_policy

    tid = _tid(request)
    if not delete_policy(tid, pid):
        raise HTTPException(status_code=404, detail="permission not found")
    return Response(status_code=204)