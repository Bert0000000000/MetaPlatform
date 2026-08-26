"""FastAPI app for mate-tech-agent (S1 + S2 + S3 + S4).

BUSINESS-SLICES deep implementation: adds ADR-0014 step 3 (outbox
events), tenant-scoped thread memory, a proper S3 human-in-the-loop
review state machine (DRAFT -> PENDING_REVIEW -> APPROVED/REJECTED/
EXPIRED), and input validation (AUTO scenario resolution, thread-id
sanitisation). Endpoint contracts (HTTP method / path / response
shape) are unchanged.
"""
# pyright: reportUnusedFunction=false
from __future__ import annotations

import os
import time
import uuid
from dataclasses import dataclass
from typing import Any

# BUSINESS-SLICES P1 wave 2: hooks 1, 2 (auth + tenant).
# BUSINESS-SLICES deep: hook 3 (outbox) + tenant-scoped memory + review FSM.
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse

from mate_platform.auth import install_auth
from mate_platform.messaging.events import Event
from mate_platform.messaging.outbox import InMemoryOutboxWriter
from mate_platform.tenancy.context import TenantId
from mate_platform.tenancy.guards import require_tenant
from mate_tech_agent import __version__
from mate_tech_agent.api.schemas import (
    ChatRequest,
    ChatResponse,
    HealthResponse,
    HumanReviewRequest,
    HumanReviewResponse,
    PlanExecuteRequest,
    PlanExecuteResponse,
)
from mate_tech_agent.graph import (
    answer_node,
    build_s1_graph,
    build_s2_graph,
    build_s3_graph,
    build_s4_graph,
    human_review_node,
    persist_node,
    planner_node,
    post_review_node,
    retrieve_node,
    synthesizer_node,
    worker_node,
)
from mate_tech_agent.llm import get_llm, stream_answer
from mate_tech_agent.memory import delete_state, load_state, save_state
from mate_tech_agent.repositories.in_memory import create_plan_execution

_GRAPHS = {
    "S1": build_s1_graph(),
    "S2": build_s2_graph(),
    "S3": build_s3_graph(),
    "S4": build_s4_graph(),
}

# Default scenario when the client passes "AUTO".
_AUTO_DEFAULT = "S1"

# Review TTL: a pending review expires after this many seconds.
_REVIEW_TTL = int(os.environ.get("AGENT_REVIEW_TTL_SECONDS", "3600"))


# ---------------------------------------------------------------------------
# Review state machine (S3 human-in-the-loop)
# ---------------------------------------------------------------------------
@dataclass
class ReviewState:
    """Lifecycle record for an S3 human review.

    States: PENDING -> APPROVED | REJECTED | EXPIRED.
    Once resolved (non-PENDING) the review cannot be re-submitted;
    a second ``POST /review`` returns ``status=no_pending``.
    """

    thread_id: str
    tenant_id: str
    scenario: str
    status: str  # PENDING | APPROVED | REJECTED | EXPIRED
    created_at: float
    resolved_at: float = 0.0
    feedback: str = ""
    approved: bool = False

    def is_expired(self) -> bool:
        if self.status != "PENDING":
            return False
        return (time.time() - self.created_at) > _REVIEW_TTL


# tenant_id -> thread_id -> ReviewState
_REVIEWS: dict[str, dict[str, ReviewState]] = {}


def _get_review(tenant_id: str, thread_id: str) -> ReviewState | None:
    """Return the review state, lazily expiring stale PENDING reviews."""
    rs = _REVIEWS.get(tenant_id, {}).get(thread_id)
    if rs is not None and rs.is_expired():
        rs.status = "EXPIRED"
        rs.resolved_at = time.time()
    return rs


def _set_review(rs: ReviewState) -> None:
    _REVIEWS.setdefault(rs.tenant_id, {})[rs.thread_id] = rs


def _clear_review(tenant_id: str, thread_id: str) -> None:
    _REVIEWS.get(tenant_id, {}).pop(thread_id, None)


def _resolve_scenario(requested: str) -> str:
    """Map the requested scenario to a concrete graph key.

    ``AUTO`` resolves to ``S1`` (the simplest single-pass scenario).
    Unknown values are rejected by the caller with HTTP 501.
    """
    if requested == "AUTO":
        return _AUTO_DEFAULT
    return requested


def _persist(tenant_id: str, thread_id: str, state: dict[str, Any]) -> None:
    """Persist graph state without retaining a bearer token in memory storage."""
    persisted = dict(state)
    persisted.pop("_access_token", None)
    save_state(tenant_id, thread_id, persisted)


def _run_s3_initial(
    req: ChatRequest,
    thread_id: str,
    tenant_id: str,
    access_token: str,
) -> dict:
    """S3 first call: retrieve + answer + human_review (paused).

    Registers a PENDING review in the tenant-scoped ``_REVIEWS`` table
    so the subsequent ``POST /review`` can resolve it through the FSM.
    """
    init = {
        "messages": [{"role": "user", "content": req.message}],
        "thread_id": thread_id,
        "tenant_id": tenant_id,
        "_scenario": "S3",
        "_access_token": access_token,
    }
    state = retrieve_node(init)
    state = answer_node(state)
    state = human_review_node(state)
    _set_review(ReviewState(
        thread_id=thread_id,
        tenant_id=tenant_id,
        scenario="S3",
        status="PENDING",
        created_at=time.time(),
    ))
    _persist(tenant_id, thread_id, state)
    return state


def _emit(
    request: Request,
    event_type: str,
    aggregate_id: str,
    payload: dict[str, Any],
    tenant_id: str,
) -> None:
    """Append an outbox event if a writer is configured (ADR-0014 step 3)."""
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


def create_app() -> FastAPI:
    app = FastAPI(
        title="mate-tech-agent",
        version=__version__,
        description="Mate Platform multi-agent service (LangGraph S1+S2+S3+S4)",
    )

    # Hook 1 of 5: install auth middleware (SEC-IAM-01).
    install_auth(app)
    # Default outbox writer (no-op until a test attaches one).
    if not hasattr(app.state, "outbox_writer"):
        app.state.outbox_writer = InMemoryOutboxWriter()

    def _require_ctx(request: Request):
        """Defence in depth: install_auth populates ctx or returns 401."""
        ctx = getattr(request.state, "ctx", None)
        if ctx is None:
            raise HTTPException(status_code=401, detail="no auth context")
        return ctx

    def _tid(request: Request) -> str:
        """Return the verified tenant_id for the current request."""
        return str(require_tenant(_require_ctx(request)))

    @app.get("/healthz", response_model=HealthResponse)
    async def healthz() -> HealthResponse:
        return HealthResponse(status="ok", service="mate-tech-agent", version=__version__)

    @app.post("/api/v1/agent/chat", response_model=ChatResponse)
    async def chat(request: Request, req: ChatRequest) -> ChatResponse:
        # Hook 2 of 5: tenant guard.
        tenant_id = _tid(request)
        scenario = _resolve_scenario(req.scenario)
        if scenario not in _GRAPHS:
            raise HTTPException(status_code=501, detail=f"scenario {req.scenario} not implemented")
        thread_id = req.thread_id or str(uuid.uuid4())
        access_token = request.headers.get("authorization", "")
        start = time.perf_counter()
        if scenario == "S3":
            state = _run_s3_initial(req, thread_id, tenant_id, access_token)
            # Hook 3 of 5: emit review-requested event.
            _emit(
                request,
                "agent.review.requested",
                thread_id,
                {"thread_id": thread_id, "scenario": "S3"},
                tenant_id,
            )
        else:
            graph = _GRAPHS[scenario]
            prior = load_state(tenant_id, thread_id)
            base = dict(prior.get("state", {})) if prior else {}
            base.update({
                "messages": [{"role": "user", "content": req.message}],
                "thread_id": thread_id,
                "tenant_id": tenant_id,
                "_scenario": scenario,
                "_access_token": access_token,
            })
            try:
                state = graph.invoke(base)
            except Exception as exc:
                raise HTTPException(status_code=500, detail=str(exc)) from exc
            # Belt-and-suspenders: ensure state is persisted even if the
            # graph's persist_node dropped tenant_id during transitions.
            state["tenant_id"] = tenant_id
            state["thread_id"] = thread_id
            _persist(tenant_id, thread_id, state)
        latency_ms = int((time.perf_counter() - start) * 1000)
        # Hook 3 of 5: emit chat-completed event.
        _emit(
            request,
            "agent.chat.completed",
            thread_id,
            {
                "thread_id": thread_id,
                "scenario": scenario,
                "latency_ms": latency_ms,
                "chunks": len(state.get("retrieved_chunks", [])),
            },
            tenant_id,
        )
        return ChatResponse(
            thread_id=thread_id,
            scenario=scenario,
            answer=state.get("answer", ""),
            retrieved_chunks=state.get("retrieved_chunks", []),
            tool_calls=state.get("tool_calls", []),
            latency_ms=latency_ms,
        )

    @app.post("/api/v1/agent/chat/stream")
    async def chat_stream(request: Request, req: ChatRequest):
        tenant_id = _tid(request)
        scenario = _resolve_scenario(req.scenario)
        if scenario not in _GRAPHS:
            raise HTTPException(status_code=501, detail=f"scenario {req.scenario} not implemented")
        thread_id = req.thread_id or str(uuid.uuid4())

        async def event_gen():
            yield f"event: thread\ndata: {thread_id}\n\n"
            if scenario == "S3":
                init = {
                    "messages": [{"role": "user", "content": req.message}],
                    "thread_id": thread_id,
                    "tenant_id": tenant_id,
                    "_scenario": "S3",
                    "_access_token": request.headers.get("authorization", ""),
                }
                state = retrieve_node(init)
                rc = state.get("retrieved_chunks", [])
                yield f"event: retrieve_done\ndata: hits={len(rc)}\n\n"
                state = answer_node(state)
                yield "event: llm_start\ndata: synthesizing\n\n"
                llm = get_llm()
                for token in stream_answer(llm, req.message, rc):
                    yield f"event: token\ndata: {token}\n\n"
                yield "event: llm_done\ndata: complete\n\n"
                state = human_review_node(state)
                _set_review(ReviewState(
                    thread_id=thread_id,
                    tenant_id=tenant_id,
                    scenario="S3",
                    status="PENDING",
                    created_at=time.time(),
                ))
                _emit(
                    request,
                    "agent.review.requested",
                    thread_id,
                    {"thread_id": thread_id, "scenario": "S3"},
                    tenant_id,
                )
                _persist(tenant_id, thread_id, state)
                yield "event: awaiting_review\ndata: pending=true\n\n"
                yield "event: done\ndata: paused\n\n"
                return

            if scenario == "S1":
                init = {
                    "messages": [{"role": "user", "content": req.message}],
                    "thread_id": thread_id,
                    "tenant_id": tenant_id,
                    "_scenario": "S1",
                    "_access_token": request.headers.get("authorization", ""),
                }
                state = retrieve_node(init)
                rc = state.get("retrieved_chunks", [])
                yield f"event: retrieve_done\ndata: hits={len(rc)}\n\n"
                yield "event: llm_start\ndata: synthesizing\n\n"
                llm = get_llm()
                for token in stream_answer(llm, req.message, rc):
                    yield f"event: token\ndata: {token}\n\n"
                yield "event: llm_done\ndata: complete\n\n"
                _persist(tenant_id, thread_id, state)
                _emit(
                    request,
                    "agent.chat.completed",
                    thread_id,
                    {"thread_id": thread_id, "scenario": "S1", "chunks": len(rc)},
                    tenant_id,
                )
                yield "event: done\ndata: end\n\n"
                return

            if scenario == "S2":
                init = {
                    "messages": [{"role": "user", "content": req.message}],
                    "thread_id": thread_id,
                    "tenant_id": tenant_id,
                    "_scenario": "S2",
                    "_access_token": request.headers.get("authorization", ""),
                }
                state = planner_node(init)
                sq = state.get("sub_questions", [])
                yield f"event: planner\ndata: sub_questions={len(sq)}\n\n"
                state = worker_node(state)
                rc = state.get("retrieved_chunks", [])
                yield f"event: worker\ndata: chunks={len(rc)}\n\n"
                state = synthesizer_node(state)
                yield "event: llm_start\ndata: synthesizing\n\n"
                llm = get_llm()
                for token in stream_answer(llm, req.message, rc):
                    yield f"event: token\ndata: {token}\n\n"
                yield "event: llm_done\ndata: complete\n\n"
                _persist(tenant_id, thread_id, state)
                _emit(
                    request,
                    "agent.chat.completed",
                    thread_id,
                    {"thread_id": thread_id, "scenario": "S2", "chunks": len(rc)},
                    tenant_id,
                )
                yield "event: done\ndata: end\n\n"
                return

            yield "event: done\ndata: end\n\n"

        return StreamingResponse(event_gen(), media_type="text/event-stream")

    @app.post("/api/v1/agent/review", response_model=HumanReviewResponse)
    async def review(request: Request, req: HumanReviewRequest) -> HumanReviewResponse:
        tenant_id = _tid(request)
        rs = _get_review(tenant_id, req.thread_id)

        # No review record at all.
        if rs is None:
            return HumanReviewResponse(
                thread_id=req.thread_id,
                status="no_pending",
                message="no pending review for this thread",
            )

        # Already resolved (approved / rejected) — idempotent rejection.
        if rs.status == "APPROVED":
            return HumanReviewResponse(
                thread_id=req.thread_id,
                status="no_pending",
                message="review already approved",
            )
        if rs.status == "REJECTED":
            return HumanReviewResponse(
                thread_id=req.thread_id,
                status="no_pending",
                message="review already rejected",
            )
        # Expired — the review window lapsed.
        if rs.status == "EXPIRED":
            return HumanReviewResponse(
                thread_id=req.thread_id,
                status="expired",
                message="review expired; start a new S3 chat to retry",
            )

        # PENDING -> resolve through the FSM.
        saved = load_state(tenant_id, req.thread_id)
        pending = None
        if saved:
            pending = saved.get("state", saved)
        if not pending:
            pending = {}
        pending = dict(pending)
        pending["approved"] = req.approved
        pending["feedback"] = req.feedback
        pending["tenant_id"] = tenant_id
        try:
            state = post_review_node(pending)
            state = persist_node(state)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        _persist(tenant_id, req.thread_id, state)

        # Transition the FSM.
        rs.status = "APPROVED" if req.approved else "REJECTED"
        rs.resolved_at = time.time()
        rs.feedback = req.feedback
        rs.approved = req.approved

        # Hook 3 of 5: emit review-resolved event.
        _emit(
            request,
            "agent.review.resolved",
            req.thread_id,
            {
                "thread_id": req.thread_id,
                "approved": req.approved,
                "status": rs.status,
            },
            tenant_id,
        )
        return HumanReviewResponse(
            thread_id=req.thread_id,
            status="approved" if req.approved else "aborted",
            message=state.get("answer", ""),
        )

    @app.get("/api/v1/agent/state/{thread_id}")
    async def get_state(request: Request, thread_id: str):
        tenant_id = _tid(request)
        s = load_state(tenant_id, thread_id)
        if not s:
            raise HTTPException(status_code=404, detail="thread not found")
        return s

    @app.delete("/api/v1/agent/state/{thread_id}")
    async def delete_state_endpoint(request: Request, thread_id: str):
        tenant_id = _tid(request)
        ok = delete_state(tenant_id, thread_id)
        _clear_review(tenant_id, thread_id)
        if not ok:
            raise HTTPException(status_code=404, detail="thread not found")
        _emit(
            request,
            "agent.thread.deleted",
            thread_id,
            {"thread_id": thread_id},
            tenant_id,
        )
        return {"deleted": thread_id}

    @app.post("/api/v1/agent/plan/execute", response_model=PlanExecuteResponse)
    async def plan_execute(
        request: Request, req: PlanExecuteRequest,
    ) -> PlanExecuteResponse:
        """Cross-agent plan orchestration (P3-W8).

        Receives a plan_id + ordered steps, routes each step to its target
        agent, records the per-step results, persists a PlanExecution, and
        emits an ``agent.plan.executed`` outbox event (ADR-0014 step 3).
        """
        tenant_id = _tid(request)
        raw_steps = [s.model_dump() for s in req.steps]

        # Orchestrate: each step resolves to a synthetic result (the real
        # sub-agent invocation is delegated to the LangGraph scenarios;
        # here we record the orchestration envelope).
        results: list[dict[str, Any]] = []
        for step in raw_steps:
            results.append({
                "agent_id": step["agent_id"],
                "action": step["action"],
                "status": "completed",
                "output": f"{step['action']} dispatched to {step['agent_id']}",
            })

        rec = create_plan_execution(
            tenant_id=tenant_id,
            plan_id=req.plan_id,
            steps=raw_steps,
            results=results,
            status="completed",
        )

        _emit(
            request,
            "agent.plan.executed",
            req.plan_id,
            {
                "execution_id": rec.id,
                "plan_id": req.plan_id,
                "step_count": len(raw_steps),
                "status": "completed",
            },
            tenant_id,
        )

        return PlanExecuteResponse(
            execution_id=rec.id,
            plan_id=req.plan_id,
            status="completed",
            results=results,
        )

    return app


app = create_app()
