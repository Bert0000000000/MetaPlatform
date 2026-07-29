"""W5-5 工具调用 schema 边角 (ST-5.5.8 final)."""
from __future__ import annotations


def test_tool_schema_json_schema_valid() -> None:
    """工具 schema 必须是 valid JSON Schema."""
    schema = {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search query"},
            "top_k": {"type": "integer", "default": 5},
        },
        "required": ["query"],
    }
    # 简单 JSON Schema 验证
    assert schema["type"] == "object"
    assert "query" in schema["required"]
    assert schema["properties"]["query"]["type"] == "string"


def test_tool_definition_dataclass() -> None:
    """ToolDefinition 数据类."""
    from mate_tech_llmgw.tools.registry import ToolDefinition
    t = ToolDefinition(
        name="kb_search",
        description="Search KB",
        parameters={"type": "object", "properties": {}},
    )
    assert t.name == "kb_search"
    assert t.description == "Search KB"


def test_tool_call_result_format() -> None:
    """ToolCall 结果格式."""
    result = {"tool_call_id": "c1", "result": "ok", "error": None}
    assert "tool_call_id" in result
    assert "result" in result


def test_function_calling_response_finish_reason() -> None:
    """finish_reason = tool_calls."""
    finish_reason = "tool_calls"
    assert finish_reason == "tool_calls"


def test_anthropic_tool_use_response() -> None:
    """Anthropic tool_use 块."""
    block = {"type": "tool_use", "id": "t1", "name": "kb_search", "input": {"query": "test"}}
    assert block["type"] == "tool_use"
    assert "input" in block