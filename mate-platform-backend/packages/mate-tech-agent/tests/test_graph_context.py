"""Regression tests for request context propagation through LangGraph."""
from __future__ import annotations

from mate_tech_agent.graph import build_s1_graph
from mate_tech_agent.tools import set_rag_tool


class _CapturingRAGTool:
    def __init__(self) -> None:
        self.access_token = ""
        self.tenant_id = ""

    def search(self, query: str, top_k: int = 5, mode: str = "AUTO", **kwargs):
        self.access_token = kwargs.get("access_token", "")
        self.tenant_id = kwargs.get("tenant_id", "")
        return []


def test_s1_graph_preserves_request_auth_context() -> None:
    rag = _CapturingRAGTool()
    set_rag_tool(rag)
    try:
        build_s1_graph().invoke(
            {
                "messages": [{"role": "user", "content": "status"}],
                "thread_id": "thread-1",
                "tenant_id": "tenant-default",
                "_access_token": "Bearer forwarded-token",
            }
        )
    finally:
        set_rag_tool(None)

    assert rag.access_token == "Bearer forwarded-token"
    assert rag.tenant_id == "tenant-default"
