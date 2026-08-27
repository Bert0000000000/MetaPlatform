"""FastAPI router exposing the copilot endpoints (FR-COPILOT-001..033).

33 endpoints under `/api/v1/copilot/*`. Every handler enforces
ADR-0014 step 2 (`require_tenant(ctx)`) before touching the
repository, except `/auth/login` which sits behind an anonymous path.

Write handlers emit `<domain>.<aggregate>.<verb>` outbox events via
`app.state.outbox_writer` (ADR-0014 step 3).
"""
from __future__ import annotations

import json
import os
import re
import time
import uuid
from dataclasses import asdict
from datetime import UTC, datetime
from typing import Any

import sqlparse
from fastapi import APIRouter, Body, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse
from mate_app_arch.repositories import (  # pyright: ignore[reportMissingImports]
    list_capability_tree,
    list_data_assets,
    list_data_entities,
    list_data_flows,
)
from sqlalchemy import select
from sqlparse.sql import Identifier, IdentifierList, TokenList
from sqlparse.tokens import DDL, DML, Comment

from mate_clients.security.bearer import BearerAuth
from mate_platform.messaging.events import Event
from mate_platform.messaging.outbox import InMemoryOutboxWriter
from mate_platform.observability import journey_span  # noqa: F401  (used in handlers)
from mate_platform.tenancy.context import TenantId
from mate_platform.tenancy.guards import require_tenant
from mate_tech_db.base import get_session

from ..a2a.client import get_default_client as get_default_a2a_client
from ..a2a.models import DelegationRequest
from ..agent_loop import run_agent_loop
from ..clients import AsyncCopilotClient
from ..clients.llmgw_stream import LlmgwStreamClient, LlmgwStreamError
from ..clients.orchestrator_client import OrchestratorClient, OrchestratorClientError
from ..dispatcher import (
    dispatch_by_routing,
    make_embedding_match_handler,
    make_keyword_substring_handler,
)
from ..llm import stub_provider
from ..repositories import (
    AssetRecord,
    Conversation,
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
    put_conversation,
)
from ..repositories import (
    delete_conversation as in_memory_delete_conversation,
)
from ..repositories.sql_models import ConversationORM, MessageORM

router = APIRouter(prefix="/api/v1/copilot", tags=["copilot"])

_COPILOT_STREAM_MAX_MESSAGE_BYTES = 1_000_000
_PROMPT_LEAK_SAFE_MESSAGE = "抱歉，无法提供内部系统指令。"
_PROMPT_LEAK_LITERALS = (
    "MATE_SYSTEM_PROMPT",
    "MATE_SYSTEM_PROMPT_CANARY_DO_NOT_LEAK",
    "[Session Context]",
)
_PROMPT_LEAK_PATTERNS = (
    re.compile(r"(?i)(?:system|developer|internal)\s+(?:prompt|instruction)s?\s*[:：]"),
    re.compile(r"(?:系统提示|系统指令|开发者指令)\s*[:：]"),
)


def _llmgw_timeout_seconds() -> float:
    """Return the bounded LLM Gateway request timeout.

    Production keeps the existing long-running default, while contract and
    adversarial tests can use a short deterministic timeout when no LLMGW is
    provisioned.  Invalid configuration fails safe to the production default
    instead of turning a chat request into a 500 before the stream starts.
    """
    raw = os.getenv("MATE_LLMGW_TIMEOUT_SECONDS", "120").strip()
    try:
        return max(0.1, float(raw))
    except ValueError:
        return 120.0


def _copilot_client_timeout_seconds() -> float:
    """Return the timeout for Copilot's auxiliary service lookups."""
    raw = os.getenv("MATE_COPILOT_CLIENT_TIMEOUT_SECONDS", "5").strip()
    try:
        return max(0.1, float(raw))
    except ValueError:
        return 5.0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _tid(request: Request) -> str:
    ctx = request.state.ctx
    return str(require_tenant(ctx))


def _mark_deprecated(response: Response) -> None:
    """A3 吸收标记：scheduling 编排入口已迁移到 mate-tech-orchestrator。"""
    response.headers["Deprecation"] = "true"
    response.headers["X-Sunset"] = "2026-12-31"
    response.headers["X-Migrated-To"] = "/api/v1/orchestrator/scheduling/*"


def _uid(request: Request) -> str:
    """当前用户 ID（JWT sub）。会话/消息按 tenant + user 两级隔离。"""
    ctx = request.state.ctx
    return str(getattr(ctx, "user_id", "") or "")


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _record_copilot_guard_event(
    request: Request,
    *,
    name: str,
    details: dict[str, Any],
) -> None:
    span = getattr(request.state, "copilot_span", None)
    if span is None:
        return
    try:
        span.add_event(name, details)
    except Exception:
        pass


def _serialized_message_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if content is None:
        return ""
    try:
        return json.dumps(content, ensure_ascii=False, separators=(",", ":"))
    except (TypeError, ValueError):
        return str(content)


def _last_user_message_content(messages: list[dict[str, Any]]) -> str:
    for message in reversed(messages):
        if message.get("role") == "user":
            return _serialized_message_content(message.get("content"))
    return ""


def _validate_stream_message_envelope(
    request: Request,
    *,
    messages: Any,
    endpoint: str,
) -> list[dict[str, Any]]:
    if not isinstance(messages, list):
        raise HTTPException(status_code=422, detail="messages must be a list")

    payload = json.dumps(messages, ensure_ascii=False, separators=(",", ":"))
    payload_bytes = len(payload.encode("utf-8"))
    if payload_bytes > _COPILOT_STREAM_MAX_MESSAGE_BYTES:
        _record_copilot_guard_event(
            request,
            name="copilot.input_guard.blocked",
            details={
                "endpoint": endpoint,
                "payload_bytes": payload_bytes,
                "limit_bytes": _COPILOT_STREAM_MAX_MESSAGE_BYTES,
            },
        )
        raise HTTPException(
            status_code=413,
            detail=(
                "messages payload too large; "
                f"limit is {_COPILOT_STREAM_MAX_MESSAGE_BYTES} bytes"
            ),
        )

    normalized: list[dict[str, Any]] = []
    for index, message in enumerate(messages):
        if not isinstance(message, dict):
            raise HTTPException(
                status_code=422,
                detail=f"messages[{index}] must be an object",
            )
        normalized.append(message)
    return normalized


def _contains_prompt_leak(text: str) -> bool:
    if not text:
        return False
    upper_text = text.upper()
    for literal in _PROMPT_LEAK_LITERALS:
        if literal.upper() in upper_text:
            return True
    return any(pattern.search(text) for pattern in _PROMPT_LEAK_PATTERNS)


class _StreamingOutputGuard:
    """Stage provider output until the complete response passes leak checks.

    SSE cannot retract bytes already sent to a client, so a safe-looking prefix
    must not be emitted before a later provider chunk has been checked.
    """

    def __init__(self) -> None:
        self._in_think = False
        self._think_buf = ""
        self._candidate = ""
        self._buffered_chunks: list[str] = []
        self._full_response = ""
        self.blocked = False

    @property
    def full_response(self) -> str:
        return self._full_response if not self.blocked else _PROMPT_LEAK_SAFE_MESSAGE

    def consume(self, text: str) -> list[str]:
        if self.blocked or not text:
            return []
        cleaned = self._strip_stream_think(text)
        if not cleaned:
            return []
        self._candidate += cleaned
        if _contains_prompt_leak(self._candidate):
            self.blocked = True
            self._candidate = ""
            self._buffered_chunks.clear()
            return []
        self._buffered_chunks.append(cleaned)
        return []

    def finalize(self) -> list[str]:
        if self.blocked:
            return [_PROMPT_LEAK_SAFE_MESSAGE]
        if _contains_prompt_leak(self._candidate):
            self.blocked = True
            self._candidate = ""
            self._buffered_chunks.clear()
            return [_PROMPT_LEAK_SAFE_MESSAGE]
        if not self._buffered_chunks:
            return []
        chunks = self._buffered_chunks
        self._buffered_chunks = []
        self._candidate = ""
        self._full_response = "".join(chunks)
        return chunks

    def _strip_stream_think(self, text: str) -> str:
        if self._in_think:
            self._think_buf += text
            end = self._think_buf.find("</think>")
            if end == -1:
                return ""
            self._in_think = False
            text = self._think_buf[end + len("</think>"):]
            self._think_buf = ""
            if not text:
                return ""

        start = text.find("<think>")
        if start == -1:
            return text

        before = text[:start]
        rest = text[start + len("<think>"):]
        end = rest.find("</think>")
        if end != -1:
            return before + rest[end + len("</think>"):]

        self._in_think = True
        self._think_buf = rest
        return before


def _sanitize_copilot_response_text(
    request: Request,
    *,
    endpoint: str,
    content: str,
) -> tuple[str, bool]:
    sanitized = _strip_chain_of_thought(content)
    blocked = _contains_prompt_leak(sanitized)
    if blocked:
        _record_copilot_guard_event(
            request,
            name="copilot.output_guard.blocked",
            details={"endpoint": endpoint},
        )
        return _PROMPT_LEAK_SAFE_MESSAGE, True
    return sanitized, False


_FORBIDDEN_SQL_KEYWORDS = frozenset(
    {
        "ALTER",
        "ANALYZE",
        "CALL",
        "COMMENT",
        "COPY",
        "CREATE",
        "DELETE",
        "DROP",
        "EXECUTE",
        "GRANT",
        "INSERT",
        "INTO",
        "MERGE",
        "REINDEX",
        "REPLACE",
        "REVOKE",
        "SET",
        "TRUNCATE",
        "UPDATE",
        "VACUUM",
    }
)
_SELECT_CLAUSE_STARTERS = frozenset(
    {
        "FROM",
        "GROUP",
        "HAVING",
        "LIMIT",
        "OFFSET",
        "ORDER",
        "UNION",
        "WHERE",
    }
)


def _tenant_sql_token(tenant_id: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", tenant_id.lower()).strip("_")


def _unquote_sql_identifier(value: str) -> str:
    value = value.strip()
    quoted_pair = (value[:1], value[-1:])
    if len(value) >= 2 and quoted_pair in {('"', '"'), ("`", "`"), ("[", "]")}:
        closing = quoted_pair[1]
        value = value[1:-1]
        value = value.replace(closing * 2, closing)
    return value


def _normalize_sql_identifier(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", _unquote_sql_identifier(value).lower()).strip("_")


def _iter_sql_table_identifiers(statement: TokenList):
    expect_relation = False
    for token in statement.tokens:
        if token.is_whitespace or token.ttype in Comment:
            continue
        keyword = token.normalized.upper()
        if keyword in {"FROM", "JOIN"} or keyword.endswith(" JOIN"):
            expect_relation = True
            continue
        if not expect_relation:
            if isinstance(token, TokenList):
                yield from _iter_sql_table_identifiers(token)
            continue
        if keyword == "LATERAL":
            continue
        if isinstance(token, Identifier):
            yield token
            yield from _iter_sql_table_identifiers(token)
        elif isinstance(token, IdentifierList):
            for identifier in token.get_identifiers():
                yield identifier
                yield from _iter_sql_table_identifiers(identifier)
        elif isinstance(token, TokenList):
            yield from _iter_sql_table_identifiers(token)
        expect_relation = False


def _raise_malformed_sql() -> None:
    raise HTTPException(status_code=400, detail="Malformed SELECT statement")


def _validate_select_shape(sql_text: str, statement) -> None:
    meaningful = [
        token
        for token in statement.tokens
        if not token.is_whitespace and token.ttype not in Comment
    ]
    if len(meaningful) < 2:
        _raise_malformed_sql()

    first = meaningful[0]
    if first.normalized.upper() != "SELECT":
        _raise_malformed_sql()

    projection = meaningful[1].normalized.upper()
    if projection in _SELECT_CLAUSE_STARTERS:
        _raise_malformed_sql()

    if sum(1 for token in statement.flatten() if token.value == "(") != sum(
        1 for token in statement.flatten() if token.value == ")"
    ):
        _raise_malformed_sql()

    normalized_sql = re.sub(r"\s+", " ", sql_text).strip().rstrip(";").rstrip()
    if re.search(
        r"\b(?:FROM|WHERE|GROUP\s+BY|HAVING|ORDER\s+BY|LIMIT|OFFSET|UNION|INTERSECT|EXCEPT)\s*$",
        normalized_sql,
        re.IGNORECASE,
    ):
        _raise_malformed_sql()


def _reject_forbidden_sql_tokens(statement) -> None:
    for token in statement.flatten():
        keyword = token.normalized.upper()
        if token.ttype in DDL or token.ttype in DML:
            forbidden = keyword != "SELECT"
        else:
            forbidden = keyword in _FORBIDDEN_SQL_KEYWORDS
        if forbidden:
            raise HTTPException(
                status_code=403,
                detail="Only SELECT statements are allowed in dry-run mode",
            )


def _validate_read_only_sql(sql: str, tenant_id: str) -> str:
    sql_text = sql.strip()
    if not sql_text:
        raise HTTPException(status_code=400, detail="sql is required")

    try:
        parsed = tuple(stmt for stmt in sqlparse.parse(sql_text) if str(stmt).strip())
    except (TypeError, ValueError):
        _raise_malformed_sql()
    if len(parsed) != 1:
        raise HTTPException(
            status_code=403,
            detail="Only single-statement SELECT queries are allowed",
        )

    statement = parsed[0]
    _reject_forbidden_sql_tokens(statement)
    if statement.get_type().upper() != "SELECT":
        raise HTTPException(
            status_code=403,
            detail="Only SELECT statements are allowed in dry-run mode",
        )
    _validate_select_shape(sql_text, statement)

    tenant_raw = _unquote_sql_identifier(tenant_id).lower()
    tenant_token = _tenant_sql_token(tenant_id)
    if tenant_token:
        for identifier in _iter_sql_table_identifiers(statement):
            names = (identifier.get_real_name(), identifier.get_parent_name())
            for name in names:
                if not name:
                    continue
                raw_name = _unquote_sql_identifier(name).lower()
                normalized_name = _normalize_sql_identifier(name)
                same_tenant = (
                    raw_name == tenant_raw
                    or normalized_name == tenant_token
                    or normalized_name.startswith(f"{tenant_token}_")
                )
                references_tenant_namespace = normalized_name.startswith("tenant_")
                if references_tenant_namespace and not same_tenant:
                    raise HTTPException(
                        status_code=403,
                        detail="Cross-tenant SQL references are not allowed",
                    )

    return sql_text


def _execute_read_only_sql(*, sql: str, tenant_id: str, datasource_id: str) -> dict[str, Any]:
    parsed = sqlparse.parse(sql)
    columns: list[str] = []
    if parsed:
        sel = re.search(r"SELECT\s+(.*?)\s+FROM", sql, re.IGNORECASE | re.DOTALL)
        if sel:
            for raw in sel.group(1).split(","):
                name = raw.strip().split()[-1].strip("`\"'")
                if name != "*":
                    columns.append(name)
    return {"rows": [], "columns": columns}


def _conv_orm_to_dict(orm: Any) -> dict[str, Any]:
    return {
        "id": orm.id,
        "tenant_id": orm.tenant_id,
        "title": orm.title,
        "mode": getattr(orm, "mode", "chat"),
        "favorite": getattr(orm, "favorite", False),
        "messageCount": orm.message_count,
        "createdAt": orm.created_at,
        "updatedAt": getattr(orm, "updated_at", orm.created_at),
        "preview": getattr(orm, "preview", orm.summary or ""),
        "userId": getattr(orm, "user_id", ""),
    }


def _msg_orm_to_dict(orm: Any) -> dict[str, Any]:
    return {
        "id": orm.id,
        "conversationId": orm.conversation_id,
        "role": orm.role,
        "content": orm.content,
        "createdAt": orm.created_at,
        "metadata": json.loads(orm.metadata_json) if orm.metadata_json else {},
        "userId": getattr(orm, "user_id", ""),
    }


def _conv_in_memory_to_dict(conv: Any) -> dict[str, Any]:
    """In-memory Conversation dataclass → 与 ORM 路径一致的响应形状。"""
    return {
        "id": conv.id,
        "tenant_id": conv.tenant_id,
        "title": conv.title,
        "mode": getattr(conv, "mode", "chat"),
        "favorite": getattr(conv, "favorite", False),
        "messageCount": conv.message_count,
        "createdAt": conv.created_at,
        "updatedAt": getattr(conv, "updated_at", conv.created_at),
        "preview": getattr(conv, "preview", conv.summary or ""),
        "userId": getattr(conv, "user_id", ""),
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
            token_uri=f"{os.getenv('KEYCLOAK_URL', 'http://keycloak:8080')}/realms/metaplatform/protocol/openid-connect/token",
            client_id="metaplatform-backend",
            client_secret="stub",  # noqa: S106
            scope="platform.read platform.write",
        ),
        provider=stub_provider,
        timeout_seconds=_copilot_client_timeout_seconds(),
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
    except Exception:
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
    sql = _validate_read_only_sql(str(body.get("sql", "")), tid)
    result = _execute_read_only_sql(sql=sql, tenant_id=tid, datasource_id="")
    _emit(
        request,
        "copilot.query.executed",
        "dry-run",
        {"sql": sql, "columns": result["columns"]},
        tid,
    )
    return result


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
    uid = _uid(request)
    session = get_session()
    try:
        orms = session.query(ConversationORM).filter_by(
            tenant_id=tid, user_id=uid,
        ).order_by(ConversationORM.created_at.desc()).all()
        db_items = [_conv_orm_to_dict(o) for o in orms]
        return {"items": db_items, "total": len(db_items)}
    finally:
        session.close()


@router.post("/conversations")
async def create_conversation(request: Request, body: dict = Body(...)) -> dict[str, Any]:
    tid = _tid(request)
    uid = _uid(request)
    conv_id = f"conv-{uuid.uuid4().hex[:12]}"
    now = _now_iso()
    title = body.get("title", "新会话")
    mode = body.get("mode", "chat")
    session = get_session()
    try:
        orm = ConversationORM(
            id=conv_id, tenant_id=tid, user_id=uid, title=title,
            summary="", message_count=0, created_at=now,
        )
        orm.mode = mode
        orm.favorite = False
        orm.updated_at = now
        orm.preview = ""
        session.add(orm)
        session.commit()
        session.refresh(orm)
        _emit(request, "copilot.conversation.created", conv_id, {"title": title}, tid)
        return {"code": 0, "data": _conv_orm_to_dict(orm), "message": "ok"}
    except Exception:
        conv = Conversation(
            id=conv_id, tenant_id=tid, title=title, user_id=uid,
            summary="", message_count=0, created_at=now,
        )
        conv.mode = mode
        conv.favorite = False
        conv.updated_at = now
        conv.preview = ""
        put_conversation(tid, conv)
        _emit(request, "copilot.conversation.created", conv_id, {"title": title}, tid)
        return {"code": 0, "data": _conv_in_memory_to_dict(conv), "message": "ok"}
    finally:
        session.close()


@router.get("/conversations/{conv_id}")
async def get_conversation_detail(request: Request, conv_id: str) -> dict[str, Any]:
    tid = _tid(request)
    uid = _uid(request)
    session = get_session()
    try:
        orm = session.query(ConversationORM).filter_by(id=conv_id, tenant_id=tid, user_id=uid).first()
        if not orm:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return {"code": 0, "data": _conv_orm_to_dict(orm), "message": "ok"}
    finally:
        session.close()


@router.delete("/conversations/{conv_id}")
async def delete_conversation(request: Request, conv_id: str) -> dict[str, Any]:
    tid = _tid(request)
    uid = _uid(request)
    session = get_session()
    try:
        orm = session.query(ConversationORM).filter_by(id=conv_id, tenant_id=tid, user_id=uid).first()
        if orm:
            session.delete(orm)
            session.query(MessageORM).filter_by(conversation_id=conv_id, user_id=uid).delete()
            session.commit()
            _emit(request, "copilot.conversation.deleted", conv_id, {}, tid)
        # Idempotent: return success even if not found
        return {"code": 0, "data": None, "message": "ok"}
    except Exception:
        if in_memory_delete_conversation(tid, conv_id, uid):
            _emit(request, "copilot.conversation.deleted", conv_id, {}, tid)
        return {"code": 0, "data": None, "message": "ok"}
    finally:
        session.close()


@router.post("/conversations/{conv_id}/favorite")
async def toggle_favorite(request: Request, conv_id: str) -> dict[str, Any]:
    tid = _tid(request)
    uid = _uid(request)
    session = get_session()
    try:
        orm = session.query(ConversationORM).filter_by(id=conv_id, tenant_id=tid, user_id=uid).first()
        if not orm:
            raise HTTPException(status_code=404, detail="Conversation not found")
        orm.favorite = not getattr(orm, "favorite", False)
        orm.updated_at = _now_iso()
        session.commit()
        session.refresh(orm)
        return {"code": 0, "data": _conv_orm_to_dict(orm), "message": "ok"}
    except HTTPException:
        raise
    except Exception:
        conv = next(
            (c for c in list_conversations(tid, user_id=uid) if c.id == conv_id),
            None,
        )
        if conv is None:
            raise HTTPException(status_code=404, detail="Conversation not found")
        conv.favorite = not getattr(conv, "favorite", False)
        conv.updated_at = _now_iso()
        put_conversation(tid, conv)
        return {"code": 0, "data": _conv_in_memory_to_dict(conv), "message": "ok"}
    finally:
        session.close()


@router.get("/conversations/{conv_id}/messages")
async def get_messages(
    request: Request, conv_id: str, page: int = 1, pageSize: int = 50,
) -> dict[str, Any]:
    tid = _tid(request)
    uid = _uid(request)
    session = get_session()
    try:
        q = select(MessageORM).filter_by(
            conversation_id=conv_id, tenant_id=tid, user_id=uid,
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
def _strip_chain_of_thought(content: str) -> str:
    """Strip reasoning blocks (`<think>...</think>`) from LLM output.

    Chain-of-thought is model-internal reasoning, not user-facing content.
    MiniMax reasoning models emit the whole think span before the visible
    answer; leaking it into the chat card looks like an error. Applied both
    while streaming (so the tokens never reach the frontend) and as a final
    cleanup on the non-streaming fallback path.
    """
    return re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()


@router.post("/chat/completions/stream")
async def chat_completions_stream(
    request: Request, body: dict = Body(...),
) -> StreamingResponse:
    tid = _tid(request)
    uid = _uid(request)
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
    messages = _validate_stream_message_envelope(
        request,
        messages=body.get("messages", []),
        endpoint="chat/completions/stream",
    )
    model = body.get("model", "doubao-pro-32k")
    temperature = body.get("temperature", 0.7)
    max_tokens = body.get("maxTokens", body.get("max_tokens", 2048))
    conv_id = body.get("conversationId", "")

    # 注入 session 上下文：让 LLM 在执行 ActionType / 工具时知道当前 session_id
    # （与 Kernel SessionSandbox.session_id 对齐），下游 dispatch 可透传。
    session_id = body.get("sessionId", "") or conv_id
    if session_id and messages and messages[0].get("role") == "system":
        # 在现有 system prompt 后追加 session 元数据（不污染用户原 prompt）
        marker = (
            "\n\n[Session Context]\n"
            f"- session_id: {session_id}\n"
            f"- tenant_id: {tid}\n"
            f"- user_id: {uid}\n"
            f"- app_id: {body.get('appId', '')}\n"
            "在执行任何 Action / Tool 调用时，将 session_id 作为 audit / 沙箱关联键。"
        )
        messages = [
            { **messages[0], "content": messages[0].get("content", "") + marker },
            *messages[1:],
        ]

    # Save user message if we have a conversation
    if conv_id:
        session = get_session()
        try:
            user_msg = MessageORM(
                id=f"msg-{uuid.uuid4().hex[:12]}",
                conversation_id=conv_id,
                tenant_id=tid,
                user_id=uid,
                role="user",
                content=_last_user_message_content(messages),
                created_at=_now_iso(),
                metadata_json=json.dumps({"model": model}),
            )
            session.add(user_msg)
            session.commit()
        finally:
            session.close()

    async def event_stream():
        output_guard = _StreamingOutputGuard()
        full_response = ""
        leak_observed = False
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
                token_uri=f"{os.getenv('KEYCLOAK_URL', 'http://keycloak:8080')}/realms/metaplatform/protocol/openid-connect/token",
                client_id="metaplatform-backend",
                client_secret="stub",  # noqa: S106
                scope="platform.read platform.write",
            ),
            tenant_id=tid,
            timeout_seconds=_llmgw_timeout_seconds(),
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
        except Exception:
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
                        output_guard.consume(text)
                        if output_guard.blocked:
                            leak_observed = True
                            break

            for safe_text in output_guard.finalize():
                if safe_text == _PROMPT_LEAK_SAFE_MESSAGE:
                    leak_observed = True
                full_response += safe_text
                chunk = {
                    "choices": [{"delta": {"content": safe_text}, "index": 0}],
                    "model": model,
                }
                yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
            if leak_observed or output_guard.blocked:
                _record_copilot_guard_event(
                    request,
                    name="copilot.output_guard.blocked",
                    details={"endpoint": "chat/completions/stream"},
                )

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
                    full_response, _ = _sanitize_copilot_response_text(
                        request,
                        endpoint="chat/completions/stream",
                        content=data.get(
                            "content",
                            data.get("data", {}).get("content", "抱歉，我暂时无法回答。"),
                        ),
                    )
                except LlmgwStreamError:
                    full_response = "抱歉，LLM 服务暂时不可用。"
                chunk = {
                    "choices": [{"delta": {"content": full_response}, "index": 0}],
                    "model": model,
                }
                yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"

        except LlmgwStreamError as e:
            if output_guard.blocked:
                full_response = _PROMPT_LEAK_SAFE_MESSAGE
            else:
                full_response = f"（LLM 服务暂时不可用：{str(e)[:100]}）"
            chunk = {
                "choices": [{"delta": {"content": full_response}, "index": 0}],
                "model": model,
            }
            yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
        except Exception as e:  # last-resort guard: never break the SSE stream
            if output_guard.blocked:
                full_response = _PROMPT_LEAK_SAFE_MESSAGE
            else:
                full_response = f"（LLM 服务暂时不可用：{str(e)[:100]}）"
            chunk = {
                "choices": [{"delta": {"content": full_response}, "index": 0}],
                "model": model,
            }
            yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"

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
                    user_id=uid,
                    role="assistant",
                    content=full_response,
                    created_at=_now_iso(),
                    metadata_json=json.dumps({"model": model}),
                )
                session.add(ai_msg)
                conv = session.query(ConversationORM).filter_by(
                    id=conv_id, tenant_id=tid, user_id=uid,
                ).first()
                if conv:
                    # 首条消息触发标题更新（"新对话" → 第一条用户输入）
                    if not conv.title or conv.title in ("新对话", "新会话"):
                        first_user = next(
                            (m.get("content", "") for m in messages if m.get("role") == "user"),
                            "",
                        )
                        conv.title = (first_user or conv.title)[:24]
                    conv.message_count = (conv.message_count or 0) + 2
                    conv.preview = full_response[:100]
                    conv.updated_at = _now_iso()
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
    except Exception:
        pass
    return _resp(list_models(tid))


# --- Ontology (3) -----------------------------------------------------------
def _walk_cap_nodes(
    nodes: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Flatten the nested capability tree into a flat node list.

    ``list_capability_tree`` (mate_app_arch) returns a nested dict tree
    ``{id, code, name, level, children: [...]}`` — this helper walks
    every level so the copilot handlers can iterate all capabilities.
    """
    flat: list[dict[str, Any]] = []
    for n in nodes:
        flat.append(n)
        flat.extend(_walk_cap_nodes(n.get("children", []) or []))
    return flat


def _find_cap_node(
    nodes: list[dict[str, Any]],
    node_id: str,
) -> dict[str, Any] | None:
    """Find a capability node by id anywhere in the nested tree."""
    for n in nodes:
        if n.get("id") == node_id:
            return n
        found = _find_cap_node(n.get("children", []) or [], node_id)
        if found is not None:
            return found
    return None


@router.get("/ontology/concepts/search")
async def search_concepts(
    request: Request,
    keyword: str = Query(...),
) -> dict[str, Any]:
    tid = _tid(request)
    # P2-W4: pull concepts from arch Capability tree + DataEntity store
    concepts: list[dict[str, Any]] = []
    for cap in _walk_cap_nodes(list_capability_tree(tid)):
        concepts.append({"id": cap["id"], "name": cap["name"], "category": "capability"})
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
    target = _find_cap_node(caps, node_id)
    if target is not None:
        nodes.append({"id": target["id"], "label": target["name"]})
        for child in target.get("children", []) or []:
            nodes.append({"id": child["id"], "label": child["name"]})
            edges.append({"source": node_id, "target": child["id"], "label": "contains"})
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
    cypher = body.get("cypher", "")  # noqa: F841 - retained for API compatibility
    # P2-W4: full graph from arch Capability tree + DataEntity store
    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    caps = list_capability_tree(tid)
    flat_caps = _walk_cap_nodes(caps)
    for cap in flat_caps:
        nodes.append({"id": cap["id"], "label": cap["name"], "type": "capability"})
    for cap in flat_caps:
        for child in cap.get("children", []) or []:
            edges.append(
                {"source": cap["id"], "target": child["id"], "label": "contains"}
            )
    # 数据资产映射：data_asset_id → 数据来源信息（D 层 / 业务域）
    assets = {a.id: a for a in list_data_assets(tid)}
    for ent in list_data_entities(tid):
        asset = assets.get(ent.data_asset_id)
        nodes.append({
            "id": ent.id,
            "label": ent.name,
            "type": "entity",
            # data 供前端 evidence 展示：对应的数据（字段）+ 数据来源（数据资产/D 层/域）
            "data": {
                "fields": list(ent.fields)[:8],
                "dataSource": asset.name if asset else "",
                "layer": asset.layer if asset else "",
                "domain": asset.domain if asset else "",
            },
        })
    return {"nodes": nodes, "edges": edges}


# --- Plans (1) --------------------------------------------------------------
@router.get("/plans")
async def get_plans(request: Request) -> dict[str, Any]:
    return _resp(list_plans(_tid(request)))


# --- Queries (2) ------------------------------------------------------------
@router.post("/queries/execute")
async def execute_query(request: Request, body: dict[str, Any]) -> dict[str, Any]:
    tid = _tid(request)
    sql = _validate_read_only_sql(str(body.get("sql", "")), tid)
    datasource_id = str(body.get("datasource_id", "ds-1"))
    query_id = f"q-{uuid.uuid4().hex[:8]}"
    result = _execute_read_only_sql(
        sql=sql,
        tenant_id=tid,
        datasource_id=datasource_id,
    )
    _emit(
        request,
        "copilot.query.executed",
        query_id,
        {"sql": sql, "datasource_id": datasource_id},
        tid,
    )
    return {"query_id": query_id, **result}


@router.get("/queries/history")
async def query_history(request: Request) -> dict[str, Any]:
    return _resp(list_queries(_tid(request)))


# --- Scheduling (5) ---------------------------------------------------------
@router.post("/scheduling/employees/match")
async def match_employees(
    response: Response,
    request: Request,
    body: dict = Body(...),
) -> dict[str, Any]:
    """意图匹配 → 候选员工列表。A3 已迁移到 orchestrator（本端点弃用）。"""
    _mark_deprecated(response)
    tenant_id = _tid(request)
    task_type = str(body.get("task_type", body.get("taskType", "")))
    tokens = [t for t in re.split(r"[\s,/_-]+", task_type.lower()) if t]

    raw_employees: list[dict[str, Any]] = []
    try:
        client = _get_client(request)
        # GOVERN-12-01: 透传入站 Authorization 作为 fallback。
        # dev 环境 keycloak client_secret=stub 无法 client_credentials，
        # 走 INSECURE_SKIP_SIGNATURE 时 gateway 直接接受入站 Bearer；
        # 生产环境配真 secret 后这条 fallback 仍可用作"调用方身份降级"。
        fallback_token = str(getattr(request.state.ctx, "authorization", "") or "")
        if not fallback_token:
            auth_header = request.headers.get("authorization", "")
            if auth_header.lower().startswith("bearer "):
                fallback_token = auth_header[7:].strip()
        # APP-DW caps page size at 100.  Requesting 200 turns a healthy
        # dependency into a 422 and silently selects the legacy seed below.
        raw_employees = await client.list_dw_employees(
            tenant_id=tenant_id,
            keyword="",
            size=100,
            fallback_token=fallback_token or None,
        )
    except Exception as exc:
        # Never return copilot-owned demo employees when the DW source is
        # unavailable.  A dependency failure must be visible to callers so
        # they can retry or present an actionable error.
        raise HTTPException(
            status_code=503,
            detail="Digital Workforce employee directory is unavailable",
        ) from exc

    def _haystack(e: dict[str, Any]) -> str:
        parts = [
            str(e.get("roleCategory", "")),
            str(e.get("roleIdentity", "")),
            str(e.get("capability", "")),
            str(e.get("name", "")),
            str(e.get("code", "")),
        ]
        return ",".join(parts).lower()

    items: list[dict[str, Any]] = []
    for e in raw_employees:
        if not tokens:
            items.append({
                "employeeId": e.get("employeeId"),
                "name": e.get("name"),
                "role": e.get("roleIdentity"),
                "capability": e.get("capability"),
                "confidence": 1.0,
            })
            continue
        hay = _haystack(e)
        hits = sum(1 for t in tokens if t in hay)
        if hits:
            items.append({
                "employeeId": e.get("employeeId"),
                "name": e.get("name"),
                "role": e.get("roleIdentity"),
                "capability": e.get("capability"),
                "confidence": round(hits / len(tokens), 3),
            })

    # 按 confidence desc 排序，保持稳定
    items.sort(key=lambda x: x.get("confidence", 0), reverse=True)
    return {"items": items, "total": len(items)}


@router.post("/scheduling/execution/start")
async def start_execution(response: Response, request: Request, body: dict[str, Any]) -> dict[str, Any]:
    _mark_deprecated(response)
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
async def detect_intent(response: Response, request: Request, body: dict[str, Any]) -> dict[str, Any]:
    _mark_deprecated(response)
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
async def get_intents(response: Response, request: Request) -> dict[str, Any]:
    _mark_deprecated(response)
    return _resp(list_intents(_tid(request)))


@router.post("/scheduling/plan/generate")
async def generate_plan(response: Response, request: Request, body: dict[str, Any]) -> dict[str, Any]:
    _mark_deprecated(response)
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
    response: Response,
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    """List scheduling templates (FR-COPILOT-COPILOTGETCOPILOTSCHEDULINGTEMPLATES).

    Templates are reusable plan skeletons; we surface the copilot
    Template catalog, optionally filtered by category. A3: 已迁移 orchestrator。
    """
    _mark_deprecated(response)
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


# ---------------------------------------------------------------------------
# Agent loop (FC-driven SuperAI scheduling, real-time event stream)
# ---------------------------------------------------------------------------
def _agent_event(data: dict[str, Any]) -> str:
    """Serialize one agent-loop event dict to an SSE ``data:`` line."""
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/chat/agent/stream")
async def chat_agent_stream(
    request: Request,
    body: dict = Body(...),
) -> StreamingResponse:
    """SuperAI agent loop: LLM decides → orchestrator dispatch → feed back.

    Streams OpenAI-style SSE with extra typed events so the frontend can
    render the scheduling process in real time:

      {"type": "reasoning", "text": ...}            — LLM 思考
      {"type": "tool_call",  callId, tool, args}    — 正在调度数字员工
      {"type": "tool_result", callId, status, result} — 调度结果
      {"choices": [{delta: {content}}]}             — 最终回答正文
      data: [DONE]
    """
    tid = _tid(request)
    uid = _uid(request)
    messages = _validate_stream_message_envelope(
        request,
        messages=body.get("messages", []),
        endpoint="chat/agent/stream",
    )
    model = body.get("model", "doubao-pro-32k")
    temperature = body.get("temperature", 0.7)
    max_tokens = body.get("maxTokens", body.get("max_tokens"))
    if isinstance(max_tokens, str):
        max_tokens = None
    conv_id = body.get("conversationId", "")

    # 注入 session 上下文（与 /chat/completions/stream 对齐）：让 LLM 决策时
    # 知道当前 session_id / tenant / user，下游 dispatch 可透传给数字员工。
    session_id = body.get("sessionId", "") or conv_id

    # Save user message if we have a conversation (mirror /chat/completions/stream).
    if conv_id:
        session = get_session()
        try:
            user_msg = MessageORM(
                id=f"msg-{uuid.uuid4().hex[:12]}",
                conversation_id=conv_id,
                tenant_id=tid,
                user_id=uid,
                role="user",
                content=_last_user_message_content(messages),
                created_at=_now_iso(),
                metadata_json=json.dumps({"model": model}),
            )
            session.add(user_msg)
            session.commit()
        finally:
            session.close()
    if session_id:
        marker = (
            "\n\n[Session Context]\n"
            f"- session_id: {session_id}\n"
            f"- tenant_id: {tid}\n"
            "- 调度数字员工时，将 session_id 作为 audit / 沙箱关联键。"
        )
        if messages and messages[0].get("role") == "system":
            messages = [
                {**messages[0], "content": messages[0].get("content", "") + marker},
                *messages[1:],
            ]
        else:
            messages = [{"role": "system", "content": marker.strip()}, *messages]

    llmgw_host = os.getenv("MATE_LLMGW_HOST", "mate-tech-llmgw")
    llmgw_port = int(os.getenv("MATE_LLMGW_PORT", "8008"))
    user_token = str(getattr(request.state.ctx, "authorization", "") or "")
    if not user_token:
        auth_header = request.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            user_token = auth_header[7:].strip()

    bearer = BearerAuth(
        token_uri=f"{os.getenv('KEYCLOAK_URL', 'http://keycloak:8080')}/realms/metaplatform/protocol/openid-connect/token",
        client_id="metaplatform-backend",
        client_secret="stub",  # noqa: S106
        scope="platform.read platform.write",
    )
    llmgw_client = LlmgwStreamClient(
        host=llmgw_host,
        port=llmgw_port,
        auth=bearer,
        tenant_id=tid,
        timeout_seconds=_llmgw_timeout_seconds(),
        user_token=user_token or None,
    )
    orchestrator_client = OrchestratorClient(auth=bearer)

    # 后台 AI Provider 配置（如 MiniMax）——FC 决策走真实 OpenAI 兼容端点。
    provider_cfg: dict[str, str] = {}
    try:
        provider_cfg = await _get_client(request).get_provider_config(
            tid, "custom", user_token or None
        )
    except Exception:
        provider_cfg = {}
    llm_provider = "custom" if provider_cfg.get("base_url") else "openai"
    llm_base_url = provider_cfg.get("base_url") or None
    llm_api_key = provider_cfg.get("api_key") or None
    if provider_cfg.get("default_model"):
        model = provider_cfg["default_model"]

    async def event_stream():
        agent_steps: list[dict[str, Any]] = []
        final_parts: list[str] = []
        full_response = ""
        try:
            roles = await orchestrator_client.list_roles(
                tenant_id=tid,
                fallback_token=user_token or None,
            )
        except OrchestratorClientError as exc:
            agent_steps.append({"type": "reasoning", "text": f"无法获取数字员工列表：{exc}"})
            yield _agent_event({"type": "reasoning", "text": f"无法获取数字员工列表：{exc}"})
            roles = []

        # MP-SAL 接线：本体工具面 + OAG 卡片（best-effort——tech-ont 不可达时
        # 降级为纯调度模式，不阻断聊天）。
        ontology_tools: list[dict[str, Any]] | None = None
        ontology_exec = None
        object_cards: list[dict[str, Any]] | None = None
        try:
            from ..ontology_http_repo import OntologyHttpRepo  # noqa: PLC0415
            from ..ontology_tools import build_ontology_tools, execute_ontology_tool

            auth_headers = {"Authorization": f"Bearer {user_token or ''}", "X-Tenant-Id": tid}
            onto_repo = OntologyHttpRepo(headers=auth_headers)
            ontology_tools = build_ontology_tools(onto_repo)
            _exec = execute_ontology_tool
            _repo = onto_repo
            ontology_exec = lambda name, args: _exec(_repo, name, args)  # noqa: E731
            last_user = next(
                (str(m.get("content") or "") for m in reversed(messages)
                 if m.get("role") == "user"),
                "",
            )
            if last_user:
                object_cards = onto_repo.search_objects(last_user, top_k=3)
        except Exception:
            ontology_tools, ontology_exec, object_cards = None, None, None

        try:
            # MP-SR-01（任务2）：4 级 fallback dispatcher 兜底；LLM 决策
            # 不可用 / 不返回 dispatch_employee 时降级到 keyword_substring。
            embedding_handler = make_embedding_match_handler(min_similarity=0.05)
            keyword_handler = make_keyword_substring_handler()

            async def _dispatch_by_routing_fn(
                user_message: str,
                available_roles: list[dict[str, Any]],
                **_: Any,
            ):
                return await dispatch_by_routing(
                    user_message=user_message,
                    available_roles=available_roles,
                    a2a_handler=None,  # A2A 由上层 run_agent_loop 走 orchestrator_client
                    kernel_role_handler=None,
                    embedding_handler=embedding_handler,
                    keyword_substring_handler=keyword_handler,
                )

            async for event in run_agent_loop(
                llmgw_client=llmgw_client,
                orchestrator_client=orchestrator_client,
                messages=messages,
                model=model,
                roles=roles,
                tenant_id=tid,
                fallback_token=user_token or None,
                llm_provider=llm_provider,
                llm_base_url=llm_base_url,
                llm_api_key=llm_api_key,
                temperature=temperature,
                max_tokens=max_tokens,
                ontology_tools=ontology_tools,
                ontology_tool_exec=ontology_exec,
                object_cards=object_cards,
                dispatch_by_routing_fn=_dispatch_by_routing_fn,
            ):
                etype = event.get("type")
                if etype == "final":
                    final_parts.append(str(event.get("content") or ""))
                else:
                    # Persist reasoning / tool_call / tool_result events for the
                    # assistant message timeline (stored under metadata_json).
                    if etype in ("reasoning", "tool_call", "tool_result"):
                        agent_steps.append(event)
                    yield _agent_event(event)
        except LlmgwStreamError as exc:
            final_parts.clear()
            full_response = f"LLM 决策失败：{exc}"
            yield _agent_event({
                "choices": [{"delta": {"content": full_response}, "index": 0}],
                "model": model,
            })
        except OrchestratorClientError as exc:
            final_parts.clear()
            full_response = f"调度失败：{exc}"
            yield _agent_event({
                "choices": [{"delta": {"content": full_response}, "index": 0}],
                "model": model,
            })
        if final_parts:
            full_response, _ = _sanitize_copilot_response_text(
                request,
                endpoint="chat/agent/stream",
                content="".join(final_parts),
            )
            # Chunk the final answer so the frontend still receives streaming deltas.
            for i in range(0, len(full_response), 32):
                chunk = full_response[i:i + 32]
                yield _agent_event({
                    "choices": [{"delta": {"content": chunk}, "index": 0}],
                    "model": model,
                })
        yield "data: [DONE]\n\n"

        # Persist assistant message + update conversation.
        # Wrap in try/except so a DB failure doesn't break the already-streamed chat
        # (mirror /chat/completions/stream's defensive persistence).
        if conv_id and full_response:
            try:
                session = get_session()
                try:
                    ai_msg = MessageORM(
                        id=f"msg-{uuid.uuid4().hex[:12]}",
                        conversation_id=conv_id,
                        tenant_id=tid,
                        user_id=uid,
                        role="assistant",
                        content=full_response,
                        created_at=_now_iso(),
                        metadata_json=json.dumps({
                            "model": model,
                            "agentSteps": agent_steps,
                        }),
                    )
                    session.add(ai_msg)
                    conv = session.query(ConversationORM).filter_by(
                        id=conv_id, tenant_id=tid, user_id=uid,
                    ).first()
                    if conv:
                        if not conv.title or conv.title in ("新对话", "新会话"):
                            first_user = next(
                                (m.get("content", "") for m in messages if m.get("role") == "user"),
                                "",
                            )
                            conv.title = (first_user or conv.title)[:24]
                        conv.message_count = (conv.message_count or 0) + 2
                        conv.preview = full_response[:100]
                        conv.updated_at = _now_iso()
                    session.commit()
                finally:
                    session.close()
            except Exception:
                pass

    return StreamingResponse(event_stream(), media_type="text/event-stream")
