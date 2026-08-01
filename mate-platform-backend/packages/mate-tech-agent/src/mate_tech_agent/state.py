"""Agent state."""
from __future__ import annotations

from typing import Annotated, TypedDict

from langgraph.graph.message import add_messages


class AgentState(TypedDict, total=False):
    messages: Annotated[list, add_messages]
    tool_calls: list[dict]
    retrieved_chunks: list[dict]
    answer: str
    sub_questions: list[str]
    error: str
    thread_id: str
    # BUSINESS-SLICES: tenant scoping + scenario tag so persist_node
    # can save state under (tenant_id, thread_id) without a separate
    # channel. LangGraph only retains keys declared in the schema.
    tenant_id: str
    _scenario: str
