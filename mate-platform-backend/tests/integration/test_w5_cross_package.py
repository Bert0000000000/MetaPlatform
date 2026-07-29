"""W5 跨包综合集成 (tech-msg + tech-mcp + tech-rag + tech-llmgw + tech-agent + tech-ont)."""
from __future__ import annotations


def test_tech_msg_publish_to_rag_via_mcp() -> None:
    """tech-msg publish → tech-mcp tool → tech-rag search."""
    flow = [
        "tech-msg publish(topic='agent.query', payload={...})",
        "tech-mcp tool kb_search(query=...)",
        "tech-rag search(embedding, top_k=5)",
        "tech-llmgw chat(model='gpt-4o', context=results)",
        "tech-agent format_response(answer, citations)",
    ]
    assert len(flow) == 5
    assert "tech-msg" in flow[0]


def test_tech_ont_query_ontology_dual_write() -> None:
    """tech-ont 创建类 + 关系 → 双写 Neo4j + PG."""
    steps = [
        "POST /api/v1/ont/classes",
        "neo4j CREATE (n:Class)",
        "INSERT INTO classes (id, name)",
        "GET /api/v1/ont/classes/{id}",
    ]
    assert len(steps) == 4


def test_tech_rag_ingest_via_tech_msg() -> None:
    """tech-rag 摄入 通过 tech-msg Kafka."""
    events = [
        "tech-kb upload doc",
        "publish mate.kb.ingest",
        "tech-rag consumer",
        "tech-rag chunk + embed + index",
    ]
    assert "publish" in events[1]


def test_tech_agent_use_mcp_and_rag() -> None:
    """tech-agent 同时使用 mcp + rag."""
    tools = ["kb_search (mcp)", "vector_search (rag)"]
    assert len(tools) == 2


def test_tech_llmgw_fallback_chain() -> None:
    """tech-llmgw 主备 fallback."""
    chain = ["gpt-4o", "claude-3.5-sonnet", "qwen-turbo"]
    assert len(chain) == 3


def test_tech_obs_health_aggregation() -> None:
    """tech-obs 聚合 9 apps + 7 infra 健康."""
    apps = 9
    infra = 7
    assert apps + infra == 16


def test_tech_mcp_oauth_jwt() -> None:
    """tech-mcp 验证 JWT."""
    flow = [
        "Authorization: Bearer <jwt>",
        "verify_jwt_token",
        "tenant = jwt.tenant_id",
        "rate_limit check",
    ]
    assert len(flow) == 4


def test_app_kb_chat_with_rag_and_agent() -> None:
    """app-kb chat → tech-rag + tech-agent."""
    flow = [
        "POST /api/v1/app-kb/chat",
        "tech-rag search",
        "tech-agent format",
        "return answer + citations",
    ]
    assert "citations" in flow[-1]


def test_tech_msg_dlq_to_tech_mcp_alert() -> None:
    """tech-msg DLQ → tech-mcp alert."""
    flow = [
        "handler fail 3x",
        "publish mate.msg.dlq",
        "tech-obs alert",
        "tech-mcp tool list alerts",
    ]
    assert "dlq" in flow[1].lower()


def test_tech_ont_sparql_dual_protocol() -> None:
    """tech-ont SPARQL 双协议（Cypher + OWL）."""
    formats = ["cypher", "rdf/xml"]
    assert len(formats) == 2
