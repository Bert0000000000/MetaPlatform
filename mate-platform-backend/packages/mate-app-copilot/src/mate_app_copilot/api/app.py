"""FastAPI router exposing the copilot endpoints (FR-COPILOT-001..033).

33 endpoints under `/api/v1/copilot/*`. Every handler enforces
ADR-0014 step 2 (`require_tenant(ctx)`) before touching the
repository, except `/auth/login` which sits behind an anonymous path.

Write handlers emit `<domain>.<aggregate>.<verb>` outbox events via
`app.state.outbox_writer` (ADR-0014 step 3).
"""
from __future__ import annotations

import json
import re
import time
import uuid
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any

import os
import sqlparse
from fastapi import APIRouter, Body, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, select
from mate_app_arch.repositories import (  # pyright: ignore[reportMissingImports]
    list_capability_tree,
    list_data_assets,
    list_data_entities,
    list_data_flows,
)

from mate_clients.security.bearer import BearerAuth
from mate_platform.messaging.events import Event
from mate_platform.messaging.outbox import InMemoryOutboxWriter
from mate_platform.observability import journey_span  # noqa: F401  (used in handlers)
from mate_platform.tenancy.context import TenantId
from mate_platform.tenancy.guards import require_tenant
from mate_tech_db.base import get_session

from ..a2a.client import get_default_client as get_default_a2a_client
from ..a2a.models import DelegationRequest
from ..clients import AsyncCopilotClient
from ..clients.llmgw_stream import LlmgwStreamClient, LlmgwStreamError
from ..llm import stub_provider
from ..repositories import (
    AssetRecord,
    list_actions,
    list_assets,
    list_conversations,
    list_datasources,
    list_intents,
    list_knowledge_bases,
    list_models,
    list_plans,
    list_queries,
    list_templates,
    put_asset,
)
from ..repositories.sql_models import ConversationORM, MessageORM

router = APIRouter(prefix="/api/v1/copilot", tags=["copilot"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _tid(request: Request) -> str:
    ctx = request.state.ctx
    return str(require_tenant(ctx))


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _conv_orm_to_dict(orm: Any) -> dict[str, Any]:
    return {
        "id": orm.id,
        "title": orm.title,
        "mode": getattr(orm, "mode", "chat"),
        "favorite": getattr(orm, "favorite", False),
        "messageCount": orm.message_count,
        "createdAt": orm.created_at,
        "updatedAt": getattr(orm, "updated_at", orm.created_at),
        "preview": getattr(orm, "preview", orm.summary or ""),
    }


def _msg_orm_to_dict(orm: Any) -> dict[str, Any]:
    return {
        "id": orm.id,
        "conversationId": orm.conversation_id,
        "role": orm.role,
        "content": orm.content,
        "createdAt": orm.created_at,
        "metadata": json.loads(orm.metadata_json) if orm.metadata_json else {},
    }


def _emit(
    request: Request,
    event_type: str,
    aggregate_id: str,
    payload: dict[str, Any],
    tenant_id: str,
) -> None:
    """Append an outbox event if a writer is configured (no-op otherwise)."""
    writer: InMemoryOutboxWriter | None = getattr(
        request.app.state, "outbox_writer", None
    )
    if writer is None:
        return
    writer.append(
        Event.create(
            type=event_type,
            tenant_id=TenantId(tenant_id),
            aggregate_id=aggregate_id,
            payload=payload,
            trace_id=getattr(request.state.ctx, "trace_id", ""),
        )
    )


def _serialize(rows: list[Any]) -> list[dict[str, Any]]:
    return [asdict(r) for r in rows]


def _resp(rows: list[Any]) -> dict[str, Any]:
    items = _serialize(rows)
    return {"items": items, "total": len(items)}


def _paginate(rows: list[Any], page: int, size: int) -> dict[str, Any]:
    """Paginate a list of dataclass rows into a cursor-free page envelope."""
    items = _serialize(rows)
    total = len(items)
    pages = (total + size - 1) // size if size > 0 else 0
    start = (page - 1) * size
    end = start + size
    return {
        "items": items[start:end],
        "total": total,
        "page": page,
        "size": size,
        "pages": pages,
    }


def _get_client(request: Request) -> AsyncCopilotClient:
    """Return the configured AsyncCopilotClient or build a default one.

    In production the client is wired by the platform startup hook onto
    `app.state.copilot_client`. In tests / single-binary deployment it
    falls back to an in-process stub provider. Either way the call
    surface (embed / chat / generate_sql) is identical.

    The default base_url targets the API gateway (docker-compose service
    name + port 8100) so ontology bridge calls route to mate-tech-ont —
    the previous `http://localhost` fallback pointed at the copilot
    itself and every outbound call hit a dead endpoint.
    """
    client: AsyncCopilotClient | None = getattr(
        request.app.state, "copilot_client", None
    )
    if client is not None:
        return client

    return AsyncCopilotClient(
        base_url=os.getenv("MATE_GATEWAY_URL", "http://mate-api-gateway:8100"),
        auth=BearerAuth(
            token_uri=f"{os.getenv('KEYCLOAK_URL', 'http://keycloak:8080')}/realms/metaplatform/protocol/openid-connect/token",  # noqa: S106
            client_id="metaplatform-backend",
            client_secret="stub",  # noqa: S106
            scope="platform.read platform.write",
        ),
        provider=stub_provider,
    )


# Copilot 静态 action id → kernel ActionType rid 后缀映射（三大原理 #3）。
# 命中的 action 走 kernel apply（唯一合法写路径）；未命中的保持 emit-only
# （兼容既有 copilot 测试与纯通知类 action）。
_ONT_ACTION_SUFFIX: dict[str, str] = {
    "act-approve-leave": "approve-leave.v1",
    "act-close-ticket": "close-ticket.v1",
}


async def _apply_action_to_kernel(
    request: Request,
    action_id: str,
    params: dict[str, Any],
    tid: str,
) -> dict[str, Any] | None:
    """Try to apply the action in the kernel; return None if not mapped/failed.

    三大原理 #3：AI 输出 = proposal，用户确认后由 ActionType 落库。
    任何异常都吞掉并返回 None，调用方降级为 emit-only —— 桥接失败
    不能让用户可见的动作执行也失败。
    """
    suffix = _ONT_ACTION_SUFFIX.get(action_id)
    if not suffix:
        return None
    rid = f"ont.{tid}.act.{suffix}"
    try:
        client = _get_client(request)
        # 透传入站用户 token 作为降级认证（dev 环境 client_secret=stub
        # 无法通过 keycloak client_credentials；INSECURE_SKIP_SIGNATURE 下
        # gateway 直接接受）。生产环境配了真实 secret 后走服务身份。
        fallback_token = str(getattr(request.state.ctx, "authorization", "") or "")
        if not fallback_token:
            auth_header = request.headers.get("authorization", "")
            if auth_header.lower().startswith("bearer "):
                fallback_token = auth_header[7:].strip()
        return await client.ont_apply_action(
            rid=rid,
            tenant_id=tid,
            parameters=params,
            target_iid=params.pop("target_iid", "") if isinstance(params, dict) else "",
            provenance={"actor": str(getattr(request.state.ctx, "user_id", ""))},
            fallback_token=fallback_token or None,
        )
    except Exception:  # noqa: BLE001 — bridge failure degrades to emit-only
        return None


# --- Root (1) ---------------------------------------------------------------
@router.get("")
async def get_root(request: Request) -> dict[str, Any]:
    _tid(request)
    return {
        "service": "mate-app-copilot",
        "version": "0.1.0",
        "endpoints": 33,
    }


# --- Auth (1) ---------------------------------------------------------------
@router.post("/auth/login")
async def auth_login(request: Request) -> dict[str, Any]:
    # Anonymous path — do NOT call require_tenant here.
    ts = int(time.time())
    return {
        "access_token": f"stub-copilot-{ts}",
        "token_type": "Bearer",
        "expires_in": 3600,
        "user": {"id": "u-copilot", "name": "copilot-user", "role": "analyst"},
    }


# --- A2A (2) ----------------------------------------------------------------
@router.post("/a2a/delegate")
async def a2a_delegate(request: Request) -> dict[str, Any]:
    """Delegate a task to an A2A-compatible agent (TD-4 real implementation).

    Accepts ``{target_agent_id, message, context}`` and dispatches
    via the local ``InMemoryA2AClient``. The response carries the
    ``task_id``, ``status`` (``completed`` / ``failed``), the agent's
    ``result`` payload, and ``lineage_hints`` for cross-service
    correlation. Unknown agents return 404 (``E_AGENT_NOT_FOUND``).

    Emits ``copilot.a2a.delegated`` outbox event regardless of
    outcome — the audit log captures both successful and failed
    delegations.
    """
    tid = _tid(request)
    body = await request.json()

    target_agent_id = str(body.get("target_agent_id") or body.get("agentId", ""))
    message = str(body.get("message") or body.get("task", ""))
    context = body.get("context", {})
    if not isinstance(context, dict):
        context = {}
    trace_id = getattr(request.state.ctx, "trace_id", "")

    client = get_default_a2a_client()
    result = await client.delegate(
        DelegationRequest(
            target_agent_id=target_agent_id,
            message=message,
            context=context,
            tenant_id=tid,
            trace_id=trace_id,
        )
    )

    if result.status == "failed" and result.error_code == "E_AGENT_NOT_FOUND":
        # Surface unknown-agent as 404 so callers can distinguish
        # routing failures from execution failures.
        raise HTTPException(
            status_code=404,
            detail={
                "code": result.error_code,
                "message": result.error_message,
                "target_agent_id": target_agent_id,
            },
        )

    _emit(
        request,
        event_type="copilot.a2a.delegated",
        aggregate_id=result.task_id,
        payload={
            "task_id": result.task_id,
            "target_agent_id": target_agent_id,
            "status": result.status,
        },
        tenant_id=tid,
    )
    resp = asdict(result)
    # Backward-compat: expose `id` as an alias of `task_id` so
    # existing clients that key off `body["id"]` keep working.
    resp["id"] = result.task_id
    return resp


@router.get("/a2a/external")
async def a2a_external(
    request: Request,
    capability: str | None = Query(default=None),
) -> dict[str, Any]:
    """List external (federated) agent cards (TD-4 real implementation).

    Returns cards from the local ``AgentCardRegistry``, optionally
    filtered by ``capability`` (case-insensitive match against any
    entry in the card's ``capabilities`` tuple). The registry is
    tenant-scoped — cards from other tenants are never surfaced.
    """
    tid = _tid(request)

    client = get_default_a2a_client()
    cards = client.discover_agents(tid, capability=capability)
    items = [asdict(c) for c in cards]
    return {"items": items, "total": len(items)}


# --- Actions (3) ------------------------------------------------------------
@router.get("/actions")
async def get_actions(
    request: Request,
    keyword: str | None = Query(default=None),
) -> dict[str, Any]:
    tid = _tid(request)
    items = list_actions(tid)
    if keyword:
        kw = keyword.lower()
        items = [a for a in items if kw in a.name.lower() or any(kw in k for k in a.keywords)]
    return _resp(items)


@router.post("/actions/match")
async def match_actions(request: Request, body: dict[str, Any]) -> dict[str, Any]:
    tid = _tid(request)
    context = str(body.get("context") or body.get("query", ""))
    ctx_lower = context.lower()
    actions = list_actions(tid)
    matched = [
        a for a in actions
        if any(k in ctx_lower for k in a.keywords) or a.name.lower() in ctx_lower
    ]
    return {"matched": _serialize(matched), "total": len(matched)}


@router.post("/actions/{action_id}/execute")
async def execute_action(
    request: Request, action_id: str, body: dict[str, Any],
) -> dict[str, Any]:
    tid = _tid(request)
    actions = list_actions(tid)
    target = next((a for a in actions if a.id == action_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="action not found")
    params = dict(body.get("params", {}))
    result_id = f"res-{uuid.uuid4().hex[:8]}"
    kernel = await _apply_action_to_kernel(request, action_id, params, tid)
    output: dict[str, Any] = {"params": params}
    if kernel:
        # 三大原理 #3：kernel 落库成功 → 回显 applied_at + side_effects
        output.update({
            "applied_at": kernel.get("applied_at", ""),
            "side_effects_emitted": kernel.get("side_effects_emitted", []),
            "action_rid": kernel.get("action_rid", ""),
        })
    _emit(
        request,
        "copilot.action.executed",
        action_id,
        {"action_id": action_id, "result_id": result_id, "params": params},
        tid,
    )
    return {
        "action_id": action_id,
        "result_id": result_id,
        "status": "completed",
        "output": output,
    }


@router.post("/actions/execute")
async def execute_action_by_body(
    request: Request, body: dict[str, Any],
) -> dict[str, Any]:
    """Execute an action identified by body (FR-COPILOT-COPILOTPOSTCOPILOTACTIONSEXECUTE).

    Accepts ``action_id`` / ``actionId`` (preferred) or ``action_name``
    in the request body so callers can fire an action without embedding
    the id in the path. The frontend SuperAI Action 面板 sends camelCase
    ``actionId`` — both spellings are accepted. Mapped actions are
    applied in the ontology kernel (三大原理 #3); unmapped actions stay
    emit-only. Emits ``copilot.action.executed`` outbox event.
    """
    tid = _tid(request)
    actions = list_actions(tid)
    action_id = str(body.get("action_id") or body.get("actionId", ""))
    target = next((a for a in actions if a.id == action_id), None) if action_id else None
    if target is None:
        name = str(body.get("action_name", ""))
        target = next((a for a in actions if a.name == name), None) if name else None
        if target is not None:
            action_id = target.id
    if target is None:
        raise HTTPException(status_code=404, detail="action not found")
    params = dict(body.get("params", {}))
    result_id = f"res-{uuid.uuid4().hex[:8]}"
    kernel = await _apply_action_to_kernel(request, action_id, params, tid)
    output: dict[str, Any] = {"params": params}
    if kernel:
        # 三大原理 #3：kernel 落库成功 → 回显 applied_at + side_effects
        output.update({
            "applied_at": kernel.get("applied_at", ""),
            "side_effects_emitted": kernel.get("side_effects_emitted", []),
            "action_rid": kernel.get("action_rid", ""),
        })
    _emit(
        request,
        "copilot.action.executed",
        action_id,
        {"action_id": action_id, "result_id": result_id, "params": params},
        tid,
    )
    return {
        "action_id": action_id,
        "result_id": result_id,
        "status": "completed",
        "output": output,
    }


# --- Analysis SQL Copilot (4) ----------------------------------------------
@router.post("/analysis/explain-sql")
async def explain_sql(
    request: Request,
    body: dict = Body(...),
) -> dict[str, Any]:
    _tid(request)
    sql = body.get("sql", "")
    parsed = sqlparse.parse(sql)
    stmt = parsed[0] if parsed else None
    tables: list[str] = []
    columns: list[str] = []
    if stmt is not None:
        text = str(stmt)
        # crude table extraction after FROM / JOIN
        for match in re.findall(r"(?:FROM|JOIN)\s+([A-Za-z_][\w]*)", text, re.IGNORECASE):
            if match.lower() not in [t.lower() for t in tables]:
                tables.append(match)
        # crude column extraction between SELECT and FROM
        sel = re.search(r"SELECT\s+(.*?)\s+FROM", text, re.IGNORECASE | re.DOTALL)
        if sel:
            for raw in sel.group(1).split(","):
                name = raw.strip().split()[-1].strip("`\"'")
                if name != "*":
                    columns.append(name)
    # P2-W4: augment the parsed metadata with an LLM natural-language
    # explanation of what the SQL does.
    client = _get_client(request)
    op_type = stmt.get_type() if stmt else "unknown"
    explanation = client.chat(
        [
            {
                "role": "system",
                "content": "Explain what this SQL query does in one sentence.",
            },
            {"role": "user", "content": sql[:500]},
        ]
    ) if sql.strip() else f"No SQL provided (operation: {op_type})."
    return {
        "tables": tables,
        "columns": columns,
        "explanation": explanation,
    }


@router.post("/analysis/audit-sql")
async def audit_sql(request: Request, body: dict[str, Any]) -> dict[str, Any]:
    tid = _tid(request)
    sql = str(body.get("sql", ""))
    sqlparse.parse(sql)  # validate parseable
    issues: list[str] = []
    risk_level = "low"
    sql_upper = sql.strip().upper()
    if "SELECT *" in sql_upper:
        issues.append("SELECT * is discouraged; specify explicit columns")
        risk_level = "medium"
    if re.match(r"\s*DELETE\b", sql_upper, re.IGNORECASE) and "WHERE" not in sql_upper:
        issues.append("DELETE without WHERE clause is dangerous")
        risk_level = "high"
    if re.match(r"\s*(UPDATE|DROP|TRUNCATE)\b", sql_upper, re.IGNORECASE) and "WHERE" not in sql_upper:
        issues.append("Destructive statement without WHERE clause")
        risk_level = "high"
    _emit(
        request,
        "copilot.sql.audited",
        "audit",
        {"sql": sql, "risk_level": risk_level, "issues": issues},
        tid,
    )
    return {"risk_level": risk_level, "issues": issues}


@router.post("/analysis/execute-sql")
async def execute_sql(request: Request, body: dict[str, Any]) -> dict[str, Any]:
    tid = _tid(request)
    sql = str(body.get("sql", ""))
    sql_stripped = sql.strip()
    if not sql_stripped.upper().startswith("SELECT"):
        raise HTTPException(
            status_code=403,
            detail="Only SELECT statements are allowed in dry-run mode",
        )
    parsed = sqlparse.parse(sql)
    columns: list[str] = []
    if parsed:
        sel = re.search(r"SELECT\s+(.*?)\s+FROM", sql, re.IGNORECASE | re.DOTALL)
        if sel:
            for raw in sel.group(1).split(","):
                name = raw.strip().split()[-1].strip("`\"'")
                if name != "*":
                    columns.append(name)
    _emit(
        request,
        "copilot.query.executed",
        "dry-run",
        {"sql": sql, "columns": columns},
        tid,
    )
    return {"rows": 0, "columns": columns}


@router.post("/analysis/generate-sql")
async def generate_sql(request: Request, body: dict[str, Any]) -> dict[str, Any]:
    _tid(request)
    prompt = str(body.get("prompt", ""))
    tables = body.get("tables", [])
    if not isinstance(tables, list):
        tables = [str(tables)]
    tables_str = [str(t) for t in tables]
    # P2-W4: route through AsyncCopilotClient so the SQL generator can
    # move from stub_provider to the real llmgw adapter transparently.
    client = _get_client(request)
    sql = client.generate_sql(prompt, tables_str)
    return {"sql": sql}


# --- Chat (1) ---------------------------------------------------------------
@router.post("/chat/multimodal/upload")
async def multimodal_upload(request: Request, body: dict[str, Any]) -> dict[str, Any]:
    tid = _tid(request)
    filename = str(body.get("filename", "asset.bin"))
    content_type = str(body.get("content_type", "application/octet-stream"))
    asset_id = f"asset-{uuid.uuid4().hex[:8]}"
    # P2-W4: route embedding through the configured AsyncCopilotClient
    # so the same call site can swap stub_provider for the real llmgw
    # transport without touching this handler.
    client = _get_client(request)
    emb = client.embed([filename])[0]
    record = AssetRecord(
        id=asset_id,
        tenant_id=tid,
        filename=filename,
        content_type=content_type,
        embedding_dim=len(emb),
    )
    put_asset(tid, record)
    _emit(
        request,
        "copilot.multimodal.uploaded",
        asset_id,
        {"filename": filename, "content_type": content_type},
        tid,
    )
    _emit(
        request,
        "copilot.multimodal.indexed",
        asset_id,
        {"asset_id": asset_id, "embedding_dim": len(emb)},
        tid,
    )
    return {"asset_id": asset_id, "embedding_dim": len(emb)}


# --- Code (1) ---------------------------------------------------------------
@router.get("/code")
async def get_code(request: Request) -> dict[str, Any]:
    _tid(request)
    return {
        "language": "python",
        "framework": "fastapi",
        "snippet": (
            "from fastapi import FastAPI\n"
            "app = FastAPI()\n"
            "@app.get('/')\n"
            "async def root():\n"
            "    return {'hello': 'copilot'}\n"
        ),
    }


# --- Conversations (7) ------------------------------------------------------
@router.get("/conversations")
async def get_conversations(request: Request) -> dict[str, Any]:
    tid = _tid(request)
    # Read from PostgreSQL (merge with in-memory fallback)
    try:
        session = get_session()
        try:
            orms = session.query(ConversationORM).filter_by(tenant_id=tid).order_by(ConversationORM.created_at.desc()).all()
            db_items = [_conv_orm_to_dict(o) for o in orms]
            return {"items": db_items, "total": len(db_items)}
        finally:
            session.close()
    except Exception:
        # Fallback to in-memory if DB unavailable
        return _resp(list_conversations(tid))


@router.post("/conversations")
async def create_conversation(request: Request, body: dict = Body(...)) -> dict[str, Any]:
    tid = _tid(request)
    conv_id = f"conv-{uuid.uuid4().hex[:12]}"
    now = _now_iso()
    title = body.get("title", "新会话")
    mode = body.get("mode", "chat")
    session = get_session()
    try:
        orm = ConversationORM(
            id=conv_id, tenant_id=tid, title=title,
            summary="", message_count=0, created_at=now,
        )
        setattr(orm, "mode", mode)
        setattr(orm, "favorite", False)
        setattr(orm, "updated_at", now)
        setattr(orm, "preview", "")
        session.add(orm)
        session.commit()
        session.refresh(orm)
        _emit(request, "copilot.conversation.created", conv_id, {"title": title}, tid)
        return {"code": 0, "data": _conv_orm_to_dict(orm), "message": "ok"}
    finally:
        session.close()


@router.get("/conversations/{conv_id}")
async def get_conversation_detail(request: Request, conv_id: str) -> dict[str, Any]:
    tid = _tid(request)
    session = get_session()
    try:
        orm = session.query(ConversationORM).filter_by(id=conv_id, tenant_id=tid).first()
        if not orm:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return {"code": 0, "data": _conv_orm_to_dict(orm), "message": "ok"}
    finally:
        session.close()


@router.delete("/conversations/{conv_id}")
async def delete_conversation(request: Request, conv_id: str) -> dict[str, Any]:
    tid = _tid(request)
    session = get_session()
    try:
        orm = session.query(ConversationORM).filter_by(id=conv_id, tenant_id=tid).first()
        if orm:
            session.delete(orm)
            session.query(MessageORM).filter_by(conversation_id=conv_id).delete()
            session.commit()
            _emit(request, "copilot.conversation.deleted", conv_id, {}, tid)
        # Idempotent: return success even if not found
        return {"code": 0, "data": None, "message": "ok"}
    finally:
        session.close()


@router.post("/conversations/{conv_id}/favorite")
async def toggle_favorite(request: Request, conv_id: str) -> dict[str, Any]:
    tid = _tid(request)
    session = get_session()
    try:
        orm = session.query(ConversationORM).filter_by(id=conv_id, tenant_id=tid).first()
        if not orm:
            raise HTTPException(status_code=404, detail="Conversation not found")
        setattr(orm, "favorite", not getattr(orm, "favorite", False))
        setattr(orm, "updated_at", _now_iso())
        session.commit()
        session.refresh(orm)
        return {"code": 0, "data": _conv_orm_to_dict(orm), "message": "ok"}
    finally:
        session.close()


@router.get("/conversations/{conv_id}/messages")
async def get_messages(
    request: Request, conv_id: str, page: int = 1, pageSize: int = 50,
) -> dict[str, Any]:
    tid = _tid(request)
    session = get_session()
    try:
        q = select(MessageORM).filter_by(
            conversation_id=conv_id, tenant_id=tid,
        ).order_by(MessageORM.created_at)
        orms = session.execute(q).scalars().all()
        items = [_msg_orm_to_dict(o) for o in orms]
        return {
            "code": 0,
            "data": {"items": items, "total": len(items), "page": page, "size": pageSize},
            "message": "ok",
        }
    finally:
        session.close()


# --- Chat stream (1) --------------------------------------------------------
@router.post("/chat/completions/stream")
async def chat_completions_stream(
    request: Request, body: dict = Body(...),
) -> StreamingResponse:
    tid = _tid(request)
    uid = str(getattr(request.state, "user_id", "anonymous")) if hasattr(request, "state") else "anonymous"
    # ADR-0018 §2.2: open copilot.invoke journey span. The span lives
    # for the duration of this request; outcome is set before close.
    # We deliberately do NOT wrap the 140-line handler in a `with`
    # block (would force re-indent); instead we manually `.end()` in
    # the StreamingResponse teardown.
    from opentelemetry import trace as _ot_trace

    _span = _ot_trace.get_tracer("mate_app_copilot.journey").start_span(
        "copilot.invoke",
        attributes={
            "tenant.id": tid,
            "user.id": uid,
            "copilot.endpoint": "chat/completions/stream",
        },
    )
    _span.set_attribute("outcome", "success")
    request.state.copilot_span = _span
    messages = body.get("messages", [])
    model = body.get("model", "doubao-pro-32k")
    temperature = body.get("temperature", 0.7)
    max_tokens = body.get("maxTokens", body.get("max_tokens", 2048))
    conv_id = body.get("conversationId", "")

    # Save user message if we have a conversation
    if conv_id:
        session = get_session()
        try:
            user_msg = MessageORM(
                id=f"msg-{uuid.uuid4().hex[:12]}",
                conversation_id=conv_id,
                tenant_id=tid,
                role="user",
                content=messages[-1]["content"] if messages else "",
                created_at=_now_iso(),
                metadata_json=json.dumps({"model": model}),
            )
            session.add(user_msg)
            session.commit()
        finally:
            session.close()

    async def event_stream():
        full_response = ""
        # Build the streaming client. The host/port come from env so the
        # service is portable across docker-compose / staging / prod
        # (default targets the docker-compose service name + port 8008).
        llmgw_host = os.getenv("MATE_LLMGW_HOST", "mate-tech-llmgw")
        llmgw_port = int(os.getenv("MATE_LLMGW_PORT", "8008"))
        # dev 模式：keycloak client_credentials（stub secret）被拒，透传入站用户 token
        user_token = str(getattr(request.state.ctx, "authorization", "") or "")
        if not user_token:
            auth_header = request.headers.get("authorization", "")
            if auth_header.lower().startswith("bearer "):
                user_token = auth_header[7:].strip()
        stream_client = LlmgwStreamClient(
            host=llmgw_host,
            port=llmgw_port,
            auth=BearerAuth(
                token_uri=f"{os.getenv('KEYCLOAK_URL', 'http://keycloak:8080')}/realms/metaplatform/protocol/openid-connect/token",  # noqa: S106
                client_id="metaplatform-backend",
                client_secret="stub",  # noqa: S106
                scope="platform.read platform.write",
            ),
            tenant_id=tid,
            user_token=user_token or None,
        )
        # 后台 AI Provider 配置：按模型 provider 从 IAM 读 base_url + api_key
        # （如 MiniMax custom provider），透传给 llmgw 使真实调用可用。
        provider_cfg: dict[str, str] = {}
        try:
            client = _get_client(request)
            provider_cfg = await client.get_provider_config(
                tid, "custom", user_token or None
            )
        except Exception:  # noqa: BLE001
            provider_cfg = {}
        llm_provider = "custom" if provider_cfg.get("base_url") else "openai"
        llm_base_url = provider_cfg.get("base_url") or None
        llm_api_key = provider_cfg.get("api_key") or None
        try:
            async for line in stream_client.stream_chat_real(
                messages=messages,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                provider=llm_provider,
                base_url=llm_base_url,
                api_key=llm_api_key,
            ):
                # llmgw /chat/real 返回裸 JSON（{"content": "..."}）而非 SSE data: 行
                raw = line
                data = None
                if raw.startswith("data: "):
                    data = raw[6:]
                    if data == "[DONE]":
                        break
                elif raw.startswith("{"):
                    data = raw
                if data:
                    try:
                        chunk = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    text = ""
                    if "choices" in chunk:
                        text = chunk["choices"][0].get("delta", {}).get("content", "")
                    elif "data" in chunk and isinstance(chunk["data"], dict):
                        text = chunk["data"].get("text", "")
                    elif "content" in chunk:
                        text = chunk["content"]
                    if text:
                        full_response += text
                        openai_chunk = {
                            "choices": [{"delta": {"content": text}, "index": 0}],
                            "model": model,
                        }
                        yield f"data: {json.dumps(openai_chunk)}\n\n"

            # Fallback: non-streaming if llmgw stream returned nothing
            if not full_response:
                try:
                    data = await stream_client.chat_completion(
                        messages=messages,
                        model=model,
                        temperature=temperature,
                        provider=llm_provider,
                        base_url=llm_base_url,
                        api_key=llm_api_key,
                    )
                    full_response = data.get(
                        "content",
                        data.get("data", {}).get("content", "抱歉，我暂时无法回答。"),
                    )
                except LlmgwStreamError:
                    full_response = "抱歉，LLM 服务暂时不可用。"
                chunk = {
                    "choices": [{"delta": {"content": full_response}, "index": 0}],
                    "model": model,
                }
                yield f"data: {json.dumps(chunk)}\n\n"

        except LlmgwStreamError as e:
            full_response = f"（LLM 服务暂时不可用：{str(e)[:100]}）"
            chunk = {
                "choices": [{"delta": {"content": full_response}, "index": 0}],
                "model": model,
            }
            yield f"data: {json.dumps(chunk)}\n\n"
        except Exception as e:  # last-resort guard: never break the SSE stream
            full_response = f"（LLM 服务暂时不可用：{str(e)[:100]}）"
            chunk = {
                "choices": [{"delta": {"content": full_response}, "index": 0}],
                "model": model,
            }
            yield f"data: {json.dumps(chunk)}\n\n"

        # SSE end marker
        yield "data: [DONE]\n\n"

        # Persist assistant message + update conversation
        if conv_id and full_response:
            session = get_session()
            try:
                ai_msg = MessageORM(
                    id=f"msg-{uuid.uuid4().hex[:12]}",
                    conversation_id=conv_id,
                    tenant_id=tid,
                    role="assistant",
                    content=full_response,
                    created_at=_now_iso(),
                    metadata_json=json.dumps({"model": model}),
                )
                session.add(ai_msg)
                conv = session.query(ConversationORM).filter_by(id=conv_id).first()
                if conv:
                    conv.message_count = (conv.message_count or 0) + 2
                    setattr(conv, "preview", full_response[:100])
                    setattr(conv, "updated_at", _now_iso())
                session.commit()
            finally:
                session.close()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


def _copilot_span_finalize(span: Any, outcome: str) -> None:
    """Mark outcome + end the copilot.invoke span."""
    try:
        span.set_attribute("outcome", outcome)
        span.end()
    except Exception:  # pragma: no cover - defensive
        pass


# --- Datasources (1) --------------------------------------------------------
@router.get("/datasources")
async def get_datasources(request: Request) -> dict[str, Any]:
    return _resp(list_datasources(_tid(request)))


# --- Generate (4) -----------------------------------------------------------
@router.post("/generate/dashboard")
async def generate_dashboard(request: Request, body: dict[str, Any]) -> dict[str, Any]:
    _tid(request)
    name = str(body.get("name", "Untitled Dashboard"))
    # P2-W4: use client.chat to suggest widget titles based on the dashboard name
    client = _get_client(request)
    raw = client.chat(
        [
            {
                "role": "system",
                "content": "Suggest 4 dashboard widget titles, one per line.",
            },
            {"role": "user", "content": name[:200]},
        ]
    )
    titles = [t.strip() for t in raw.splitlines() if t.strip()][:4]
    if len(titles) < 2:
        titles = ["Total Revenue", "Trend", "Breakdown", "Top Items"]
    return {
        "name": name,
        "layout": "grid",
        "widgets": [
            {
                "type": "metric" if i == 0 else "chart",
                "title": titles[i],
                "position": {"row": i // 2, "col": i % 2},
            }
            for i in range(min(len(titles), 4))
        ],
    }


@router.post("/generate/explain-code")
async def explain_code(request: Request, body: dict[str, Any]) -> dict[str, Any]:
    _tid(request)
    code = str(body.get("code", ""))
    # P2-W4: drive the explanation through AsyncCopilotClient.chat so
    # the call site is transport-agnostic (stub today, llmgw tomorrow).
    client = _get_client(request)
    explanation = client.chat(
        [
            {"role": "system", "content": "You explain code clearly and concisely."},
            {"role": "user", "content": code[:2000]},
        ]
    )
    return {"explanation": explanation}


@router.post("/generate/form")
async def generate_form(request: Request, body: dict[str, Any]) -> dict[str, Any]:
    _tid(request)
    name = str(body.get("name", "Untitled Form"))
    fields = body.get("fields", [])
    if not isinstance(fields, list):
        fields = []
    return {
        "name": name,
        "fields": [
            {"name": str(f.get("name", f"field-{i}")), "type": str(f.get("type", "text"))}
            for i, f in enumerate(fields)
        ],
    }


@router.post("/generate/review-code")
async def review_code(request: Request, body: dict[str, Any]) -> dict[str, Any]:
    _tid(request)
    code = str(body.get("code", ""))
    # P2-W4: drive code review through AsyncCopilotClient.chat so the
    # review quality scales with the provider (stub today, llmgw tomorrow).
    client = _get_client(request)
    review = client.chat(
        [
            {
                "role": "system",
                "content": "Review the following code. List issues briefly, one per line.",
            },
            {"role": "user", "content": code[:2000]},
        ]
    )
    issues = [line.strip("- ").strip() for line in review.splitlines() if line.strip()]
    score = max(60, 95 - len(issues) * 5)
    return {"issues": issues, "score": score, "review": review}


@router.post("/generate/process")
async def get_generate_process(
    request: Request,
    body: dict = Body(...),
) -> dict[str, Any]:
    """List generation processes (FR-COPILOT-COPILOTGETCOPILOTGENERATEPROCESS).

    A generation process is backed by a copilot Plan in ``running`` /
    ``draft`` state; we surface the plan list as the process catalog.
    """
    page = body.get("page", 1)
    size = body.get("size", 20)
    rows = list_plans(_tid(request))
    return _paginate(rows, page, size)


# --- Knowledge-bases (1) ----------------------------------------------------
@router.get("/knowledge-bases")
async def get_knowledge_bases(request: Request) -> dict[str, Any]:
    tid = _tid(request)
    items = list_knowledge_bases(tid)
    if items:
        return _resp(items)
    # P2-W4: fallback to arch DataAssets as knowledge-base proxies
    assets = list_data_assets(tid)
    kb_items = [
        {"id": a.id, "name": a.name, "doc_count": 0}
        for a in assets[:5]
    ]
    return {"items": kb_items, "total": len(kb_items)}


# --- Models (1) -------------------------------------------------------------
@router.get("/models/multimodal")
async def get_multimodal_models(request: Request) -> dict[str, Any]:
    """返回可用模型清单。

    优先读 IAM ai_model 注册表（后台「获取模型」配置的真实模型），
    IAM 不可用时回退到 in_memory seed（保持既有行为）。
    """
    tid = _tid(request)
    try:
        client = _get_client(request)
        fallback_token = str(getattr(request.state.ctx, "authorization", "") or "")
        if not fallback_token:
            auth_header = request.headers.get("authorization", "")
            if auth_header.lower().startswith("bearer "):
                fallback_token = auth_header[7:].strip()
        items = await client.list_ai_models(tid, fallback_token or None)
        if items:
            mapped = [
                {
                    "modelId": i.get("model_id") or i.get("modelId") or "",
                    "name": i.get("display_name") or i.get("displayName")
                    or i.get("model_id") or i.get("modelId") or "",
                    "provider": i.get("provider", ""),
                    "modality": i.get("modality", "text"),
                    "enabled": i.get("enabled", True),
                }
                for i in items
                if i.get("enabled", True)
            ]
            return {"items": mapped, "total": len(mapped)}
    except Exception:  # noqa: BLE001 — IAM 不可用降级到 seed
        pass
    return _resp(list_models(tid))


# --- Ontology (3) -----------------------------------------------------------
@router.get("/ontology/concepts/search")
async def search_concepts(
    request: Request,
    keyword: str = Query(...),
) -> dict[str, Any]:
    tid = _tid(request)
    # P2-W4: pull concepts from arch Capability tree + DataEntity store
    concepts: list[dict[str, Any]] = []
    for cap in list_capability_tree(tid):
        concepts.append({"id": cap.id, "name": cap.name, "category": "capability"})
    for ent in list_data_entities(tid):
        concepts.append({"id": ent.id, "name": ent.name, "category": "entity"})
    kw = keyword.lower()
    matched = [c for c in concepts if kw in c["name"].lower()]
    return {"items": matched, "total": len(matched)}


@router.get("/ontology/graph/expand")
async def expand_graph(
    request: Request,
    node_id: str = Query(...),
) -> dict[str, Any]:
    tid = _tid(request)
    node_id = node_id or request.query_params.get("nodeId", "")
    # P2-W4: expand from arch Capability tree (parent → children)
    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    caps = list_capability_tree(tid)
    root = next((c for c in caps if c.id == node_id), None)
    if root:
        nodes.append({"id": root.id, "label": root.name})
    children = [c for c in caps if c.parent_id == node_id]
    for child in children:
        nodes.append({"id": child.id, "label": child.name})
        edges.append({"source": node_id, "target": child.id, "label": "contains"})
    # also pull data flows touching this node
    for flow in list_data_flows(tid):
        if node_id in {flow.source_entity_id, flow.target_entity_id}:
            for nid in (flow.source_entity_id, flow.target_entity_id):
                if not any(n["id"] == nid for n in nodes):
                    nodes.append({"id": nid, "label": nid})
            edges.append(
                {"source": flow.source_entity_id, "target": flow.target_entity_id, "label": flow.name}
            )
    if not nodes:
        nodes = [{"id": node_id, "label": node_id}]
    return {"nodes": nodes, "edges": edges}


@router.post("/ontology/graph/query")
async def query_graph(
    request: Request,
    body: dict = Body(...),
) -> dict[str, Any]:
    tid = _tid(request)
    cypher = body.get("cypher", "")
    # P2-W4: full graph from arch Capability tree + DataEntity store
    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    for cap in list_capability_tree(tid):
        nodes.append({"id": cap.id, "label": cap.name, "type": "capability"})
        if cap.parent_id:
            edges.append(
                {"source": cap.parent_id, "target": cap.id, "label": "contains"}
            )
    for ent in list_data_entities(tid):
        nodes.append({"id": ent.id, "label": ent.name, "type": "entity"})
    return {"nodes": nodes, "edges": edges}


# --- Plans (1) --------------------------------------------------------------
@router.get("/plans")
async def get_plans(request: Request) -> dict[str, Any]:
    return _resp(list_plans(_tid(request)))


# --- Queries (2) ------------------------------------------------------------
@router.post("/queries/execute")
async def execute_query(request: Request, body: dict[str, Any]) -> dict[str, Any]:
    tid = _tid(request)
    sql = str(body.get("sql", ""))
    datasource_id = str(body.get("datasource_id", "ds-1"))
    query_id = f"q-{uuid.uuid4().hex[:8]}"
    _emit(
        request,
        "copilot.query.executed",
        query_id,
        {"sql": sql, "datasource_id": datasource_id},
        tid,
    )
    return {"query_id": query_id, "rows": [{"id": 1, "result": "dry-run"}]}


@router.get("/queries/history")
async def query_history(request: Request) -> dict[str, Any]:
    return _resp(list_queries(_tid(request)))


# --- Scheduling (5) ---------------------------------------------------------
@router.post("/scheduling/employees/match")
async def match_employees(
    request: Request,
    body: dict = Body(...),
) -> dict[str, Any]:
    _tid(request)
    task_type = body.get("task_type", body.get("taskType", ""))
    employees: list[dict[str, Any]] = [
        {"id": "emp-1", "name": "Finance Recon Bot", "skills": ["finance", "reconciliation"]},
        {"id": "emp-2", "name": "CRM Archivist", "skills": ["crm", "data"]},
        {"id": "emp-3", "name": "KB Curator", "skills": ["knowledge", "indexing"]},
    ]
    tt = task_type.lower()
    matched = [e for e in employees if any(tt in s for s in e["skills"])]
    # P2-W4: if no keyword match, use client.chat to suggest the best employee
    if not matched and task_type.strip():
        client = _get_client(request)
        names = ", ".join(e["name"] for e in employees)
        raw = client.chat(
            [
                {
                    "role": "system",
                    "content": f"Which of these employees best fits the task? Reply with just the name. Options: {names}",
                },
                {"role": "user", "content": task_type[:200]},
            ]
        )
        raw_lower = raw.strip().lower()
        for e in employees:
            if e["name"].lower() in raw_lower:
                matched = [e]
                break
    return {"items": matched, "total": len(matched)}


@router.post("/scheduling/execution/start")
async def start_execution(request: Request, body: dict[str, Any]) -> dict[str, Any]:
    tid = _tid(request)
    plan_id = str(body.get("plan_id", "plan-1"))
    execution_id = f"exec-{uuid.uuid4().hex[:8]}"
    _emit(
        request,
        "copilot.scheduling.started",
        execution_id,
        {"plan_id": plan_id, "execution_id": execution_id},
        tid,
    )
    return {"execution_id": execution_id, "status": "running"}


@router.post("/scheduling/intent/detect")
async def detect_intent(request: Request, body: dict[str, Any]) -> dict[str, Any]:
    tid = _tid(request)
    text = str(body.get("text", ""))
    text_lower = text.lower()
    intents = list_intents(tid)
    best_name = "unknown"
    best_conf = 0.0
    # Fast-path: keyword matching against seeded intents
    for intent in intents:
        for kw in intent.keywords:
            if kw in text_lower:
                best_name = intent.name
                best_conf = 0.9
                break
        if best_conf > 0:
            break
    # P2-W4: if keyword matching missed, use client.chat for NLU fallback
    if best_conf == 0.0 and text.strip():
        client = _get_client(request)
        intent_names = ", ".join(i.name for i in intents) or "general"
        raw = client.chat(
            [
                {
                    "role": "system",
                    "content": f"Classify the user's intent into one of: {intent_names}. Reply with just the intent name.",
                },
                {"role": "user", "content": text[:500]},
            ]
        )
        matched = raw.strip().lower()
        for intent in intents:
            if intent.name.lower() in matched:
                best_name = intent.name
                best_conf = 0.7
                break
        if best_conf == 0.0:
            best_name = raw.strip()[:50] or "unknown"
            best_conf = 0.5
    return {"intent": best_name, "confidence": best_conf}


@router.get("/scheduling/intents")
async def get_intents(request: Request) -> dict[str, Any]:
    return _resp(list_intents(_tid(request)))


@router.post("/scheduling/plan/generate")
async def generate_plan(request: Request, body: dict[str, Any]) -> dict[str, Any]:
    _tid(request)
    goal = str(body.get("goal", ""))
    plan_id = f"plan-{uuid.uuid4().hex[:8]}"
    # P2-W4: drive plan generation through AsyncCopilotClient.chat so
    # the plan quality scales with the provider.
    client = _get_client(request)
    raw = client.chat(
        [
            {
                "role": "system",
                "content": "Break down the goal into 3-5 actionable steps. One step per line.",
            },
            {"role": "user", "content": goal[:500]},
        ]
    )
    steps = [s.strip("- ").strip() for s in raw.splitlines() if s.strip()]
    if not steps:
        steps = [f"Analyze goal: {goal[:40]}", "Gather data", "Execute", "Verify"]
    return {"plan_id": plan_id, "steps": steps}


@router.get("/scheduling/templates")
async def get_scheduling_templates(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    """List scheduling templates (FR-COPILOT-COPILOTGETCOPILOTSCHEDULINGTEMPLATES).

    Templates are reusable plan skeletons; we surface the copilot
    Template catalog, optionally filtered by category.
    """
    rows = list_templates(_tid(request))
    return _paginate(rows, page, size)


# --- Search (1) -------------------------------------------------------------
@router.post("/search")
async def search(
    request: Request,
    body: dict = Body(...),
) -> dict[str, Any]:
    tid = _tid(request)
    q = body.get("q", body.get("query", ""))
    # P2-W4: semantic search using client.embed to compute a similarity
    # score between the query and known asset filenames in the tenant.
    client = _get_client(request)
    query_vec = client.embed([q])[0]
    assets = list_assets(tid)
    results: list[dict[str, Any]] = []
    for asset in assets:
        asset_vec = client.embed([asset.filename])[0]
        # cosine similarity (simplified — dot product of normalized stubs)
        dot = sum(a * b for a, b in zip(query_vec[:64], asset_vec[:64], strict=False))
        score = min(0.99, max(0.01, dot))
        results.append(
            {"id": asset.id, "title": asset.filename, "type": "asset", "score": round(score, 4)}
        )
    results.sort(key=lambda r: r["score"], reverse=True)
    return {"results": results[:10]}
