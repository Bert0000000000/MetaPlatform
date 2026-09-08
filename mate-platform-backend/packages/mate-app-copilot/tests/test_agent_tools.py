"""Coverage for the live SuperAI agent-loop tool registry endpoint."""
from __future__ import annotations

from typing import Any

from mate_app_copilot.clients.orchestrator_client import OrchestratorClientError


class _SnapshotClient:
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        pass

    async def authorized_role_snapshot(self, **kwargs: Any) -> dict[str, Any]:
        return {
            "items": [
                {"role": "workflow", "capabilities": [{"name": "approve"}]},
                {"role": "knowledge", "capabilities": [{"name": "kb_search"}]},
            ],
            "capability_version": "capability-v7",
            "actor_roles_digest": "roles-sha256-abc",
        }


class _UnavailableSnapshotClient:
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        pass

    async def authorized_role_snapshot(self, **kwargs: Any) -> dict[str, Any]:
        raise OrchestratorClientError("snapshot service unavailable")


def _ontology_tool_names(tools: list[dict[str, Any]]) -> list[str]:
    return [
        str(t.get("function", {}).get("name", ""))
        for t in tools
        if isinstance(t, dict)
    ]


def test_agent_tools_returns_dispatch_and_ontology_tools(
    client, auth_headers_acme, monkeypatch,
) -> None:
    """The registry mirrors the exact tool face run_agent_loop would use."""
    from mate_app_copilot.api import app as copilot_app
    import mate_app_copilot.ontology_tools as ontology_tools

    monkeypatch.setattr(copilot_app, "OrchestratorClient", _SnapshotClient)
    monkeypatch.setattr(
        ontology_tools,
        "build_ontology_tools",
        lambda repo, agent_markings=(): [
            {"type": "function", "function": {"name": "search_objects"}},
            {"type": "function", "function": {"name": "propose_action"}},
        ],
    )

    response = client.get("/api/v1/copilot/agent-tools", headers=auth_headers_acme)

    assert response.status_code == 200, response.text
    body = response.json()
    names = _ontology_tool_names(body["items"])
    assert body["sources"]["orchestrator"] == "ok"
    assert body["sources"]["ontology"] == "ok"
    assert body["total"] == len(body["items"]) == 3
    assert names[0] == "dispatch_employee"
    dispatch_schema = body["items"][0]["function"]
    assert dispatch_schema["parameters"]["properties"]["target_rid"]["enum"] == [
        "workflow", "knowledge",
    ]
    assert names[1:] == ["search_objects", "propose_action"]


def test_agent_tools_degrades_when_orchestrator_unavailable(
    client, auth_headers_acme, monkeypatch,
) -> None:
    """A snapshot outage is reported per-source without failing the read."""
    from mate_app_copilot.api import app as copilot_app
    import mate_app_copilot.ontology_tools as ontology_tools

    monkeypatch.setattr(copilot_app, "OrchestratorClient", _UnavailableSnapshotClient)
    monkeypatch.setattr(
        ontology_tools,
        "build_ontology_tools",
        lambda repo, agent_markings=(): [
            {"type": "function", "function": {"name": "search_objects"}},
        ],
    )

    response = client.get("/api/v1/copilot/agent-tools", headers=auth_headers_acme)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["sources"]["orchestrator"].startswith("unavailable: ")
    assert body["sources"]["ontology"] == "ok"
    assert _ontology_tool_names(body["items"]) == ["search_objects"]


def test_agent_tools_degrades_when_ontology_unavailable(
    client, auth_headers_acme, monkeypatch,
) -> None:
    """An ontology outage keeps the dispatch tool and reports the source."""
    from mate_app_copilot.api import app as copilot_app
    import mate_app_copilot.ontology_tools as ontology_tools

    def _boom(repo: Any, agent_markings: tuple[str, ...] = ()) -> list[dict[str, Any]]:
        raise RuntimeError("tech-ont unreachable")

    monkeypatch.setattr(copilot_app, "OrchestratorClient", _SnapshotClient)
    monkeypatch.setattr(ontology_tools, "build_ontology_tools", _boom)

    response = client.get("/api/v1/copilot/agent-tools", headers=auth_headers_acme)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["sources"]["orchestrator"] == "ok"
    assert body["sources"]["ontology"].startswith("unavailable: ")
    assert _ontology_tool_names(body["items"]) == ["dispatch_employee"]


def test_agent_tools_requires_tenant_context(
    client, monkeypatch,
) -> None:
    """The registry read enforces ADR-0014 step 2 like every other handler."""
    from mate_app_copilot.api import app as copilot_app
    import mate_app_copilot.ontology_tools as ontology_tools

    monkeypatch.setattr(copilot_app, "OrchestratorClient", _SnapshotClient)
    monkeypatch.setattr(ontology_tools, "build_ontology_tools", lambda *_: [])

    response = client.get("/api/v1/copilot/agent-tools")

    assert response.status_code == 401, response.text


def test_agent_tools_contract_operation_is_implemented() -> None:
    """Hard rule #1: the route exists in the canonical OpenAPI contract."""
    import yaml

    contract = yaml.safe_load(
        (
            __import__("pathlib").Path(__file__).resolve().parents[3]
            / "contracts/openapi/services/copilot.yaml"
        ).read_text(encoding="utf-8")
    )
    path = contract["paths"]["/api/v1/copilot/agent-tools"]
    operation = path["get"]
    assert operation["operationId"] == "copilotGetCopilotAgentTools"
    assert operation["x-mate-implementation-status"] == "implemented"
