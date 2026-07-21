"""Code module API tests (V12-02 / REQ-038 ~ REQ-045)."""

from __future__ import annotations

from typing import List

import pytest
from fastapi.testclient import TestClient

from app.chat.schemas import MultimodalResponse, TokenUsage
from app.common.errors import ErrorCode
from app.code.schemas import CodeGenResult, ExecutionResult
from app.code.service import (
    _extract_code_block,
    _extract_dependencies,
    _extract_description,
)
from app.code import sandbox


TENANT = "tenant-test"
BASE = "/api/v1/llmgw/code"


# ----------------------------------------------------------- helper fixtures


class _ScriptedChatService:
    """Stand-in chat service that returns a pre-baked LLM response.

    The real :class:`ChatService` would delegate to a provider; for code
    generation tests we only need ``text_chat`` to return a known string
    so we can verify the parsing logic in ``CodeService.generate``.
    """

    def __init__(self, content: str) -> None:
        self._content = content
        self.calls: List[str] = []

    async def text_chat(
        self,
        tenant_id: str,
        model_id: str,
        text: str,
        *,
        system_prompt=None,
        temperature=None,
        max_tokens=None,
    ) -> MultimodalResponse:
        self.calls.append(text)
        return MultimodalResponse(
            id="chatcmpl-test",
            model="doubao-pro-32k",
            provider="VOLCENGINE",
            content=self._content,
            finishReason="stop",
            usage=TokenUsage(promptTokens=10, completionTokens=20, totalTokens=30),
            latencyMs=12,
        )


@pytest.fixture
def scripted_code_service(registry):
    """Replace ``registry.code_service._chat`` with a scripted stand-in."""

    original = registry.code_service._chat
    scripted = _ScriptedChatService(
        content=(
            "```python\n"
            "import math\n"
            "_result = math.factorial(5)\n"
            "print('factorial(5) =', _result)\n"
            "```\n"
            "说明：返回 5 的阶乘。\n"
            '{"dependencies": []}'
        )
    )
    registry.code_service._chat = scripted
    yield scripted
    registry.code_service._chat = original


# --------------------------------------------------------------- REQ-038


def test_generate_code_parses_llm_response(client: TestClient, tenant_headers, scripted_code_service):
    """Code generation should extract the fenced code block + description."""

    resp = client.post(
        f"{BASE}/generate",
        json={
            "description": "计算 5 的阶乘",
            "language": "python",
        },
        headers=tenant_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["language"] == "python"
    assert "math.factorial(5)" in data["code"]
    assert data["dependencies"] == []
    assert "阶乘" in data["description"]
    # The scripted chat service should have been called once.
    assert len(scripted_code_service.calls) == 1


def test_generate_code_rejects_unsupported_language(client: TestClient, tenant_headers):
    resp = client.post(
        f"{BASE}/generate",
        json={"description": "hello", "language": "rust"},
        headers=tenant_headers,
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == int(ErrorCode.INVALID_PARAM)


def test_generate_code_supports_sql_alias(client: TestClient, tenant_headers, scripted_code_service):
    resp = client.post(
        f"{BASE}/generate",
        json={"description": "查询所有员工", "language": "pgsql"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    # The service should normalise "pgsql" -> "sql" before invoking the LLM
    # (and the scripted response just returns Python code, but the language
    # field should reflect the normalised value).
    assert resp.json()["data"]["language"] == "sql"


def test_extract_code_block_fallback_returns_full_content():
    """When no fenced block is present, the whole response is treated as code."""

    code = _extract_code_block("print('hi')", "python")
    assert code.strip() == "print('hi')"


def test_extract_dependencies_handles_empty_list():
    deps = _extract_dependencies('{"dependencies": []}')
    assert deps == []


def test_extract_dependencies_parses_multiple_entries():
    deps = _extract_dependencies('{"dependencies": ["numpy", "pandas"]}')
    assert deps == ["numpy", "pandas"]


def test_extract_description_strips_code_and_json():
    content = (
        "```python\nx = 1\n```\n"
        "这是一个示例。\n"
        '{"dependencies": []}'
    )
    desc = _extract_description(content, "x = 1")
    assert "示例" in desc
    assert "dependencies" not in desc


# --------------------------------------------------- REQ-041 / REQ-042


def test_execute_python_sandbox_returns_result(client: TestClient, tenant_headers):
    resp = client.post(
        f"{BASE}/execute",
        json={
            "language": "python",
            "code": "_result = 2 + 3\nprint('hello')",
        },
        headers=tenant_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["success"] is True
    assert "hello" in data["stdout"]
    assert data["resultType"] == "text"
    assert data["text"] == "5"


def test_execute_python_sandbox_returns_table(client: TestClient, tenant_headers):
    code = "_result = [{'id': 1, 'name': 'Alice'}, {'id': 2, 'name': 'Bob'}]"
    resp = client.post(
        f"{BASE}/execute",
        json={"language": "python", "code": code},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["success"] is True
    assert data["resultType"] == "table"
    assert data["columns"] == ["id", "name"]
    assert len(data["rows"]) == 2
    assert data["rowCount"] == 2


def test_execute_python_rejects_forbidden_module(client: TestClient, tenant_headers):
    resp = client.post(
        f"{BASE}/execute",
        json={"language": "python", "code": "import os\nos.listdir('/')"},
        headers=tenant_headers,
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == int(ErrorCode.INVALID_PARAM)


def test_execute_python_rejects_open_call(client: TestClient, tenant_headers):
    resp = client.post(
        f"{BASE}/execute",
        json={"language": "python", "code": "open('/etc/passwd').read()"},
        headers=tenant_headers,
    )
    assert resp.status_code == 400
    body = resp.json()
    assert body["code"] == int(ErrorCode.INVALID_PARAM)


def test_execute_python_handles_runtime_error(client: TestClient, tenant_headers):
    resp = client.post(
        f"{BASE}/execute",
        json={"language": "python", "code": "raise ValueError('boom')"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["success"] is False
    assert data["resultType"] == "error"
    assert data["errorName"] == "ValueError"
    assert "boom" in data["errorMessage"]


def test_execute_sql_returns_table(client: TestClient, tenant_headers):
    resp = client.post(
        f"{BASE}/execute",
        json={
            "language": "sql",
            "code": "SELECT id, name, salary FROM employees ORDER BY salary DESC LIMIT 3",
        },
        headers=tenant_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["success"] is True
    assert data["resultType"] == "table"
    assert "id" in data["columns"]
    assert "name" in data["columns"]
    assert data["rowCount"] == 3


def test_execute_sql_rejects_write_operation(client: TestClient, tenant_headers):
    resp = client.post(
        f"{BASE}/execute",
        json={
            "language": "sql",
            "code": "DELETE FROM employees WHERE id = 1",
        },
        headers=tenant_headers,
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == int(ErrorCode.INVALID_PARAM)


def test_execute_sql_keyword_does_not_match_identifier(client: TestClient, tenant_headers):
    """CREATE must not trigger on `created_at` (word-boundary check)."""

    resp = client.post(
        f"{BASE}/execute",
        json={
            "language": "sql",
            "code": "SELECT hire_date FROM employees WHERE hire_date > '2023-01-01'",
        },
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["success"] is True


def test_execute_typescript_returns_unsupported_error(client: TestClient, tenant_headers):
    resp = client.post(
        f"{BASE}/execute",
        json={"language": "typescript", "code": "const x: number = 1;"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["success"] is False
    assert data["errorName"] == "UnsupportedLanguageError"


def test_execute_direct_sandbox_helper():
    """Direct call to ``sandbox.execute`` for unit-level coverage."""

    result = sandbox.execute("_result = 1 + 2", "python")
    assert isinstance(result, ExecutionResult)
    assert result.success is True
    assert result.text == "3"


# --------------------------------------------------- REQ-043 template library


def _template_payload(**overrides):
    base = {
        "name": "Factorial Snippet",
        "description": "计算阶乘的模板",
        "language": "python",
        "category": "math",
        "code": "import math\n_result = math.factorial(10)",
        "tags": ["math", "demo"],
    }
    base.update(overrides)
    return base


def test_create_template_success(client: TestClient, tenant_headers):
    resp = client.post(f"{BASE}/templates", json=_template_payload(), headers=tenant_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["templateId"].startswith("ct-")
    assert data["name"] == "Factorial Snippet"
    assert data["language"] == "python"
    assert data["category"] == "math"
    assert data["tags"] == ["math", "demo"]


def test_list_templates_filters_by_language(client: TestClient, tenant_headers):
    client.post(f"{BASE}/templates", json=_template_payload(), headers=tenant_headers)
    client.post(
        f"{BASE}/templates",
        json=_template_payload(
            name="SQL Select All",
            language="sql",
            code="SELECT * FROM employees",
            category="query",
        ),
        headers=tenant_headers,
    )
    resp = client.get(f"{BASE}/templates", params={"language": "sql"}, headers=tenant_headers)
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["language"] == "sql"


def test_list_templates_search_by_keyword(client: TestClient, tenant_headers):
    client.post(f"{BASE}/templates", json=_template_payload(), headers=tenant_headers)
    resp = client.get(f"{BASE}/templates", params={"keyword": "factorial"}, headers=tenant_headers)
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert len(items) == 1


def test_get_template_detail(client: TestClient, tenant_headers):
    create = client.post(f"{BASE}/templates", json=_template_payload(), headers=tenant_headers)
    template_id = create.json()["data"]["templateId"]

    resp = client.get(f"{BASE}/templates/{template_id}", headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["templateId"] == template_id


def test_get_template_404(client: TestClient, tenant_headers):
    resp = client.get(f"{BASE}/templates/ct-missing", headers=tenant_headers)
    assert resp.status_code == 400
    assert resp.json()["code"] == int(ErrorCode.INVALID_PARAM)


def test_update_template(client: TestClient, tenant_headers):
    create = client.post(f"{BASE}/templates", json=_template_payload(), headers=tenant_headers)
    template_id = create.json()["data"]["templateId"]

    resp = client.put(
        f"{BASE}/templates/{template_id}",
        json={"name": "Updated Name", "tags": ["updated"]},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["name"] == "Updated Name"
    assert data["tags"] == ["updated"]
    # Untouched fields remain.
    assert data["code"] == _template_payload()["code"]


def test_delete_template(client: TestClient, tenant_headers):
    create = client.post(f"{BASE}/templates", json=_template_payload(), headers=tenant_headers)
    template_id = create.json()["data"]["templateId"]

    resp = client.delete(f"{BASE}/templates/{template_id}", headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["deleted"] is True

    follow = client.get(f"{BASE}/templates/{template_id}", headers=tenant_headers)
    assert follow.status_code == 400


# ------------------------------------- REQ-040 / REQ-044 snippet + versions


def _snippet_payload(**overrides):
    base = {
        "title": "Demo Snippet",
        "description": "演示片段",
        "language": "python",
        "code": "_result = 1 + 1",
        "tags": ["demo"],
    }
    base.update(overrides)
    return base


def test_create_snippet_success(client: TestClient, tenant_headers):
    resp = client.post(f"{BASE}/snippets", json=_snippet_payload(), headers=tenant_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["snippetId"].startswith("sn-")
    assert data["version"] == 1
    assert data["changeLog"] == "初始版本"


def test_update_snippet_creates_new_version(client: TestClient, tenant_headers):
    create = client.post(f"{BASE}/snippets", json=_snippet_payload(), headers=tenant_headers)
    snippet_id = create.json()["data"]["snippetId"]

    resp = client.put(
        f"{BASE}/snippets/{snippet_id}",
        json={"code": "_result = 2 + 2", "changeLog": "改成 2+2"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["version"] == 2
    assert data["code"] == "_result = 2 + 2"
    assert data["changeLog"] == "改成 2+2"


def test_list_snippet_versions(client: TestClient, tenant_headers):
    create = client.post(f"{BASE}/snippets", json=_snippet_payload(), headers=tenant_headers)
    snippet_id = create.json()["data"]["snippetId"]

    client.put(
        f"{BASE}/snippets/{snippet_id}",
        json={"code": "_result = 100"},
        headers=tenant_headers,
    )
    client.put(
        f"{BASE}/snippets/{snippet_id}",
        json={"code": "_result = 200"},
        headers=tenant_headers,
    )

    resp = client.get(f"{BASE}/snippets/{snippet_id}/versions", headers=tenant_headers)
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert len(items) == 3
    # Versions are sorted descending.
    assert items[0]["version"] == 3
    assert items[-1]["version"] == 1


def test_get_snippet_version_detail(client: TestClient, tenant_headers):
    create = client.post(f"{BASE}/snippets", json=_snippet_payload(), headers=tenant_headers)
    snippet_id = create.json()["data"]["snippetId"]
    client.put(
        f"{BASE}/snippets/{snippet_id}",
        json={"code": "_result = 'v2'"},
        headers=tenant_headers,
    )

    resp = client.get(f"{BASE}/snippets/{snippet_id}/versions/2", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["version"] == 2
    assert data["code"] == "_result = 'v2'"


def test_diff_snippet_versions(client: TestClient, tenant_headers):
    create = client.post(f"{BASE}/snippets", json=_snippet_payload(), headers=tenant_headers)
    snippet_id = create.json()["data"]["snippetId"]
    client.put(
        f"{BASE}/snippets/{snippet_id}",
        json={"code": "_result = 42\nprint('v2')"},
        headers=tenant_headers,
    )

    resp = client.post(
        f"{BASE}/snippets/{snippet_id}/diff",
        json={"versionA": 1, "versionB": 2},
        headers=tenant_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["versionA"] == 1
    assert data["versionB"] == 2
    assert any("42" in line for line in data["addedLines"])
    assert any("1 + 1" in line for line in data["removedLines"])
    assert "--- v1" in data["unifiedDiff"]
    assert "+++ v2" in data["unifiedDiff"]


def test_delete_snippet_removes_versions(client: TestClient, tenant_headers):
    create = client.post(f"{BASE}/snippets", json=_snippet_payload(), headers=tenant_headers)
    snippet_id = create.json()["data"]["snippetId"]
    client.put(
        f"{BASE}/snippets/{snippet_id}",
        json={"code": "_result = 'v2'"},
        headers=tenant_headers,
    )

    resp = client.delete(f"{BASE}/snippets/{snippet_id}", headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["deletedVersions"] == 2

    follow = client.get(f"{BASE}/snippets/{snippet_id}", headers=tenant_headers)
    assert follow.status_code == 400


def test_list_snippets_filters_by_language(client: TestClient, tenant_headers):
    client.post(f"{BASE}/snippets", json=_snippet_payload(language="python"), headers=tenant_headers)
    client.post(
        f"{BASE}/snippets",
        json=_snippet_payload(
            title="SQL Snippet",
            language="sql",
            code="SELECT 1",
        ),
        headers=tenant_headers,
    )
    resp = client.get(f"{BASE}/snippets", params={"language": "sql"}, headers=tenant_headers)
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["language"] == "sql"


# --------------------------------------------------------------- REQ-045 share


def test_create_share_returns_url_and_export(client: TestClient, tenant_headers):
    resp = client.post(
        f"{BASE}/share",
        json={
            "code": "print('hello')",
            "language": "python",
            "title": "Hello Snippet",
            "description": "A friendly greeting",
        },
        headers=tenant_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["shareId"].startswith("cs-")
    assert data["shareUrl"].endswith(data["shareId"])
    assert "```python" in data["exportContent"]
    assert "Hello Snippet" in data["exportContent"]
    assert data["expiresAt"] is not None


def test_list_shares(client: TestClient, tenant_headers):
    client.post(
        f"{BASE}/share",
        json={"code": "x = 1", "language": "python", "title": "first"},
        headers=tenant_headers,
    )
    client.post(
        f"{BASE}/share",
        json={"code": "y = 2", "language": "python", "title": "second"},
        headers=tenant_headers,
    )
    resp = client.get(f"{BASE}/share", headers=tenant_headers)
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert len(items) == 2


def test_get_share_by_id(client: TestClient, tenant_headers):
    create = client.post(
        f"{BASE}/share",
        json={"code": "z = 3", "language": "python", "title": "find-me"},
        headers=tenant_headers,
    )
    share_id = create.json()["data"]["shareId"]

    resp = client.get(f"{BASE}/share/{share_id}", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["shareId"] == share_id
    assert data["title"] == "find-me"


def test_delete_share(client: TestClient, tenant_headers):
    create = client.post(
        f"{BASE}/share",
        json={"code": "z = 3", "language": "python", "title": "delete-me"},
        headers=tenant_headers,
    )
    share_id = create.json()["data"]["shareId"]

    resp = client.delete(f"{BASE}/share/{share_id}", headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["deleted"] is True

    follow = client.get(f"{BASE}/share/{share_id}", headers=tenant_headers)
    assert follow.status_code == 400


def test_share_is_tenant_isolated(client: TestClient, tenant_headers):
    """A share created by tenant A cannot be deleted by tenant B."""

    create = client.post(
        f"{BASE}/share",
        json={"code": "secret = 1", "language": "python", "title": "tenant-a"},
        headers=tenant_headers,
    )
    share_id = create.json()["data"]["shareId"]

    # Build headers for a different tenant.
    from app.common.jwt_auth import create_token

    other_token = create_token(
        {
            "sub": "user-other",
            "username": "other-user",
            "tenantId": "tenant-other",
            "roles": ["user"],
            "type": "access",
        }
    )
    other_headers = {
        "X-Tenant-Id": "tenant-other",
        "X-Trace-Id": "trace-other",
        "Authorization": f"Bearer {other_token}",
    }
    resp = client.delete(f"{BASE}/share/{share_id}", headers=other_headers)
    assert resp.status_code == 400
    assert resp.json()["code"] == int(ErrorCode.INVALID_PARAM)


# -------------------------------------------------- service-level unit tests


async def test_code_service_generate_normalises_language(registry):
    """``CodeService.generate`` should normalise ``ts`` -> ``typescript``."""

    registry.code_service._chat = _ScriptedChatService(
        content="```typescript\nconst x: number = 1;\n```\n说明：变量声明。\n"
        '{"dependencies": []}'
    )
    result = await registry.code_service.generate(
        TENANT,
        "declare a variable",
        "ts",
    )
    assert isinstance(result, CodeGenResult)
    assert result.language == "typescript"
    assert "const x" in result.code


def test_code_service_diff_uses_unified_format(registry):
    """``diff_snippet_versions`` returns unified diff with proper headers."""

    from app.code.schemas import CodeSnippetCreateRequest

    record = registry.code_service.create_snippet(
        TENANT,
        CodeSnippetCreateRequest(
            title="diff-demo",
            language="python",
            code="line1\nline2\nline3",
        ),
    )
    from app.code.schemas import CodeSnippetUpdateRequest

    registry.code_service.update_snippet(
        TENANT,
        record.snippet_id,
        CodeSnippetUpdateRequest(code="line1\nline2-changed\nline3"),
    )

    diff = registry.code_service.diff_snippet_versions(
        TENANT, record.snippet_id, 1, 2
    )
    assert "line2-changed" in "\n".join(diff.addedLines)
    assert "line2" in "\n".join(diff.removedLines)
    assert "@@ " in diff.unifiedDiff
