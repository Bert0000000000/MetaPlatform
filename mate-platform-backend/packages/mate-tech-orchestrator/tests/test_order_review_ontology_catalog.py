from __future__ import annotations

import httpx
import pytest
import respx
from mate_tech_orchestrator.order_review.ontology_catalog import (
    ONT_V2_BASE,
    OntologyCatalogError,
    OrderReviewOntologyCatalog,
)

TENANT_ID = "tenant-acme"
AUTH_TOKEN = "test-auth-token"  # noqa: S105 - test token only
OBJECT_RID = f"ont.{TENANT_ID}.obj.crm.order.v1"
ACTION_RID = f"ont.{TENANT_ID}.act.order-review-confirm.v1"
ONT_BASE = "http://mock-tech-ont:8007"


@respx.mock
def test_get_contract_fetches_tenant_scoped_object_and_action_metadata() -> None:
    object_route = respx.get(f"{ONT_BASE}{ONT_V2_BASE}/object-types/{OBJECT_RID}").mock(
        return_value=httpx.Response(
            200,
            json={"rid": OBJECT_RID, "title": "订单"},
        )
    )
    action_route = respx.get(f"{ONT_BASE}{ONT_V2_BASE}/action-types/{ACTION_RID}").mock(
        return_value=httpx.Response(
            200,
            json={"rid": ACTION_RID, "title": "订单复核确认", "on": [OBJECT_RID]},
        )
    )
    catalog = OrderReviewOntologyCatalog(base_url=ONT_BASE)

    try:
        contract = catalog.get_contract(tenant_id=TENANT_ID, token=AUTH_TOKEN)
    finally:
        catalog.close()

    assert contract.object_type["rid"] == OBJECT_RID
    assert contract.action_type["rid"] == ACTION_RID
    assert object_route.called
    assert action_route.called
    assert object_route.calls.last.request.headers["X-Tenant-Id"] == TENANT_ID
    assert action_route.calls.last.request.headers["X-Tenant-Id"] == TENANT_ID
    assert object_route.calls.last.request.headers["Authorization"] == f"Bearer {AUTH_TOKEN}"
    assert action_route.calls.last.request.headers["Authorization"] == f"Bearer {AUTH_TOKEN}"


@respx.mock
def test_get_contract_maps_display_name_to_stable_object_type_title() -> None:
    respx.get(f"{ONT_BASE}{ONT_V2_BASE}/object-types/{OBJECT_RID}").mock(
        return_value=httpx.Response(
            200,
            json={"rid": OBJECT_RID, "display_name": "订单"},
        )
    )
    respx.get(f"{ONT_BASE}{ONT_V2_BASE}/action-types/{ACTION_RID}").mock(
        return_value=httpx.Response(
            200,
            json={"rid": ACTION_RID, "title": "订单复核确认", "on": [OBJECT_RID]},
        )
    )
    catalog = OrderReviewOntologyCatalog(base_url=ONT_BASE)

    try:
        contract = catalog.get_contract(tenant_id=TENANT_ID, token=AUTH_TOKEN)
    finally:
        catalog.close()

    assert contract.object_type == {"rid": OBJECT_RID, "title": "订单"}
    assert contract.action_type == {"rid": ACTION_RID, "title": "订单复核确认", "on": [OBJECT_RID]}


@respx.mock
def test_get_contract_raises_catalog_error_on_non_2xx_response() -> None:
    respx.get(f"{ONT_BASE}{ONT_V2_BASE}/object-types/{OBJECT_RID}").mock(
        return_value=httpx.Response(404, json={"detail": "not found"})
    )
    catalog = OrderReviewOntologyCatalog(base_url=ONT_BASE)

    try:
        with pytest.raises(OntologyCatalogError):
            catalog.get_contract(tenant_id=TENANT_ID, token=AUTH_TOKEN)
    finally:
        catalog.close()


@respx.mock
def test_get_contract_rejects_mismatched_rid_in_response_body() -> None:
    respx.get(f"{ONT_BASE}{ONT_V2_BASE}/object-types/{OBJECT_RID}").mock(
        return_value=httpx.Response(
            200,
            json={"rid": "ont.tenant-globex.obj.crm.order.v1", "title": "订单"},
        )
    )
    catalog = OrderReviewOntologyCatalog(base_url=ONT_BASE)

    try:
        with pytest.raises(OntologyCatalogError):
            catalog.get_contract(tenant_id=TENANT_ID, token=AUTH_TOKEN)
    finally:
        catalog.close()


def test_get_contract_wraps_transport_failures_as_catalog_errors() -> None:
    def _raise_connect_error(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connect boom", request=request)

    client = httpx.Client(
        base_url=ONT_BASE,
        transport=httpx.MockTransport(_raise_connect_error),
    )
    catalog = OrderReviewOntologyCatalog(base_url=ONT_BASE, client=client)

    with pytest.raises(OntologyCatalogError):
        catalog.get_contract(tenant_id=TENANT_ID, token=AUTH_TOKEN)
