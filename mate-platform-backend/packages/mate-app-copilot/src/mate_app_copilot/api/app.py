"""FastAPI router exposing the copilot endpoints (FR-COPILOT-001..033).

33 endpoints under `/api/v1/copilot/*`. Every handler enforces
ADR-0014 step 2 (`require_tenant(ctx)`) before touching the
repository, except `/auth/login` which sits behind an anonymous path.

Write handlers emit `<domain>.<aggregate>.<verb>` outbox events via
`app.state.outbox_writer` (ADR-0014 step 3).
"""
from __future__ import annotations

import re
import time
import uuid
from dataclasses import asdict
from typing import Any

import sqlparse
from fastapi import APIRouter, HTTPException, Query, Request
from mate_app_a2a.repositories import (  # pyright: ignore[reportMissingImports]
    create_delegation,
    list_external_agents,
)

from mate_clients.security.bearer import BearerAuth
from mate_platform.messaging.events import Event
from mate_platform.messaging.outbox import InMemoryOutboxWriter
from mate_platform.tenancy.context import TenantId
from mate_platform.tenancy.guards import require_tenant

from ..clients import AsyncCopilotClient
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
    put_asset,
)

router = APIRouter(prefix="/api/v1/copilot", tags=["copilot"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _tid(request: Request) -> str:
    ctx = request.state.ctx
    return str(require_tenant(ctx))


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


def _get_client(request: Request) -> AsyncCopilotClient:
    """Return the configured AsyncCopilotClient or build a default one.

    In production the client is wired by the platform startup hook onto
    `app.state.copilot_client`. In tests / single-binary deployment it
    falls back to an in-process stub provider. Either way the call
    surface (embed / chat / generate_sql) is identical.
    """
    client: AsyncCopilotClient | None = getattr(
        request.app.state, "copilot_client", None
    )
    if client is not None:
        return client

    return AsyncCopilotClient(
        base_url="http://localhost",
        auth=BearerAuth(
            token_uri="http://localhost:8080/realms/metaplatform/protocol/openid-connect/token",  # noqa: S106
            client_id="metaplatform-backend",
            client_secret="stub",  # noqa: S106
            scope="platform.read platform.write",
        ),
        provider=stub_provider,
    )


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
    """Proxy A2A delegation to mate-app-a2a (in-process for P2-W3).

    Accepts {target_agent_id, message, context} and creates a
    delegation task in the a2a repository. Returns the task_id +
    pending status. Emits copilot.a2a.delegated outbox event.
    """
    tid = _tid(request)
    body = await request.json()

    task = create_delegation(
        tenant_id=tid,
        target_agent_id=body.get("target_agent_id", ""),
        message=body.get("message", ""),
        context=body.get("context", {}),
    )
    _emit(
        request,
        event_type="copilot.a2a.delegated",
        aggregate_id=task.id,
        payload={"target_agent_id": body.get("target_agent_id", "")},
        tenant_id=tid,
    )
    return asdict(task)


@router.get("/a2a/external")
async def a2a_external(request: Request) -> dict[str, Any]:
    """Proxy external agent listing to mate-app-a2a (in-process)."""
    tid = _tid(request)

    items = list_external_agents(tid)
    return {"items": [asdict(e) for e in items], "total": len(items)}


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
    context = str(body.get("context", ""))
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
    params = body.get("params", {})
    result_id = f"res-{uuid.uuid4().hex[:8]}"
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
        "output": {"params": params},
    }


# --- Analysis SQL Copilot (4) ----------------------------------------------
@router.get("/analysis/explain-sql")
async def explain_sql(
    request: Request,
    sql: str = Query(...),
) -> dict[str, Any]:
    _tid(request)
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


# --- Conversations (1) ------------------------------------------------------
@router.get("/conversations")
async def get_conversations(request: Request) -> dict[str, Any]:
    return _resp(list_conversations(_tid(request)))


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


# --- Knowledge-bases (1) ----------------------------------------------------
@router.get("/knowledge-bases")
async def get_knowledge_bases(request: Request) -> dict[str, Any]:
    tid = _tid(request)
    items = list_knowledge_bases(tid)
    if items:
        return _resp(items)
    return {
        "items": [
            {"id": "kb-fallback", "name": "Default KB", "doc_count": 0},
        ],
        "total": 1,
    }


# --- Models (1) -------------------------------------------------------------
@router.get("/models/multimodal")
async def get_multimodal_models(request: Request) -> dict[str, Any]:
    return _resp(list_models(_tid(request)))


# --- Ontology (3) -----------------------------------------------------------
@router.get("/ontology/concepts/search")
async def search_concepts(
    request: Request,
    keyword: str = Query(...),
) -> dict[str, Any]:
    _tid(request)
    concepts = [
        {"id": "c-customer", "name": "Customer", "category": "entity"},
        {"id": "c-contract", "name": "Contract", "category": "entity"},
        {"id": "a-approve", "name": "Approve", "category": "action"},
    ]
    kw = keyword.lower()
    matched = [c for c in concepts if kw in c["name"].lower()]
    return {"items": matched, "total": len(matched)}


@router.get("/ontology/graph/expand")
async def expand_graph(
    request: Request,
    node_id: str = Query(...),
) -> dict[str, Any]:
    _tid(request)
    return {
        "nodes": [
            {"id": node_id, "label": node_id},
            {"id": f"{node_id}-child", "label": f"{node_id}-child"},
        ],
        "edges": [{"source": node_id, "target": f"{node_id}-child", "label": "relates_to"}],
    }


@router.get("/ontology/graph/query")
async def query_graph(
    request: Request,
    cypher: str = Query(default=""),
) -> dict[str, Any]:
    _tid(request)
    return {
        "nodes": [{"id": "n-1", "label": "Root"}, {"id": "n-2", "label": "Leaf"}],
        "edges": [{"source": "n-1", "target": "n-2", "label": "contains"}],
    }


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
@router.get("/scheduling/employees/match")
async def match_employees(
    request: Request,
    task_type: str = Query(...),
) -> dict[str, Any]:
    _tid(request)
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


# --- Search (1) -------------------------------------------------------------
@router.get("/search")
async def search(
    request: Request,
    q: str = Query(...),
) -> dict[str, Any]:
    tid = _tid(request)
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
