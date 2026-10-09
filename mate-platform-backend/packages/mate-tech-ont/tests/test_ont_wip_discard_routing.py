"""HTTP regressions for WIP discard versus the ObjectType DELETE catch-all."""

from __future__ import annotations

from unittest.mock import Mock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.in_memory import InMemoryOntologyRepository
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat
from mate_platform.tenancy.context import AuthMethod, RequestContext, TenantId, UserId
from mate_tech_ont.v2_kernel.api import router

TENANT = "wiproute"
OBJ = "ont.wiproute.obj.contract.v1"
FOREIGN_OBJ = "ont.other.obj.contract.v1"
BASE = "/api/v1/ont/v2/object-types"
DISCARD_PATHS = (f"{BASE}/{{rid}}/wip", f"{BASE}/wip/{{rid}}")


@pytest.fixture()
def source_client():
    prop = Property(
        rid=ClassRef("ont.wiproute.prop.key.v1"),
        type_id="string",
        nullable=False,
        primary_key=True,
        title="key",
        format=PropertyFormat.STRING,
    )
    repo = InMemoryOntologyRepository()
    repo.upsert_object_type(
        ObjectType(
            rid=ClassRef(OBJ),
            primary_key=(prop.rid,),
            properties=(prop,),
            display_name="Published contract",
        )
    )
    app = FastAPI()
    app.state.kernel_repo = repo

    @app.middleware("http")
    async def inject_context(request, call_next):
        request.state.ctx = RequestContext(
            request_id="wip-routing-test",
            trace_id="wip-routing-test",
            tenant_id=TenantId(TENANT),
            user_id=UserId("routing-test"),
            roles=frozenset({"editor"}),
            permissions=frozenset({"ont.read", "ont.write"}),
            scopes=frozenset({"platform.read", "platform.write"}),
            auth_method=AuthMethod.USER,
        )
        return await call_next(request)

    app.include_router(router)
    with TestClient(app) as client:
        yield client, repo


@pytest.mark.parametrize("path", DISCARD_PATHS)
def test_discard_wip_preserves_published_type(source_client, path):
    client, repo = source_client
    repo.save_schema_wip(OBJ, {"rid": OBJ, "display_name": "Draft contract"})

    response = client.delete(path.format(rid=OBJ))

    assert response.status_code == 200
    assert response.json() == {"rid": OBJ, "discarded": True}
    assert repo.list_schema_wip() == []
    assert repo.get_object_type(ClassRef(OBJ)).display_name == "Published contract"


@pytest.mark.parametrize("path", DISCARD_PATHS)
def test_discard_wip_denies_foreign_tenant_before_repository_access(
    source_client, path, monkeypatch
):
    client, repo = source_client
    repo.save_schema_wip(FOREIGN_OBJ, {"rid": FOREIGN_OBJ})
    discard = Mock(wraps=repo.delete_schema_wip)
    monkeypatch.setattr(repo, "delete_schema_wip", discard)

    response = client.delete(path.format(rid=FOREIGN_OBJ))

    assert response.status_code == 403
    discard.assert_not_called()
    assert repo.get_schema_wip(FOREIGN_OBJ)["rid"] == FOREIGN_OBJ


def test_object_type_delete_keeps_existing_behavior(source_client):
    client, repo = source_client

    response = client.delete(f"{BASE}/{OBJ}")

    assert response.status_code == 200
    assert response.json() == {
        "class_rid": OBJ,
        "action": "delete",
        "hard": False,
        "archived": True,
    }
    assert repo.list_object_types(limit=10, offset=0) == []


def test_public_schema_has_one_canonical_wip_discard_operation(source_client):
    client, _repo = source_client
    paths = client.app.openapi()["paths"]
    operation = paths[f"{BASE}/{{rid}}/wip"]["delete"]

    assert operation["operationId"] == "ontDiscardV2SchemaWip"
    assert f"{BASE}/wip/{{rid}}" not in paths
    assert operation["x-mate-compatibility-aliases"] == [
        {
            "method": "DELETE",
            "path": f"{BASE}/wip/{{rid}}",
            "deprecated": True,
            "includeInSchema": False,
        }
    ]
