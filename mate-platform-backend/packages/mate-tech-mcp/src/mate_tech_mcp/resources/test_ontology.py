"""Ontology resource tests (ST-5.3.3)."""
from __future__ import annotations

import pytest
import respx
from httpx import Response

from mate_tech_mcp.resources.ontology import OntologyResource, build_ontology_resource


@pytest.mark.asyncio
@respx.mock
async def test_read_ontology_class() -> None:
    """读 ontology://Concept → 调 tech-ont."""
    respx.get("http://localhost:8007/api/v1/ont/classes/Concept").mock(
        return_value=Response(
            200,
            json={
                "id": "Concept",
                "namespace": "default",
                "properties": [{"name": "label", "type": "string"}],
            },
        )
    )
    r = OntologyResource()
    result = await r.read("ontology://Concept")
    assert result["class_id"] == "Concept"
    assert result["definition"]["id"] == "Concept"
    assert "label" in str(result["definition"])
    await r.aclose()


@pytest.mark.asyncio
async def test_read_unsupported_uri() -> None:
    r = OntologyResource()
    result = await r.read("http://wrong/scheme")
    assert "error" in result


@pytest.mark.asyncio
@respx.mock
async def test_list_classes() -> None:
    respx.get("http://localhost:8007/api/v1/ont/classes").mock(
        return_value=Response(
            200,
            json={
                "items": [
                    {"id": "Concept"},
                    {"id": "Object"},
                ]
            },
        )
    )
    r = OntologyResource()
    items = await r.list_classes()
    assert len(items) == 2
    await r.aclose()


def test_build_factory() -> None:
    r = build_ontology_resource()
    assert r.name == "ontology_class"
    assert r.uri_template == "ontology://{class_id}"