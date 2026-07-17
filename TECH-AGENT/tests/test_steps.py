"""Steps & thinking chain API tests (P2-AGT-20)."""

from __future__ import annotations

from httpx import AsyncClient

from app.steps.schemas import StepType

BASE = "/api/v1/agent"
TENANT = "tenant-test"


class TestStepService:
    async def test_record_and_get_steps(self, registry):
        service = registry.step_service
        await service.record_step(
            TENANT, "exe-001", StepType.THINKING, "思考中...", order=1
        )
        await service.record_step(
            TENANT, "exe-001", StepType.TOOL_CALL, "调用工具", order=2
        )
        await service.record_step(
            TENANT, "exe-001", StepType.ANSWER, "最终答案", order=3
        )

        steps = await service.get_steps(TENANT, "exe-001")
        assert len(steps) == 3
        assert steps[0].step_type == StepType.THINKING
        assert steps[2].step_type == StepType.ANSWER

    async def test_get_thinking_chain(self, registry):
        service = registry.step_service
        await service.record_step(
            TENANT, "exe-002", StepType.THINKING, "第一步思考", order=1
        )
        await service.record_step(
            TENANT, "exe-002", StepType.THINKING, "第二步思考", order=2
        )
        await service.record_step(
            TENANT, "exe-002", StepType.TOOL_CALL, "调用工具", order=3
        )

        chain = await service.get_thinking_chain(TENANT, "exe-002")
        assert chain.total_steps == 2
        assert all(s.step_type == StepType.THINKING for s in chain.steps)

    async def test_submit_and_get_evaluations(self, registry):
        service = registry.step_service
        from app.steps.schemas import SubmitEvaluationRequest

        await service.submit_evaluation(
            TENANT,
            "exe-003",
            SubmitEvaluationRequest(score=0.85, feedback="good"),
        )
        await service.submit_evaluation(
            TENANT,
            "exe-003",
            SubmitEvaluationRequest(score=0.9, feedback="great"),
        )

        evals = await service.get_evaluations(TENANT, "exe-003")
        assert len(evals) == 2
        assert evals[0].score == 0.85
        assert evals[1].score == 0.9


class TestStepAPI:
    async def test_get_steps_api(self, client: AsyncClient, tenant_headers: dict):
        # Record a step via service
        # Use the API to get steps
        resp = await client.get(
            f"{BASE}/executions/exe-api-001/steps", headers=tenant_headers
        )
        assert resp.status_code == 200
        assert resp.json()["data"] == []

    async def test_get_thinking_chain_api(
        self, client: AsyncClient, tenant_headers: dict
    ):
        resp = await client.get(
            f"{BASE}/executions/exe-api-002/thinking-chain", headers=tenant_headers
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["executionId"] == "exe-api-002"
        assert data["totalSteps"] == 0

    async def test_submit_evaluation_api(
        self, client: AsyncClient, tenant_headers: dict
    ):
        resp = await client.post(
            f"{BASE}/executions/exe-api-003/evaluations",
            json={"score": 0.95, "feedback": "excellent"},
            headers=tenant_headers,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["score"] == 0.95
        assert data["feedback"] == "excellent"

    async def test_get_evaluations_api(
        self, client: AsyncClient, tenant_headers: dict
    ):
        await client.post(
            f"{BASE}/executions/exe-api-004/evaluations",
            json={"score": 0.8, "feedback": "ok"},
            headers=tenant_headers,
        )
        resp = await client.get(
            f"{BASE}/executions/exe-api-004/evaluations", headers=tenant_headers
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert len(data) == 1
        assert data[0]["score"] == 0.8

    async def test_get_tool_calls_api(self, client: AsyncClient, tenant_headers: dict):
        resp = await client.get(
            f"{BASE}/executions/exe-api-005/tool-calls", headers=tenant_headers
        )
        assert resp.status_code == 200
        assert resp.json()["data"] == []
