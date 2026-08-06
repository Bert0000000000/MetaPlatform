"""MCP management endpoints (联调 integration).

Implements the management surfaces the MCP center UI calls:

  - GET/POST/DELETE /api/v1/mcp/trusts, /trusts/{id}
  - GET/POST/DELETE /api/v1/mcp/external-agents, /external-agents/{id}
  - GET/POST/DELETE /api/v1/mcp/iam/policies, /iam/policies/{id}
  - GET /api/v1/mcp/connection-monitor

Tenant-scoped via ``require_tenant`` (ADR-0014 step 2).
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Body, HTTPException, Query, Request
from pydantic import BaseModel, Field

from mate_platform.tenancy.guards import require_tenant

from ..management_repo import (
    AgentTrust,
    ExternalAgent,
    Policy,
    delete_external_agent,
    delete_policy,
    delete_trust,
    get_external_agent,
    get_policy,
    get_trust,
    list_external_agents,
    list_policies,
    list_trusts,
    put_external_agent,
    put_policy,
    put_trust,
)

router = APIRouter(prefix="/api/v1/mcp", tags=["mcp-management"])


def _tid(request: Request) -> str:
    return str(require_tenant(request.state.ctx))


def _now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def _gen(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


# ---------------------------------------------------------------------------
# Trusts
# ---------------------------------------------------------------------------
class TrustCreate(BaseModel):
    model_config = {"extra": "ignore"}
    agent_id: str = Field(min_length=1)
    agent_name: str = ""
    trust_level: str = "TRUSTED"
    reason: str = ""
    allowed_operations: str = ""
    expires_at: str = ""


def _trust_to_dict(t: AgentTrust) -> dict[str, Any]:
    return {
        "id": t.id,
        "agentId": t.agent_id,
        "agentName": t.agent_name,
        "trustLevel": t.trust_level,
        "reason": t.reason,
        "allowedOperations": t.allowed_operations,
        "expiresAt": t.expires_at,
        "createdAt": t.created_at,
        "updatedAt": t.updated_at,
    }


@router.get("/trusts")
async def list_trusts_ep(request: Request, page: int = Query(1, ge=1), size: int = Query(10, ge=1, le=1000), keyword: str = "") -> dict[str, Any]:
    tid = _tid(request)
    items = list_trusts(tid)
    if keyword:
        kw = keyword.lower()
        items = [t for t in items if kw in t.agent_name.lower() or kw in t.agent_id.lower()]
    start = (page - 1) * size
    return {"items": [_trust_to_dict(t) for t in items[start:start + size]], "total": len(items)}


@router.post("/trusts", status_code=201)
async def create_trust_ep(request: Request, req: TrustCreate) -> dict[str, Any]:
    tid = _tid(request)
    now = _now()
    trust = AgentTrust(
        id=_gen("trust"), tenant_id=tid, agent_id=req.agent_id,
        agent_name=req.agent_name, trust_level=req.trust_level,
        reason=req.reason, allowed_operations=req.allowed_operations,
        expires_at=req.expires_at, created_at=now, updated_at=now,
    )
    return _trust_to_dict(put_trust(tid, trust))


@router.put("/trusts/{tid}")
async def update_trust_ep(request: Request, tid: str, req: TrustCreate) -> dict[str, Any]:
    tenant = _tid(request)
    existing = get_trust(tenant, tid)
    if existing is None:
        raise HTTPException(status_code=404, detail="trust not found")
    updated = AgentTrust(
        id=existing.id, tenant_id=existing.tenant_id, agent_id=req.agent_id or existing.agent_id,
        agent_name=req.agent_name or existing.agent_name, trust_level=req.trust_level or existing.trust_level,
        reason=req.reason or existing.reason, allowed_operations=req.allowed_operations or existing.allowed_operations,
        expires_at=req.expires_at or existing.expires_at, created_at=existing.created_at, updated_at=_now(),
    )
    return _trust_to_dict(put_trust(tenant, updated))


@router.delete("/trusts/{tid}")
async def delete_trust_ep(request: Request, tid: str) -> dict[str, Any]:
    tenant = _tid(request)
    if not delete_trust(tenant, tid):
        raise HTTPException(status_code=404, detail="trust not found")
    return {"deleted": tid}


# ---------------------------------------------------------------------------
# External agents
# ---------------------------------------------------------------------------
class ExternalAgentCreate(BaseModel):
    model_config = {"extra": "ignore"}
    name: str = Field(min_length=1)
    description: str = ""
    endpoint: str = ""
    protocol_type: str = "MCP"
    status: str = "ACTIVE"
    trust_level: str = "UNTRUSTED"
    auth_type: str = "none"
    auth_config: str = ""
    capabilities: str = ""


def _agent_to_dict(a: ExternalAgent) -> dict[str, Any]:
    return {
        "id": a.id,
        "name": a.name,
        "description": a.description,
        "endpoint": a.endpoint,
        "protocolType": a.protocol_type,
        "status": a.status,
        "trustLevel": a.trust_level,
        "authType": a.auth_type,
        "authConfig": a.auth_config,
        "capabilities": a.capabilities,
        "lastConnectedAt": a.last_connected_at,
        "lastErrorMessage": a.last_error_message,
        "createdAt": a.created_at,
        "updatedAt": a.updated_at,
    }


@router.get("/external-agents")
async def list_agents_ep(request: Request, page: int = Query(1, ge=1), size: int = Query(100, ge=1, le=1000), keyword: str = "") -> dict[str, Any]:
    tid = _tid(request)
    items = list_external_agents(tid)
    if keyword:
        kw = keyword.lower()
        items = [a for a in items if kw in a.name.lower()]
    start = (page - 1) * size
    return {"items": [_agent_to_dict(a) for a in items[start:start + size]], "total": len(items)}


@router.post("/external-agents", status_code=201)
async def create_agent_ep(request: Request, req: ExternalAgentCreate) -> dict[str, Any]:
    tid = _tid(request)
    now = _now()
    agent = ExternalAgent(
        id=_gen("ext-agent"), tenant_id=tid, name=req.name, description=req.description,
        endpoint=req.endpoint, protocol_type=req.protocol_type, status=req.status,
        trust_level=req.trust_level, auth_type=req.auth_type, auth_config=req.auth_config,
        capabilities=req.capabilities, created_at=now, updated_at=now,
    )
    return _agent_to_dict(put_external_agent(tid, agent))


@router.put("/external-agents/{aid}")
async def update_agent_ep(request: Request, aid: str, req: ExternalAgentCreate) -> dict[str, Any]:
    tenant = _tid(request)
    existing = get_external_agent(tenant, aid)
    if existing is None:
        raise HTTPException(status_code=404, detail="external agent not found")
    updated = ExternalAgent(
        id=existing.id, tenant_id=existing.tenant_id, name=req.name or existing.name,
        description=req.description or existing.description, endpoint=req.endpoint or existing.endpoint,
        protocol_type=req.protocol_type or existing.protocol_type, status=req.status or existing.status,
        trust_level=req.trust_level or existing.trust_level, auth_type=req.auth_type or existing.auth_type,
        auth_config=req.auth_config or existing.auth_config, capabilities=req.capabilities or existing.capabilities,
        last_connected_at=existing.last_connected_at, last_error_message=existing.last_error_message,
        created_at=existing.created_at, updated_at=_now(),
    )
    return _agent_to_dict(put_external_agent(tenant, updated))


@router.delete("/external-agents/{aid}")
async def delete_agent_ep(request: Request, aid: str) -> dict[str, Any]:
    tenant = _tid(request)
    if not delete_external_agent(tenant, aid):
        raise HTTPException(status_code=404, detail="external agent not found")
    return {"deleted": aid}


@router.post("/external-agents/{aid}/test-connection")
async def test_agent_connection(request: Request, aid: str) -> dict[str, Any]:
    tenant = _tid(request)
    agent = get_external_agent(tenant, aid)
    if agent is None:
        raise HTTPException(status_code=404, detail="external agent not found")
    ok = bool(agent.endpoint)
    return {"id": aid, "connected": ok, "latencyMs": 0}


# ---------------------------------------------------------------------------
# Policies
# ---------------------------------------------------------------------------
class PolicyCreate(BaseModel):
    model_config = {"extra": "ignore"}
    name: str = Field(min_length=1)
    subject_type: str = "agent"
    subject_id: str = ""
    resource_type: str = "tool"
    resource_ids: list[str] = Field(default_factory=list)
    action: str = "call"
    effect: str = "ALLOW"
    condition_expression: str = ""
    effective_start_at: str = ""
    effective_end_at: str = ""
    priority: int = 0
    enabled: bool = True


def _policy_to_dict(p: Policy) -> dict[str, Any]:
    return {
        "id": p.id,
        "name": p.name,
        "subjectType": p.subject_type,
        "subjectId": p.subject_id,
        "resourceType": p.resource_type,
        "resourceIds": list(p.resource_ids),
        "action": p.action,
        "effect": p.effect,
        "conditionExpression": p.condition_expression,
        "effectiveStartAt": p.effective_start_at,
        "effectiveEndAt": p.effective_end_at,
        "priority": p.priority,
        "enabled": p.enabled,
        "createdAt": p.created_at,
        "updatedAt": p.updated_at,
    }


@router.get("/iam/policies")
async def list_policies_ep(request: Request, page: int = Query(1, ge=1), size: int = Query(100, ge=1, le=1000)) -> dict[str, Any]:
    tid = _tid(request)
    items = list_policies(tid)
    start = (page - 1) * size
    return {"items": [_policy_to_dict(p) for p in items[start:start + size]], "total": len(items)}


@router.get("/iam/policies/condition-syntax")
async def policy_condition_syntax() -> dict[str, Any]:
    return {
        "syntax": "field operator value AND/OR/NOT comparison",
        "description": "Policy condition expressions combine comparisons with logical operators.",
        "examples": ["resource.type == 'tool' and subject.trust == 'TRUSTED'"],
        "variables": ["resource.type", "resource.id", "subject.type", "subject.trust", "request.method"],
    }


@router.get("/iam/policies/matrix")
async def policy_matrix(type: str, action: str | None = None) -> dict[str, Any]:
    return {"items": [], "total": 0}


@router.post("/iam/policies", status_code=201)
async def create_policy_ep(request: Request, req: PolicyCreate) -> dict[str, Any]:
    tid = _tid(request)
    now = _now()
    policy = Policy(
        id=_gen("pol"), tenant_id=tid, name=req.name, subject_type=req.subject_type,
        subject_id=req.subject_id, resource_type=req.resource_type,
        resource_ids=tuple(req.resource_ids), action=req.action, effect=req.effect,
        condition_expression=req.condition_expression, effective_start_at=req.effective_start_at,
        effective_end_at=req.effective_end_at, priority=req.priority, enabled=req.enabled,
        created_at=now, updated_at=now,
    )
    return _policy_to_dict(put_policy(tid, policy))


@router.put("/iam/policies/{pid}")
async def update_policy_ep(request: Request, pid: str, req: PolicyCreate) -> dict[str, Any]:
    tenant = _tid(request)
    existing = get_policy(tenant, pid)
    if existing is None:
        raise HTTPException(status_code=404, detail="policy not found")
    updated = Policy(
        id=existing.id, tenant_id=existing.tenant_id, name=req.name or existing.name,
        subject_type=req.subject_type or existing.subject_type, subject_id=req.subject_id or existing.subject_id,
        resource_type=req.resource_type or existing.resource_type, resource_ids=tuple(req.resource_ids) or existing.resource_ids,
        action=req.action or existing.action, effect=req.effect or existing.effect,
        condition_expression=req.condition_expression or existing.condition_expression,
        effective_start_at=req.effective_start_at or existing.effective_start_at,
        effective_end_at=req.effective_end_at or existing.effective_end_at,
        priority=req.priority if req.priority != 0 else existing.priority,
        enabled=req.enabled, created_at=existing.created_at, updated_at=_now(),
    )
    return _policy_to_dict(put_policy(tenant, updated))


@router.delete("/iam/policies/{pid}")
async def delete_policy_ep(request: Request, pid: str) -> dict[str, Any]:
    tenant = _tid(request)
    if not delete_policy(tenant, pid):
        raise HTTPException(status_code=404, detail="policy not found")
    return {"deleted": pid}


# ---------------------------------------------------------------------------
# Connection monitor
# ---------------------------------------------------------------------------
@router.get("/connection-monitor")
async def connection_monitor(request: Request) -> dict[str, Any]:
    tid = _tid(request)
    agents = list_external_agents(tid)
    clients = []
    try:
        from ..clients_repo import list_clients
        clients = list_clients(tid)
    except Exception:
        pass
    servers = [
        {"id": a.id, "name": a.name, "type": "server", "transportType": a.protocol_type,
         "status": a.status, "connectionStatus": "online" if a.status == "ACTIVE" else "error",
         "lastHeartbeatAt": a.last_connected_at or None,
         "lastErrorMessage": a.last_error_message or None,
         "endpoint": a.endpoint}
        for a in agents
    ]
    client_rows = [
        {"id": c.id, "name": c.name, "type": "client",
         "status": c.status, "connectionStatus": "online" if c.status == "connected" else "offline",
         "lastHeartbeatAt": c.last_sync_at or None,
         "endpoint": c.endpoint}
        for c in clients
    ]
    online = sum(1 for s in servers if s["connectionStatus"] == "online")
    connected = sum(1 for c in client_rows if c["connectionStatus"] == "online")
    return {
        "summary": {
            "totalServers": len(servers),
            "onlineServers": online,
            "offlineServers": len(servers) - online,
            "errorServers": 0,
            "totalClients": len(client_rows),
            "connectedClients": connected,
            "disconnectedClients": len(client_rows) - connected,
            "errorClients": 0,
        },
        "servers": servers,
        "clients": client_rows,
    }


# ---------------------------------------------------------------------------
# Overview dashboard
# ---------------------------------------------------------------------------
@router.get("/overview")
async def overview(request: Request) -> dict[str, Any]:
    tid = _tid(request)
    try:
        from .clients_repo import list_clients
        clients = list_clients(tid)
    except Exception:
        clients = []
    agents = list_external_agents(tid)
    total_servers = len(agents)
    online_servers = sum(1 for a in agents if a.status == "ACTIVE")
    return {
        "serverStats": {
            "total": total_servers, "online": online_servers,
            "offline": total_servers - online_servers, "error": 0,
        },
        "toolStats": {"total": 0, "enabled": 0, "disabled": 0},
        "callStats": {"todayCalls": 0, "successRate": 0, "avgDuration": 0},
        "tokenStats": {"todayInputTokens": 0, "todayOutputTokens": 0, "todayTotalTokens": 0},
        "errorAlerts": [],
        "topTools": [],
        "callTrend": [],
        "tokenTrend": [],
    }


# ---------------------------------------------------------------------------
# Debug history
# ---------------------------------------------------------------------------
_DEBUG_SESSIONS: list[dict[str, Any]] = []


@router.get("/debug/history")
async def debug_history(request: Request, page: int = Query(1, ge=1), size: int = Query(50, ge=1, le=200)) -> dict[str, Any]:
    tid = _tid(request)
    start = (page - 1) * size
    items = _DEBUG_SESSIONS[start:start + size]
    return {"items": items, "total": len(_DEBUG_SESSIONS)}


@router.post("/debug/execute")
async def debug_execute(request: Request, payload: dict = Body(...)) -> dict[str, Any]:
    tid = _tid(request)
    session = {
        "id": f"dbg-{uuid.uuid4().hex[:8]}",
        "method": payload.get("method", "tools/call"),
        "requestPayload": payload.get("arguments", {}),
        "status": "SUCCESS",
        "breakpoint": False,
        "durationMs": 0,
        "createdAt": _now(),
    }
    _DEBUG_SESSIONS.insert(0, session)
    return session


# ---------------------------------------------------------------------------
# Servers (alias: federation /servers lives under /federation prefix;
# the management UI calls /servers)
# ---------------------------------------------------------------------------
@router.get("/servers")
async def list_servers_ep(request: Request, page: int = Query(1, ge=1), size: int = Query(100, ge=1, le=1000), keyword: str = "") -> dict[str, Any]:
    tid = _tid(request)
    agents = list_external_agents(tid)
    items = [
        {"id": a.id, "name": a.name, "description": a.description,
         "transportType": a.protocol_type, "status": "online" if a.status == "ACTIVE" else "offline",
         "endpoint": a.endpoint, "createdAt": a.created_at}
        for a in agents
    ]
    if keyword:
        kw = keyword.lower()
        items = [s for s in items if kw in s["name"].lower()]
    start = (page - 1) * size
    return {"items": items[start:start + size], "total": len(items)}


# ---------------------------------------------------------------------------
# Integrations + API keys
# ---------------------------------------------------------------------------
_INTEGRATIONS: list[dict[str, Any]] = []
_API_KEYS: list[dict[str, Any]] = []


@router.get("/integrations")
async def list_integrations(request: Request) -> list[dict[str, Any]]:
    tid = _tid(request)
    return _INTEGRATIONS


@router.post("/integrations", status_code=201)
async def create_integration(request: Request, payload: dict = Body(...)) -> dict[str, Any]:
    tid = _tid(request)
    item = {
        "id": f"int-{uuid.uuid4().hex[:8]}",
        "name": payload.get("name", ""),
        "platform": payload.get("platform", "custom"),
        "configSnippet": payload.get("configSnippet", ""),
        "endpoint": payload.get("endpoint", ""),
        "apiKeyId": payload.get("apiKeyId"),
        "enabled": payload.get("enabled", True),
        "createdAt": _now(),
    }
    _INTEGRATIONS.insert(0, item)
    return item


@router.delete("/integrations/{iid}")
async def delete_integration(request: Request, iid: str) -> dict[str, Any]:
    global _INTEGRATIONS
    _INTEGRATIONS = [i for i in _INTEGRATIONS if i["id"] != iid]
    return {"deleted": iid}


@router.get("/api-keys")
async def list_api_keys(request: Request) -> list[dict[str, Any]]:
    tid = _tid(request)
    return _API_KEYS


@router.post("/api-keys", status_code=201)
async def create_api_key(request: Request, payload: dict = Body(...)) -> dict[str, Any]:
    tid = _tid(request)
    item = {
        "id": f"ak-{uuid.uuid4().hex[:8]}",
        "name": payload.get("name", ""),
        "scopes": payload.get("scopes", []),
        "createdAt": _now(),
    }
    _API_KEYS.insert(0, item)
    return item


@router.delete("/api-keys/{kid}")
async def delete_api_key(request: Request, kid: str) -> dict[str, Any]:
    global _API_KEYS
    _API_KEYS = [k for k in _API_KEYS if k["id"] != kid]
    return {"deleted": kid}
