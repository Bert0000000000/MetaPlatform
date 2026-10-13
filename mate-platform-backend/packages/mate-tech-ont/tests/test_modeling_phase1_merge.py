"""Phase-one publication must preserve native edits while rejecting structural drift."""

from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from mate_tech_ont.modeling import publication

from .test_modeling_ingestion import source_with_relationship


def publication_source(completed):
    source = source_with_relationship()
    item = source["plan"]["relationships"][0]
    item.update(relationId="belongs", baseline=deepcopy(item["payload"]))
    source.update(id="reviewed-source", revision=1)
    source["plan"]["inputHash"] = "same-input"
    source["publication"].update(
        inputHash="same-input", completed=[item["rid"]] if completed else []
    )
    return source


class SourceStore:
    def __init__(self, source):
        self.source = source

    def update(self, _ident, _revision, changes, *, increment=False):
        assert not increment
        self.source.update(deepcopy(changes))
        return self.source


@pytest.mark.asyncio
@pytest.mark.parametrize("completed", [False, True])
@pytest.mark.parametrize("field", ["description", "src_display_name", "dst_display_name"])
async def test_publication_preserves_native_relationship_metadata(monkeypatch, completed, field):
    source = publication_source(completed)
    live = deepcopy(source["plan"]["relationships"][0]["payload"])
    live[field] = "human-edited metadata"
    before = deepcopy(live)
    write = AsyncMock()
    monkeypatch.setattr(publication, "current_link", AsyncMock(return_value=live))
    monkeypatch.setattr(publication.native, "upsert_link_type", write)

    result = await publication._publish_locked(None, source, SourceStore(source))

    assert result["publication"]["status"] == "succeeded"
    assert result["publication"]["acceptance"]["status"] == "passed"
    write.assert_not_awaited()
    assert live == before


@pytest.mark.asyncio
@pytest.mark.parametrize("completed", [False, True])
@pytest.mark.parametrize(
    "field,value",
    [
        ("src", "ont.tenant-default.obj.data.other.v1"),
        ("dst", "ont.tenant-default.obj.data.other.v1"),
        ("directionality", "undirected"),
        ("cardinality", "N:N"),
        ("link_properties", [{"name": "native-property"}]),
    ],
)
async def test_publication_rejects_native_relationship_structural_drift(
    monkeypatch, completed, field, value
):
    source = publication_source(completed)
    live = deepcopy(source["plan"]["relationships"][0]["payload"])
    live[field] = value
    before = deepcopy(live)
    write = AsyncMock()
    monkeypatch.setattr(publication, "current_link", AsyncMock(return_value=live))
    monkeypatch.setattr(publication.native, "upsert_link_type", write)

    result = await publication._publish_locked(None, source, SourceStore(source))

    assert result["publication"]["status"] == "failed"
    write.assert_not_awaited()
    assert live == before


@pytest.mark.asyncio
async def test_prepare_rejects_existing_relationship_property_schema(monkeypatch):
    classes = [
        {
            "id": ident,
            "name": ident,
            "properties": [{"id": "code", "name": "code", "dataType": "text"}],
            "identity": ["code"],
            "labelProperty": "code",
            "accepted": True,
        }
        for ident in ("order", "customer")
    ]
    source = {
        "id": "source",
        "revision": 1,
        "draft": {
            "name": "review",
            "classes": classes,
            "mappings": [],
            "relationships": [
                {
                    "id": "belongs",
                    "name": "belongs",
                    "source": "order",
                    "target": "customer",
                    "cardinality": "N:1",
                    "accepted": True,
                }
            ],
        },
    }
    monkeypatch.setattr(
        publication.native, "_ctx", lambda _request: SimpleNamespace(tenant_id="tenant-default")
    )
    monkeypatch.setattr(publication, "current_type", AsyncMock(return_value=None))
    monkeypatch.setattr(publication, "datasource_baseline", AsyncMock(return_value=[]))
    monkeypatch.setattr(publication, "native_type_catalog", AsyncMock(return_value=[]))
    monkeypatch.setattr(
        publication.native, "validate_model_endpoint", AsyncMock(return_value={"valid": True})
    )
    monkeypatch.setattr(
        publication.native,
        "precheck_object_type",
        AsyncMock(return_value=SimpleNamespace(model_dump=lambda: {"candidates": []})),
    )

    async def current_link(_request, rid):
        payload = deepcopy(source_with_relationship()["plan"]["relationships"][0]["payload"])
        payload.update(
            rid=rid,
            link_properties=[
                {
                    "rid": "ont.tenant-default.prop.relationship.note.v1",
                    "type_id": "string",
                    "format": "string",
                    "title": "Native link note",
                }
            ],
        )
        return payload

    monkeypatch.setattr(publication, "current_link", current_link)

    with pytest.raises(ValueError, match="关系定义冲突"):
        await publication.prepare(None, source)
