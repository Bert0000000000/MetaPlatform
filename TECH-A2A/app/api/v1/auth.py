"""Agent Authentication endpoints (P3-A2A-11/15)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from app.audit.schemas import AuditAction
from app.audit.service import AuditService
from app.auth.service import AuthService
from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_audit_service, get_auth_service

router = APIRouter(tags=["auth"])


class GenerateApiKeyRequest(BaseModel):
    agentId: str = Field(min_length=1, max_length=128)
    permissions: list[str] = Field(default_factory=list)


class UpdatePermissionsRequest(BaseModel):
    permissions: list[str] = Field(default_factory=list)


@router.post("/auth/api-keys", summary="生成 API Key")
async def generate_api_key(
    body: GenerateApiKeyRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    auth: AuthService = Depends(get_auth_service),
    audit: AuditService = Depends(get_audit_service),
) -> dict:
    result = await auth.generate_api_key(
        ctx.tenant_id,
        body.agentId,
        permissions=body.permissions,
    )
    await audit.record_audit(
        ctx.tenant_id,
        AuditAction.API_KEY_GENERATED,
        target_id=body.agentId,
        details={"keyId": result["keyId"]},
        trace_id=ctx.trace_id,
    )
    return success(result, trace_id=ctx.trace_id)


@router.delete("/auth/api-keys/{key_id}", summary="撤销 API Key")
async def revoke_api_key(
    key_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    auth: AuthService = Depends(get_auth_service),
    audit: AuditService = Depends(get_audit_service),
) -> dict:
    ok = await auth.revoke_api_key(key_id)
    await audit.record_audit(
        ctx.tenant_id,
        AuditAction.API_KEY_REVOKED,
        target_id=key_id,
        trace_id=ctx.trace_id,
    )
    return success({"revoked": ok, "keyId": key_id}, trace_id=ctx.trace_id)


@router.get("/auth/api-keys", summary="API Key 列表")
async def list_api_keys(
    request: Request,
    agentId: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    auth: AuthService = Depends(get_auth_service),
) -> dict:
    keys = await auth.list_api_keys(ctx.tenant_id, agent_id=agentId)
    return success(keys, trace_id=ctx.trace_id)


@router.put("/auth/api-keys/{key_id}/permissions", summary="更新 API Key 权限")
async def update_key_permissions(
    key_id: str,
    body: UpdatePermissionsRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    auth: AuthService = Depends(get_auth_service),
) -> dict:
    result = await auth.update_key_permissions(key_id, body.permissions)
    return success(result, trace_id=ctx.trace_id)
