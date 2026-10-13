from copy import deepcopy

import pytest

from mate_tech_ont.modeling import ingestion


def source_with_relationship():
    payload = {
        "rid": "ont.tenant-default.link.data-order-customer.v1",
        "src": "ont.tenant-default.obj.data.order.v1",
        "dst": "ont.tenant-default.obj.data.customer.v1",
        "cardinality": "N:1",
        "directionality": "directed",
        "link_properties": [],
        "src_display_name": "订单客户",
        "dst_display_name": "客户订单",
        "description": "订单中的客户编码引用客户。",
    }
    return {
        "plan": {
            "configHash": "same",
            "types": [],
            "relationships": [{"rid": payload["rid"], "payload": payload}],
        },
        "publication": {"status": "succeeded", "configHash": "same", "results": []},
    }


@pytest.mark.asyncio
async def test_verify_baseline_ignores_link_copy_changes(monkeypatch):
    source = source_with_relationship()
    live = deepcopy(source["plan"]["relationships"][0]["payload"])
    live.update(
        src_display_name="所属客户",
        dst_display_name="关联订单",
        description="同一关系的新说明。",
    )

    async def current_link(_request, _rid):
        return live

    monkeypatch.setattr(ingestion, "current_link", current_link)
    await ingestion.verify_baseline(None, source)


@pytest.mark.asyncio
async def test_verify_baseline_rejects_structural_link_changes(monkeypatch):
    source = source_with_relationship()
    live = deepcopy(source["plan"]["relationships"][0]["payload"])
    live["cardinality"] = "N:N"

    async def current_link(_request, _rid):
        return live

    monkeypatch.setattr(ingestion, "current_link", current_link)
    with pytest.raises(ValueError, match="原生关系发布后已变化"):
        await ingestion.verify_baseline(None, source)
