"""FastAPI app for mate-tech-agent (S1 + S2 + S3)."""
from __future__ import annotations

import time
import uuid
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse

from mate_tech_agent import __version__
from mate_tech_agent.api.schemas import (
    ChatRequest,
    ChatResponse,
    HealthResponse,
    HumanReviewRequest,
    HumanReviewResponse,
)
from mate_tech_agent.graph import (
    build_s4_graph,
    build_s1_graph,
    build_s2_graph,
    build_s3_graph,
    human_review_node,
    persist_node,
    post_review_node,
    retrieve_node,
    answer_node,
    planner_node,
    worker_node,
    synthesizer_node,
)
from mate_tech_agent.llm import get_llm, stream_answer
from mate_tech_agent.memory import delete_state, load_state, save_state


_GRAPHS = {
    "S1": build_s1_graph(),
    "S2": build_s2_graph(),
    "S3": build_s3_graph(),
    "S4": build_s4_graph(),
}

_PENDING_REVIEWS: dict[str, dict] = {}


def _run_s3_initial(req, thread_id):
    """S3 first call: retrieve + answer + human_review (paused)."""
    init = {
        "messages": [{"role": "user", "content": req.message}],
        "thread_id": thread_id,
    }
    state = retrieve_node(init)
    state = answer_node(state)
    state = human_review_node(state)
    _PENDING_REVIEWS[thread_id] = dict(state)
    save_state(thread_id, state)
    return state


def create_app() -> FastAPI:
    app = FastAPI(
        title="mate-tech-agent",
        version=__version__,
        description="Mate Platform multi-agent service (LangGraph S1+S2+S3)",
    )

    @app.get("/healthz", response_model=HealthResponse)
    async def healthz() -> HealthResponse:
        return HealthResponse(status="ok", service="mate-tech-agent", version=__version__)

    @app.post("/api/v1/agent/chat", response_model=ChatResponse)
    async def chat(req: ChatRequest) -> ChatResponse:
        if req.scenario not in _GRAPHS:
            raise HTTPException(status_code=501, detail=f"scenario {req.scenario} not implemented")
        thread_id = req.thread_id or str(uuid.uuid4())
        start = time.perf_counter()
        if req.scenario == "S3":
            state = _run_s3_initial(req, thread_id)
        else:
            graph = _GRAPHS[req.scenario]
            prior = load_state(thread_id)
            base = dict(prior) if prior else {}
            base.update({
                "messages": [{"role": "user", "content": req.message}],
                "thread_id": thread_id,
            })
            try:
                state = graph.invoke(base)
            except Exception as exc:
                raise HTTPException(status_code=500, detail=str(exc)) from exc
        latency_ms = int((time.perf_counter() - start) * 1000)
        return ChatResponse(
            thread_id=thread_id,
            scenario=req.scenario,
            answer=state.get("answer", ""),
            retrieved_chunks=state.get("retrieved_chunks", []),
            tool_calls=state.get("tool_calls", []),
            latency_ms=latency_ms,
        )

    @app.post("/api/v1/agent/chat/stream")
    async def chat_stream(req: ChatRequest):
        if req.scenario not in _GRAPHS:
            raise HTTPException(status_code=501, detail=f"scenario {req.scenario} not implemented")
        thread_id = req.thread_id or str(uuid.uuid4())

        async def event_gen():
            yield f"event: thread\ndata: {thread_id}\n\n"
            if req.scenario == "S3":
                init = {
                    "messages": [{"role": "user", "content": req.message}],
                    "thread_id": thread_id,
                }
                state = retrieve_node(init)
                rc = state.get("retrieved_chunks", [])
                yield f"event: retrieve_done\ndata: hits={len(rc)}\n\n"
                state = answer_node(state)
                yield f"event: llm_start\ndata: synthesizing\n\n"
                llm = get_llm()
                for token in stream_answer(llm, req.message, rc):
                    yield f"event: token\ndata: {token}\n\n"
                yield f"event: llm_done\ndata: complete\n\n"
                state = human_review_node(state)
                yield f"event: awaiting_review\ndata: pending=true\n\n"
                _PENDING_REVIEWS[thread_id] = dict(state)
                save_state(thread_id, state)
                yield f"event: done\ndata: paused\n\n"
                return

            if req.scenario == "S1":
                init = {
                    "messages": [{"role": "user", "content": req.message}],
                    "thread_id": thread_id,
                }
                state = retrieve_node(init)
                rc = state.get("retrieved_chunks", [])
                yield f"event: retrieve_done\ndata: hits={len(rc)}\n\n"
                yield f"event: llm_start\ndata: synthesizing\n\n"
                llm = get_llm()
                for token in stream_answer(llm, req.message, rc):
                    yield f"event: token\ndata: {token}\n\n"
                yield f"event: llm_done\ndata: complete\n\n"
                save_state(thread_id, state)
                yield "event: done\ndata: end\n\n"
                return

            if req.scenario == "S2":
                init = {
                    "messages": [{"role": "user", "content": req.message}],
                    "thread_id": thread_id,
                }
                state = planner_node(init)
                sq = state.get("sub_questions", [])
                yield f"event: planner\ndata: sub_questions={len(sq)}\n\n"
                state = worker_node(state)
                rc = state.get("retrieved_chunks", [])
                yield f"event: worker\ndata: chunks={len(rc)}\n\n"
                state = synthesizer_node(state)
                yield f"event: llm_start\ndata: synthesizing\n\n"
                llm = get_llm()
                for token in stream_answer(llm, req.message, rc):
                    yield f"event: token\ndata: {token}\n\n"
                yield f"event: llm_done\ndata: complete\n\n"
                save_state(thread_id, state)
                yield "event: done\ndata: end\n\n"
                return

            yield "event: done\ndata: end\n\n"

        return StreamingResponse(event_gen(), media_type="text/event-stream")

    @app.post("/api/v1/agent/review", response_model=HumanReviewResponse)
    async def review(req: HumanReviewRequest) -> HumanReviewResponse:
        pending = _PENDING_REVIEWS.get(req.thread_id)
        if not pending:
            saved = load_state(req.thread_id)
            if saved and "pending_review" in saved.get("state", {}):
                pending = saved["state"]
        if not pending:
            return HumanReviewResponse(
                thread_id=req.thread_id,
                status="no_pending",
                message="no pending review for this thread",
            )
        pending = dict(pending)
        pending["approved"] = req.approved
        pending["feedback"] = req.feedback
        try:
            state = post_review_node(pending)
            state = persist_node(state)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        save_state(req.thread_id, state)
        _PENDING_REVIEWS.pop(req.thread_id, None)
        return HumanReviewResponse(
            thread_id=req.thread_id,
            status="approved" if req.approved else "aborted",
            message=state.get("answer", ""),
        )

    @app.get("/api/v1/agent/state/{thread_id}")
    async def get_state(thread_id: str):
        s = load_state(thread_id)
        if not s:
            raise HTTPException(status_code=404, detail="thread not found")
        return s

    @app.delete("/api/v1/agent/state/{thread_id}")
    async def delete_state_endpoint(thread_id: str):
        ok = delete_state(thread_id)
        _PENDING_REVIEWS.pop(thread_id, None)
        if not ok:
            raise HTTPException(status_code=404, detail="thread not found")
        return {"deleted": thread_id}

    return app


app = create_app()