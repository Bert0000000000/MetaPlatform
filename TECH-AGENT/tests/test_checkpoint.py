"""Checkpoint service and API tests (P2-AGT-07)."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.checkpoint.schemas import CheckpointState

BASE = "/api/v1/agent"
TENANT = "tenant-test"


class TestCheckpointService:
    async def test_save_and_load_checkpoint(self, registry):
        service = registry.checkpoint_service
        state = CheckpointState(
            node_states={"node1": "completed"},
            intermediate_results=[{"step": 1}],
            current_node="node2",
            iteration=2,
        )
        checkpoint = await service.save_checkpoint(
            TENANT, "exe-001", "agt-001", state
        )
        assert checkpoint.execution_id == "exe-001"
        assert checkpoint.agent_id == "agt-001"
        assert checkpoint.state.current_node == "node2"

        loaded = await service.load_checkpoint(TENANT, "exe-001")
        assert loaded is not None
        assert loaded.checkpoint_id == checkpoint.checkpoint_id
        assert loaded.state.iteration == 2

    async def test_load_nonexistent_checkpoint(self, registry):
        service = registry.checkpoint_service
        result = await service.load_checkpoint(TENANT, "exe-nonexistent")
        assert result is None

    async def test_list_checkpoints_by_agent(self, registry):
        service = registry.checkpoint_service
        state = CheckpointState(current_node="node1")
        await service.save_checkpoint(TENANT, "exe-001", "agt-001", state)
        await service.save_checkpoint(TENANT, "exe-002", "agt-001", state)
        await service.save_checkpoint(TENANT, "exe-003", "agt-002", state)

        checkpoints = await service.list_checkpoints(TENANT, "agt-001")
        assert len(checkpoints) == 2

    async def test_delete_checkpoint(self, registry):
        service = registry.checkpoint_service
        state = CheckpointState(current_node="node1")
        await service.save_checkpoint(TENANT, "exe-001", "agt-001", state)

        ok = await service.delete_checkpoint(TENANT, "exe-001")
        assert ok is True

        loaded = await service.load_checkpoint(TENANT, "exe-001")
        assert loaded is None

    async def test_checkpoint_tenant_isolation(self, registry):
        service = registry.checkpoint_service
        state = CheckpointState(current_node="node1")
        await service.save_checkpoint(TENANT, "exe-001", "agt-001", state)

        # Different tenant cannot see the checkpoint
        loaded = await service.load_checkpoint("tenant-other", "exe-001")
        assert loaded is None


class TestCheckpointAPI:
    async def test_save_checkpoint_api(
        self, client: AsyncClient, tenant_headers: dict
    ):
        resp = await client.post(
            f"{BASE}/executions/exe-api-001/checkpoint",
            json={
                "agentId": "agt-001",
                "state": {
                    "nodeStates": {"node1": "done"},
                    "intermediateResults": [],
                    "conversationContext": [],
                    "currentNode": "node2",
                    "iteration": 1,
                },
            },
            headers=tenant_headers,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["executionId"] == "exe-api-001"
        assert data["checkpointId"].startswith("ckpt-")

    async def test_load_checkpoint_api(
        self, client: AsyncClient, tenant_headers: dict
    ):
        await client.post(
            f"{BASE}/executions/exe-api-002/checkpoint",
            json={
                "agentId": "agt-001",
                "state": {"currentNode": "node1", "iteration": 0},
            },
            headers=tenant_headers,
        )
        resp = await client.get(
            f"{BASE}/executions/exe-api-002/checkpoint",
            headers=tenant_headers,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["executionId"] == "exe-api-002"

    async def test_resume_checkpoint_api(
        self, client: AsyncClient, tenant_headers: dict
    ):
        await client.post(
            f"{BASE}/executions/exe-api-003/checkpoint",
            json={
                "agentId": "agt-001",
                "state": {"currentNode": "node1", "iteration": 0},
            },
            headers=tenant_headers,
        )
        resp = await client.post(
            f"{BASE}/executions/exe-api-003/resume",
            headers=tenant_headers,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["resumed"] is True

    async def test_resume_no_checkpoint_api(
        self, client: AsyncClient, tenant_headers: dict
    ):
        resp = await client.post(
            f"{BASE}/executions/exe-nonexistent/resume",
            headers=tenant_headers,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["resumed"] is False
