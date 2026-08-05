"""LangGraph S1 scenario: single Agent QA with RAG tool."""
from __future__ import annotations

import logging

from langgraph.graph import END, START, StateGraph

from mate_tech_agent.state import AgentState
from mate_tech_agent.tools import get_rag_tool

_log = logging.getLogger(__name__)


def retrieve_node(state):
    messages = state.get("messages", [])
    query = ""
    for msg in reversed(messages):
        if isinstance(msg, dict) and msg.get("role") == "user":
            query = msg.get("content", "")
            break
        if hasattr(msg, "type") and getattr(msg, "type", "") == "human":
            query = getattr(msg, "content", "")
            break
    if not query:
        return {**state, "error": "no user query found"}

    rag = get_rag_tool()
    chunks = rag.search(query, top_k=5, mode="AUTO")
    return {
        **state,
        "retrieved_chunks": chunks,
        "tool_calls": [{"name": "rag_search", "args": {"query": query, "hits": len(chunks)}}],
    }


def answer_node(state):
    chunks = state.get("retrieved_chunks", [])
    query = ""
    for msg in reversed(state.get("messages", [])):
        if isinstance(msg, dict) and msg.get("role") == "user":
            query = msg.get("content", "")
            break

    if not chunks:
        answer = f"I could not find relevant information for: {query!r}"
    else:
        snippets = [c.get("text", "")[:200] for c in chunks[:3] if c.get("text")]
        joined = " | ".join(snippets)
        answer = f"Based on {len(chunks)} retrieved chunks for query {query!r}: {joined}"
    return {**state, "answer": answer}


def should_continue(state):
    if state.get("error"):
        return "__end__"
    return "answer"


def build_s1_graph():
    g = StateGraph(AgentState)
    g.add_node("retrieve", retrieve_node)
    g.add_node("answer", answer_node)
    g.add_edge(START, "retrieve")
    g.add_conditional_edges("retrieve", should_continue, {"answer": "answer", "__end__": END})
    g.add_edge("answer", END)
    return g.compile()
