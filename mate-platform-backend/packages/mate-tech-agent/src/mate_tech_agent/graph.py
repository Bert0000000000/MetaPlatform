"""LangGraph S1 + S2 scenarios with LLM + memory."""
from __future__ import annotations

import logging
import re
from typing import Any

from langgraph.graph import END, START, StateGraph

from mate_tech_agent.llm import get_llm, synthesize_answer
from mate_tech_agent.memory import save_state
from mate_tech_agent.security.guard import guard_input
from mate_tech_agent.state import AgentState
from mate_tech_agent.tools import get_rag_tool

_log = logging.getLogger(__name__)


def _extract_query(state: dict[str, Any]) -> str:
    for msg in reversed(state.get("messages", [])):
        if isinstance(msg, dict) and msg.get("role") == "user":
            return msg.get("content", "")
        if hasattr(msg, "type") and getattr(msg, "type", "") == "human":
            return getattr(msg, "content", "")
    return ""


def _detect_mode(query: str) -> str:
    if re.search(r"[A-Z][a-z]+", query):
        return "ENTITY"
    return "FACTUAL"


def retrieve_node(state: dict[str, Any]) -> dict[str, Any]:
    """S1: RAG retrieval. Respects guard_blocked + _redacted_query (TC-5.7.11)."""
    if state.get("guard_blocked"):
        return {**state, "retrieved_chunks": [], "guard_blocked": True}
    raw = _extract_query(state)
    query = state.get("_redacted_query") or raw
    if not query:
        return {**state, "error": "no user query found"}
    mode = _detect_mode(query)
    rag = get_rag_tool()
    chunks = rag.search(query, top_k=5, mode=mode)
    return {
        **state,
        "retrieved_chunks": chunks,
        "tool_calls": [*state.get("tool_calls", []), {"name": "rag_search", "args": {"query": query, "mode": mode, "hits": len(chunks)}}],
    }


def answer_node(state: dict[str, Any]) -> dict[str, Any]:
    if state.get("guard_blocked"):
        return {**state, "answer": state.get("answer", "[BLOCKED] Safety guard rejected input.")}
    query = state.get("_redacted_query") or _extract_query(state)
    chunks = state.get("retrieved_chunks", [])
    llm = get_llm()
    answer = synthesize_answer(llm, query, chunks)
    return {**state, "answer": answer}


def planner_node(state: dict[str, Any]) -> dict[str, Any]:
    query = _extract_query(state)
    if not query:
        return {**state, "error": "no query"}
    sub_questions = [
        f"{query} (overview)",
        f"{query} (technical details)",
        f"{query} (examples)",
    ]
    return {**state, "sub_questions": sub_questions}


def worker_node(state: dict[str, Any]) -> dict[str, Any]:
    sub_qs = state.get("sub_questions", [])
    rag = get_rag_tool()
    all_chunks = list(state.get("retrieved_chunks", []))
    for q in sub_qs:
        mode = _detect_mode(q)
        chunks = rag.search(q, top_k=3, mode=mode)
        all_chunks.extend(chunks)
    seen = set()
    unique = []
    for c in all_chunks:
        cid = c.get("chunk_id", "")
        if cid not in seen:
            seen.add(cid)
            unique.append(c)
    return {**state, "retrieved_chunks": unique[:10]}


def synthesizer_node(state: dict[str, Any]) -> dict[str, Any]:
    return answer_node(state)


def should_continue_after_retrieve(state: dict[str, Any]) -> str:
    if state.get("error"):
        return "__end__"
    return "answer"


def should_continue_after_planner(state: dict[str, Any]) -> str:
    if state.get("error") or not state.get("sub_questions"):
        return "__end__"
    return "worker"


def persist_node(state: dict[str, Any]) -> dict[str, Any]:
    """Persist thread state (tenant-scoped, BUSINESS-SLICES).

    Reads ``tenant_id`` from the state dict so the memory store can
    scope the record by ``(tenant_id, thread_id)`` and prevent
    cross-tenant reads.
    """
    tid = state.get("thread_id", "")
    tenant_id = state.get("tenant_id", "")
    if tid and tenant_id:
        save_state(tenant_id, tid, dict(state))
    return state


def build_s1_graph():
    g = StateGraph(AgentState)
    g.add_node("guard", guard_node)
    g.add_node("retrieve", retrieve_node)
    g.add_node("persist", persist_node)
    g.add_node("answer", answer_node)
    g.add_edge(START, "guard")
    g.add_edge("guard", "retrieve")
    g.add_edge("retrieve", "answer")
    g.add_edge("answer", "persist")
    g.add_edge("persist", END)
    return g.compile()


# Backward-compat aliases
should_continue = should_continue_after_retrieve


def build_s2_graph():
    g = StateGraph(AgentState)
    g.add_node("planner", planner_node)
    g.add_node("worker", worker_node)
    g.add_node("synthesizer", synthesizer_node)
    g.add_node("persist", persist_node)
    g.add_edge(START, "planner")
    g.add_conditional_edges("planner", should_continue_after_planner, {"worker": "worker", "__end__": END})
    g.add_edge("worker", "synthesizer")
    g.add_edge("synthesizer", "persist")
    g.add_edge("persist", END)
    return g.compile()

def answer_node_stream(state: dict[str, Any]) -> dict[str, Any]:
    """S1 stream variant: build answer via LLM, expose stream hook (no return)."""
    from mate_tech_agent.llm import get_llm, stream_answer
    chunks = state.get("retrieved_chunks", [])
    query = _extract_query(state)
    llm = get_llm()
    full = "".join(stream_answer(llm, query, chunks))
    return {**state, "answer": full}


def build_s1_stream_graph():
    """S1 streaming graph: adds answer_node_stream that can be consumed via stream()."""
    g = StateGraph(AgentState)
    g.add_node("retrieve", retrieve_node)
    g.add_node("answer", answer_node)
    g.add_node("persist", persist_node)
    g.add_edge(START, "retrieve")
    g.add_conditional_edges("retrieve", should_continue_after_retrieve, {"answer": "answer", "__end__": END})
    g.add_edge("retrieve", "answer")
    g.add_edge("answer", "persist")
    g.add_edge("persist", END)
    return g.compile()

def human_review_node(state: dict[str, Any]) -> dict[str, Any]:
    """S3: pause for human review (returns pending_review state)."""
    return {
        **state,
        "pending_review": True,
        "answer": "[AWAITING HUMAN REVIEW] " + (state.get("answer", "") or "draft answer pending"),
    }


def post_review_node(state: dict[str, Any]) -> dict[str, Any]:
    """S3: finalize after human review."""
    approved = state.get("approved", True)
    feedback = state.get("feedback", "")
    if not approved:
        return {**state, "answer": "[ABORTED] " + (state.get("answer", "") or "review aborted"), "pending_review": False}
    base = state.get("answer", "")
    suffix = f"\n\n[REVIEWED] {feedback}" if feedback else "\n\n[REVIEWED]"
    return {**state, "answer": base + suffix, "pending_review": False, "reviewed": True}


def should_continue_after_review(state: dict[str, Any]) -> str:
    if state.get("error"):
        return "__end__"
    return "answer"


def build_s3_graph():
    """S3: HITL flow (retrieve -> draft -> human_review -> post_review -> persist)."""
    g = StateGraph(AgentState)
    g.add_node("retrieve", retrieve_node)
    g.add_node("answer", answer_node)
    g.add_node("human_review", human_review_node)
    g.add_node("post_review", post_review_node)
    g.add_node("persist", persist_node)
    g.add_edge(START, "retrieve")
    g.add_conditional_edges("retrieve", should_continue_after_retrieve, {"answer": "answer", "__end__": END})
    g.add_edge("answer", "human_review")
    g.add_edge("human_review", "post_review")
    g.add_edge("post_review", "persist")
    g.add_edge("persist", END)
    return g.compile()


# S4: BPMN flow-driven (TC-5.7.8)
def bpmn_deploy_node(state: dict[str, Any]) -> dict[str, Any]:
    """Deploy BPMN process definition to Flowable (TC-5.7.8)."""
    from mate_tech_agent.tools.flowable_tool import get_flowable_tool
    process_key = state.get("process_key", "agent_qa")
    bpmn_xml = _DEFAULT_BPMN_XML
    result = get_flowable_tool().deploy_bpmn(process_key, bpmn_xml, name=process_key)
    return {**state, "deployment_id": result.get("id", ""), "process_key": process_key}


def bpmn_start_node(state: dict[str, Any]) -> dict[str, Any]:
    """Start a process instance on Flowable."""
    from mate_tech_agent.tools.flowable_tool import get_flowable_tool
    variables = {
        "query": _extract_query(state),
        "thread_id": state.get("thread_id", ""),
    }
    inst = get_flowable_tool().start_process(state.get("process_key", "agent_qa"), variables)
    return {**state, "process_instance_id": inst.get("id", ""), "process_status": "running"}


def bpmn_monitor_node(state: dict[str, Any]) -> dict[str, Any]:
    """Poll process instance until completion (with timeout)."""
    from mate_tech_agent.tools.flowable_tool import get_flowable_tool
    inst_id = state.get("process_instance_id", "")
    if not inst_id:
        return {**state, "process_status": "failed", "error": "no instance id"}
    info = get_flowable_tool().get_process_state(inst_id)
    return {**state, "process_status": info.get("status", "running"), "process_result": info.get("result", "")}


def bpmn_complete_node(state: dict[str, Any]) -> dict[str, Any]:
    """Mark process complete and aggregate result."""
    return {**state, "process_status": "completed"}


_DEFAULT_BPMN_XML = """<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:flowable="http://flowable.org/bpmn"
             targetNamespace="http://mate.local/bpmn">
  <process id="agent_qa" name="Agent QA Process" isExecutable="true">
    <startEvent id="start"/>
    <sequenceFlow id="f1" sourceRef="start" targetRef="retrieve"/>
    <serviceTask id="retrieve" name="RAG Retrieve" flowable:class="mate.bpmn.RAGDelegate"/>
    <sequenceFlow id="f2" sourceRef="retrieve" targetRef="answer"/>
    <serviceTask id="answer" name="LLM Answer" flowable:class="mate.bpmn.AnswerDelegate"/>
    <sequenceFlow id="f3" sourceRef="answer" targetRef="end"/>
    <endEvent id="end"/>
  </process>
</definitions>
"""


def build_s4_graph():
    """S4: BPMN flow-driven (deploy BPMN -> start -> monitor -> complete)."""
    g = StateGraph(AgentState)
    g.add_node("bpmn_deploy", bpmn_deploy_node)
    g.add_node("bpmn_start", bpmn_start_node)
    g.add_node("retrieve", retrieve_node)
    g.add_node("answer", answer_node)
    g.add_node("bpmn_monitor", bpmn_monitor_node)
    g.add_node("bpmn_complete", bpmn_complete_node)
    g.add_node("persist", persist_node)
    g.add_edge(START, "bpmn_deploy")
    g.add_edge("bpmn_deploy", "bpmn_start")
    g.add_edge("bpmn_start", "retrieve")
    g.add_edge("retrieve", "answer")
    g.add_edge("answer", "bpmn_monitor")
    g.add_edge("bpmn_monitor", "bpmn_complete")
    g.add_edge("bpmn_complete", "persist")
    g.add_edge("persist", END)
    return g.compile()

def guard_node(state: dict[str, Any]) -> dict[str, Any]:
    """Input safety check (TC-5.7.11): reject prompt injection + redact PII."""
    query = _extract_query(state)
    result = guard_input(query)
    if not result.is_safe:
        return {
            **state,
            "answer": f"[BLOCKED] Safety guard rejected input. Threats: {result.threats}",
            "guard_blocked": True,
            "retrieved_chunks": [],
        }
    if result.pii_found:
        return {
            **state,
            "_redacted_query": result.redacted_input,
            "guard_pii_redacted": result.pii_found,
        }
    return state
