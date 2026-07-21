"""Digital Worker (Employee) projection endpoints over Agent entities."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.agents.schemas import (
    AgentStatus,
    CreateAgentRequest,
    UpdateAgentRequest,
    to_dict,
)
from app.agents.service import AgentService
from app.common.api_response import build_page, success
from app.common.context import RequestContext, request_context_dep
from app.common.errors import InvalidParamError
from app.deps import get_agent_service

router = APIRouter(tags=["employees"])


# Employee status values expected by APP-DW
class EmployeeStatus:
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    ARCHIVED = "ARCHIVED"


class RoleCategory:
    FINANCE = "FINANCE"
    HR = "HR"
    LEGAL = "LEGAL"
    DATA_ANALYST = "DATA_ANALYST"
    CUSTOMER_SERVICE = "CUSTOMER_SERVICE"
    CUSTOM = "CUSTOM"


def _employee_status(agent_status: str) -> str:
    mapping = {
        AgentStatus.DRAFT.value: EmployeeStatus.DRAFT,
        AgentStatus.ACTIVE.value: EmployeeStatus.ACTIVE,
        AgentStatus.DISABLED.value: EmployeeStatus.INACTIVE,
    }
    return mapping.get(agent_status, EmployeeStatus.DRAFT)


def _infer_role_category(code: str, name: str) -> str:
    text = f"{code} {name}".lower()
    if any(k in text for k in ("contract", "legal", "law", "合规", "法务", "合同")):
        return RoleCategory.LEGAL
    if any(k in text for k in ("finance", "财务", "报销", "发票", "预算", "合同")):
        return RoleCategory.FINANCE
    if any(k in text for k in ("hr", "人事", "招聘", "考勤", "员工")):
        return RoleCategory.HR
    if any(k in text for k in ("data", "report", "分析", "报表", "统计", "日报")):
        return RoleCategory.DATA_ANALYST
    if any(k in text for k in ("service", "客服", "售后", "支持")):
        return RoleCategory.CUSTOMER_SERVICE
    return RoleCategory.CUSTOM


def _agent_to_employee(agent_dict: dict) -> dict:
    """Project an Agent dict to the Employee shape expected by APP-DW."""

    status = _employee_status(agent_dict.get("status", AgentStatus.DRAFT.value))
    code = agent_dict.get("code", "")
    name = agent_dict.get("name", "")
    role_category = _infer_role_category(code, name)

    return {
        "employeeId": agent_dict.get("agentId"),
        "tenantId": agent_dict.get("tenantId"),
        "name": name,
        "code": code,
        "roleCategory": role_category,
        "roleIdentity": agent_dict.get("description") or name,
        "description": agent_dict.get("description", ""),
        "avatar": None,
        "status": status,
        "capability": {
            "model": agent_dict.get("modelId", "doubao-lite"),
            "temperature": agent_dict.get("temperature", 0.7),
            "maxTokens": agent_dict.get("maxTokens", 4096),
            "topP": 0.9,
            "systemPrompt": agent_dict.get("systemPrompt", ""),
            "tools": agent_dict.get("tools", []),
            "ragKnowledgeBaseIds": agent_dict.get("ragScopes", []),
            "retrievalMethod": "hybrid",
            "topK": 5,
            "rerank": False,
        },
        "createdAt": agent_dict.get("createdAt"),
        "updatedAt": agent_dict.get("updatedAt"),
        "createdBy": None,
        "updatedBy": None,
    }


def _parse_status(value: Optional[str]) -> Optional[AgentStatus]:
    if value is None:
        return None
    try:
        return AgentStatus(value.upper())
    except ValueError as exc:
        raise InvalidParamError(
            f"不支持的 Agent 状态: {value}",
            data={"allowed": [s.value for s in AgentStatus]},
        ) from exc


def _employee_status_to_agent(value: Optional[str]) -> Optional[AgentStatus]:
    if value is None:
        return None
    mapping = {
        EmployeeStatus.DRAFT: AgentStatus.DRAFT,
        EmployeeStatus.ACTIVE: AgentStatus.ACTIVE,
        EmployeeStatus.INACTIVE: AgentStatus.DISABLED,
        EmployeeStatus.ARCHIVED: AgentStatus.DISABLED,
    }
    agent_status = mapping.get(value.upper())
    if agent_status is None:
        raise InvalidParamError(
            f"不支持的 Employee 状态: {value}",
            data={"allowed": [EmployeeStatus.DRAFT, EmployeeStatus.ACTIVE, EmployeeStatus.INACTIVE, EmployeeStatus.ARCHIVED]},
        )
    return agent_status


@router.get("/employees", summary="数字员工列表(分页)")
async def list_employees(
    request: Request,
    keyword: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    roleCategory: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    ctx: RequestContext = Depends(request_context_dep),
    service: AgentService = Depends(get_agent_service),
) -> dict:
    agent_status = _parse_status(status)
    items, total = await service.list(
        ctx.tenant_id,
        status=agent_status,
        page=page,
        page_size=pageSize,
    )

    employees = [_agent_to_employee(to_dict(i)) for i in items]
    if keyword:
        keyword_lower = keyword.lower()
        employees = [
            e for e in employees
            if keyword_lower in e["name"].lower()
            or keyword_lower in e["code"].lower()
            or keyword_lower in e["description"].lower()
        ]
    if roleCategory:
        employees = [e for e in employees if e["roleCategory"] == roleCategory]

    paged = build_page(
        employees,
        total=len(employees),
        page=page,
        page_size=pageSize,
    )
    return success(paged, trace_id=ctx.trace_id)


@router.get("/employees/{employee_id}", summary="数字员工详情")
async def get_employee(
    employee_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: AgentService = Depends(get_agent_service),
) -> dict:
    agent = await service.get(ctx.tenant_id, employee_id)
    return success(_agent_to_employee(to_dict(agent)), trace_id=ctx.trace_id)


@router.post("/employees", summary="创建数字员工")
async def create_employee(
    request: Request,
    body: CreateAgentRequest,
    ctx: RequestContext = Depends(request_context_dep),
    service: AgentService = Depends(get_agent_service),
) -> dict:
    agent = await service.create(ctx.tenant_id, body, created_by=ctx.user_id)
    return success(_agent_to_employee(to_dict(agent)), trace_id=ctx.trace_id)


@router.put("/employees/{employee_id}", summary="更新数字员工")
async def update_employee(
    employee_id: str,
    request: Request,
    body: UpdateAgentRequest,
    ctx: RequestContext = Depends(request_context_dep),
    service: AgentService = Depends(get_agent_service),
) -> dict:
    agent = await service.update(
        ctx.tenant_id, employee_id, body, updated_by=ctx.user_id
    )
    return success(_agent_to_employee(to_dict(agent)), trace_id=ctx.trace_id)


@router.put("/employees/{employee_id}/status", summary="更新数字员工状态")
async def update_employee_status(
    employee_id: str,
    request: Request,
    status: dict,
    ctx: RequestContext = Depends(request_context_dep),
    service: AgentService = Depends(get_agent_service),
) -> dict:
    agent_status = _employee_status_to_agent(status.get("status"))
    body = UpdateAgentRequest(status=agent_status)
    agent = await service.update(
        ctx.tenant_id, employee_id, body, updated_by=ctx.user_id
    )
    return success(_agent_to_employee(to_dict(agent)), trace_id=ctx.trace_id)


@router.delete("/employees/{employee_id}", summary="删除数字员工")
async def delete_employee(
    employee_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: AgentService = Depends(get_agent_service),
) -> dict:
    ok = await service.delete(
        ctx.tenant_id, employee_id, deleted_by=ctx.user_id
    )
    return success({"deleted": ok, "employeeId": employee_id}, trace_id=ctx.trace_id)
