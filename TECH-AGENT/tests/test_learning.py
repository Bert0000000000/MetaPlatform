"""Learning module API tests (V15-03)."""

from __future__ import annotations

from httpx import AsyncClient

BASE = "/api/v1/agent"
EMPLOYEE_ID = "emp-001"
TASK_ID = "task-001"


def _feedback_body(**overrides) -> dict:
    body = {
        "employee_id": EMPLOYEE_ID,
        "task_id": TASK_ID,
        "task_title": "测试任务",
        "execution_result": "success",
        "feedback_type": "thumb_up",
        "suggestion": "",
        "tags": ["报销", "财务"],
    }
    body.update(overrides)
    return body


async def test_record_feedback_api(client: AsyncClient, tenant_headers: dict):
    resp = await client.post(
        f"{BASE}/learning/feedback",
        json=_feedback_body(),
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["feedbackId"].startswith("fb-")
    assert data["employeeId"] == EMPLOYEE_ID
    assert data["feedbackType"] == "thumb_up"


async def test_list_feedback_api(client: AsyncClient, tenant_headers: dict):
    await client.post(
        f"{BASE}/learning/feedback",
        json=_feedback_body(task_id="task-a"),
        headers=tenant_headers,
    )
    await client.post(
        f"{BASE}/learning/feedback",
        json=_feedback_body(task_id="task-b", feedback_type="thumb_down"),
        headers=tenant_headers,
    )

    resp = await client.get(
        f"{BASE}/learning/feedback",
        params={"employeeId": EMPLOYEE_ID},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 2


async def test_update_feedback_tags_api(client: AsyncClient, tenant_headers: dict):
    resp = await client.post(
        f"{BASE}/learning/feedback",
        json=_feedback_body(),
        headers=tenant_headers,
    )
    feedback_id = resp.json()["data"]["feedbackId"]

    resp = await client.put(
        f"{BASE}/learning/feedback/{feedback_id}/tags",
        json={"tags": ["发票", "合规"]},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["tags"] == ["发票", "合规"]


async def test_update_feedback_tags_not_found(
    client: AsyncClient, tenant_headers: dict
):
    resp = await client.put(
        f"{BASE}/learning/feedback/fb-not-exist/tags",
        json={"tags": ["x"]},
        headers=tenant_headers,
    )
    assert resp.status_code == 400


async def test_extract_knowledge_from_thumb_up(
    client: AsyncClient, tenant_headers: dict
):
    resp = await client.post(
        f"{BASE}/learning/feedback",
        json=_feedback_body(),
        headers=tenant_headers,
    )
    employee_id = resp.json()["data"]["employeeId"]

    resp = await client.post(
        f"{BASE}/learning/extract",
        json={"employee_id": employee_id},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    knowledge = resp.json()["data"]["knowledge"]
    assert len(knowledge) == 1
    assert knowledge[0]["knowledgeType"] == "experience"
    assert knowledge[0]["confidence"] == 0.9


async def test_extract_knowledge_from_suggestion(
    client: AsyncClient, tenant_headers: dict
):
    await client.post(
        f"{BASE}/learning/feedback",
        json=_feedback_body(
            feedback_type="suggestion",
            suggestion="查询数据库时应增加 timeout 参数",
        ),
        headers=tenant_headers,
    )

    resp = await client.post(
        f"{BASE}/learning/extract",
        json={"employee_id": EMPLOYEE_ID},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    knowledge = resp.json()["data"]["knowledge"]
    assert len(knowledge) == 1
    assert knowledge[0]["knowledgeType"] == "parameter_template"
    assert "timeout" in knowledge[0]["content"]


async def test_list_knowledge_api(client: AsyncClient, tenant_headers: dict):
    await client.post(
        f"{BASE}/learning/feedback",
        json=_feedback_body(),
        headers=tenant_headers,
    )
    await client.post(
        f"{BASE}/learning/extract",
        json={"employee_id": EMPLOYEE_ID},
        headers=tenant_headers,
    )

    resp = await client.get(
        f"{BASE}/learning/employees/{EMPLOYEE_ID}/knowledge",
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["employeeId"] == EMPLOYEE_ID
    assert items[0]["syncedToKb"] is False


async def test_sync_to_knowledge_base_api(client: AsyncClient, tenant_headers: dict):
    await client.post(
        f"{BASE}/learning/feedback",
        json=_feedback_body(),
        headers=tenant_headers,
    )
    await client.post(
        f"{BASE}/learning/extract",
        json={"employee_id": EMPLOYEE_ID},
        headers=tenant_headers,
    )

    resp = await client.post(
        f"{BASE}/learning/employees/{EMPLOYEE_ID}/sync-to-kb",
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["syncedCount"] == 1
    assert len(data["documentIds"]) == 1

    resp = await client.get(
        f"{BASE}/learning/employees/{EMPLOYEE_ID}/knowledge",
        params={"syncedOnly": True},
        headers=tenant_headers,
    )
    assert resp.json()["data"]["items"][0]["syncedToKb"] is True


async def test_get_learning_stats_api(client: AsyncClient, tenant_headers: dict):
    await client.post(
        f"{BASE}/learning/feedback",
        json=_feedback_body(
            feedback_type="thumb_down",
            execution_result="failed",
            suggestion="需要优化",
        ),
        headers=tenant_headers,
    )
    await client.post(
        f"{BASE}/learning/feedback",
        json=_feedback_body(task_id="task-ok"),
        headers=tenant_headers,
    )
    await client.post(
        f"{BASE}/learning/extract",
        json={"employee_id": EMPLOYEE_ID},
        headers=tenant_headers,
    )

    resp = await client.get(
        f"{BASE}/learning/employees/{EMPLOYEE_ID}/stats",
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["employeeId"] == EMPLOYEE_ID
    assert data["totalFeedback"] == 2
    assert data["thumbUp"] == 1
    assert data["thumbDown"] == 1
    assert data["knowledgeFragments"] == 2
    assert data["successRate"] == 0.5
    assert "财务" in data["topTags"]


async def test_extract_knowledge_avoids_duplicates(
    client: AsyncClient, tenant_headers: dict
):
    resp = await client.post(
        f"{BASE}/learning/feedback",
        json=_feedback_body(),
        headers=tenant_headers,
    )
    await client.post(
        f"{BASE}/learning/extract",
        json={"employee_id": EMPLOYEE_ID},
        headers=tenant_headers,
    )
    # Second extraction should not create duplicate knowledge.
    resp = await client.post(
        f"{BASE}/learning/extract",
        json={"employee_id": EMPLOYEE_ID},
        headers=tenant_headers,
    )
    assert len(resp.json()["data"]["knowledge"]) == 0

    resp = await client.get(
        f"{BASE}/learning/employees/{EMPLOYEE_ID}/knowledge",
        headers=tenant_headers,
    )
    assert len(resp.json()["data"]["items"]) == 1


async def test_feedback_filter_by_task_id(client: AsyncClient, tenant_headers: dict):
    await client.post(
        f"{BASE}/learning/feedback",
        json=_feedback_body(task_id="task-x"),
        headers=tenant_headers,
    )
    await client.post(
        f"{BASE}/learning/feedback",
        json=_feedback_body(task_id="task-y"),
        headers=tenant_headers,
    )

    resp = await client.get(
        f"{BASE}/learning/feedback",
        params={"taskId": "task-x"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["total"] == 1
