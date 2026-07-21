import pytest
from fastapi.testclient import TestClient

from app.routing.schemas import OptimizationStrategy, RoutingRequest
from app.routing.service import ModelRoutingOptimizer
from app.routing.repository import RoutingRuleRepository
from app.cost.service import CostReportService
from app.cost.repository import UsageRepository
from app.models.service import ModelService
from app.models.repository import ModelRepository
from main import app


@pytest.fixture
async def routing_optimizer():
    model_repo = ModelRepository()
    model_service = ModelService(model_repo)
    await model_service.sync("tenant-1")
    usage_repo = UsageRepository()
    cost_service = CostReportService(usage_repo)
    rule_repo = RoutingRuleRepository()
    return ModelRoutingOptimizer(model_service, cost_service, rule_repo)


async def test_recommend_cheapest_chat(routing_optimizer):
    req = RoutingRequest(
        promptTokens=1000,
        completionTokens=500,
        requiredCapabilities=["CHAT"],
        strategy=OptimizationStrategy.CHEAPEST,
    )
    rec = await routing_optimizer.recommend("tenant-1", req)
    assert rec.recommendedModelId
    assert rec.estimatedCost >= 0
    assert rec.potentialSavings >= 0
    assert any(c.modelId == rec.recommendedModelId for c in rec.candidates)


async def test_recommend_requires_vision(routing_optimizer):
    req = RoutingRequest(
        promptTokens=1000,
        completionTokens=500,
        requiredCapabilities=["VISION"],
        strategy=OptimizationStrategy.BALANCED,
    )
    rec = await routing_optimizer.recommend("tenant-1", req)
    recommended = next(c for c in rec.candidates if c.modelId == rec.recommendedModelId)
    assert "VISION" in [c.upper() for c in recommended.capabilities]


@pytest.fixture
async def routing_client(registry):
    await registry.model_service.sync("tenant-test")
    app.state.registry = registry
    return TestClient(app)


def test_api_recommend(routing_client, tenant_headers):
    payload = {
        "promptTokens": 1000,
        "completionTokens": 500,
        "requiredCapabilities": ["CHAT"],
        "strategy": "cheapest",
    }
    resp = routing_client.post(
        "/api/v1/llmgw/routing/recommend",
        json=payload,
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["recommendedModelId"]
    assert data["estimatedCost"] >= 0


def test_api_routing_rules_crud(routing_client, tenant_headers):
    # create
    resp = routing_client.post(
        "/api/v1/llmgw/routing/rules",
        json={
            "name": "vision 任务",
            "requiredCapabilities": ["VISION"],
            "strategy": "cheapest",
        },
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    rule_id = resp.json()["data"]["ruleId"]

    # list
    resp = routing_client.get(
        "/api/v1/llmgw/routing/rules",
        headers=tenant_headers,
    )
    assert any(r["ruleId"] == rule_id for r in resp.json()["data"]["items"])

    # update
    resp = routing_client.put(
        f"/api/v1/llmgw/routing/rules/{rule_id}",
        json={"priority": 10},
        headers=tenant_headers,
    )
    assert resp.json()["data"]["priority"] == 10

    # delete
    resp = routing_client.delete(
        f"/api/v1/llmgw/routing/rules/{rule_id}",
        headers=tenant_headers,
    )
    assert resp.status_code == 200
