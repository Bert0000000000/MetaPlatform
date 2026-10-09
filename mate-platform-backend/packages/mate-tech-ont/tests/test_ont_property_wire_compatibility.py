"""Property display serialization preserves the stored definition and existing inputs."""

from __future__ import annotations

from copy import deepcopy

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from mate_kernel.ontology.identity import definition_checksum
from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.in_memory import InMemoryOntologyRepository
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat
from mate_platform.tenancy.context import AuthMethod, RequestContext, TenantId, UserId
from mate_tech_ont.v2_kernel.api import router
from mate_tech_ont.v2_kernel.pg_repo import _ot_to_row

TENANT = "propertycompat"
OBJ = "ont.propertycompat.obj.model.v1"
PRIMARY_PROPERTY_RID = "ont.propertycompat.prop.key.v1"
VALUE = "ont.propertycompat.prop.value.v1"
NESTED = "ont.propertycompat.prop.nested.v1"
BASE = "/api/v1/ont/v2"
LEGACY_FORMATS = ("string", "integer", "double", "boolean", "date", "timestamp", "marking")
REGISTERED_FORMATS = (
    *LEGACY_FORMATS,
    "geojson",
    "latlon",
    "timeseries",
    "image",
    "audio",
    "video",
    "struct",
    "vector",
)


@pytest.fixture()
def source_client():
    repo = InMemoryOntologyRepository()
    app = FastAPI()
    app.state.kernel_repo = repo

    @app.middleware("http")
    async def inject_context(request, call_next):
        request.state.ctx = RequestContext(
            request_id="property-wire-test",
            trace_id="property-wire-test",
            tenant_id=TenantId(TENANT),
            user_id=UserId("property-wire-test"),
            roles=frozenset({"editor"}),
            permissions=frozenset({"ont.read", "ont.write"}),
            scopes=frozenset({"platform.read", "platform.write"}),
            auth_method=AuthMethod.USER,
        )
        return await call_next(request)

    app.include_router(router)
    with TestClient(app) as client:
        yield client, repo


def _payload(format_value: str, *, title: str | None = "") -> dict:
    value = {"rid": VALUE, "type_id": format_value, "format": format_value}
    if title is not None:
        value["title"] = title
    if format_value == "struct":
        value["struct_fields"] = [
            {"rid": NESTED, "type_id": "string", "format": "string", "title": ""}
        ]
    return {
        "rid": OBJ,
        "display_name": "Property compatibility",
        "primary_key": [PRIMARY_PROPERTY_RID],
        "properties": [
            {"rid": PRIMARY_PROPERTY_RID, "type_id": "string", "primary_key": True, "title": "Key"},
            value,
        ],
    }


@pytest.mark.parametrize("format_value", REGISTERED_FORMATS)
def test_registered_formats_accept_empty_title_without_writing_display_fallback(
    source_client, format_value
):
    client, repo = source_client

    response = client.post(f"{BASE}/object-types", json=_payload(format_value))

    assert response.status_code == 200
    assert response.json()["properties"][1]["format"] == format_value
    assert response.json()["properties"][1]["title"] == VALUE
    stored = repo.get_object_type(ClassRef(OBJ)).properties[1]
    assert stored.format.value == format_value
    assert stored.title == ""


@pytest.mark.parametrize("format_value", LEGACY_FORMATS)
def test_original_seven_formats_and_explicit_titles_round_trip(source_client, format_value):
    client, repo = source_client

    response = client.post(
        f"{BASE}/object-types", json=_payload(format_value, title="Existing explicit title")
    )

    assert response.status_code == 200
    assert response.json()["properties"][1]["format"] == format_value
    assert response.json()["properties"][1]["title"] == "Existing explicit title"
    stored = repo.get_object_type(ClassRef(OBJ)).properties[1]
    assert stored.format.value == format_value
    assert stored.title == "Existing explicit title"


def test_omitted_title_keeps_the_existing_empty_title_input_semantics(source_client):
    client, repo = source_client

    response = client.post(f"{BASE}/object-types", json=_payload("string", title=None))

    assert response.status_code == 200
    assert response.json()["properties"][1]["title"] == VALUE
    assert repo.get_object_type(ClassRef(OBJ)).properties[1].title == ""


@pytest.mark.parametrize("route", [f"{BASE}/object-types/{OBJ}", f"{BASE}/classes/{OBJ}/inspect"])
def test_nested_display_titles_preserve_raw_definition_checksum_and_version_snapshot(
    source_client, route
):
    client, repo = source_client
    key = Property(ClassRef(PRIMARY_PROPERTY_RID), "string", False, True, "", PropertyFormat.STRING)
    child = Property(ClassRef(NESTED), "string", False, False, "", PropertyFormat.STRING)
    value = Property(
        ClassRef(VALUE), "struct", False, False, "", PropertyFormat.STRUCT, struct_fields=(child,)
    )
    original = ObjectType(
        rid=ClassRef(OBJ),
        primary_key=(key.rid,),
        properties=(key, value),
        display_name="Property compatibility",
    )
    repo.upsert_object_type(original)
    original_definition = deepcopy(_ot_to_row(original))
    original_checksum = definition_checksum(original_definition)
    version = repo.snapshot_version(ClassRef(OBJ), author="wire-test", parent=None)
    version_definition = deepcopy(version.definition)
    version_checksum = version.checksum

    response = client.get(route)

    assert response.status_code == 200
    properties = response.json()["properties"]
    assert properties[0]["title"] == PRIMARY_PROPERTY_RID
    assert properties[1]["title"] == VALUE
    assert properties[1]["struct_fields"][0]["title"] == NESTED
    if "/object-types/" in route:
        assert response.json()["checksum"] == original_checksum
    stored = repo.get_object_type(ClassRef(OBJ))
    assert stored.properties[0].title == ""
    assert stored.properties[1].struct_fields[0].title == ""
    assert _ot_to_row(stored) == original_definition
    assert definition_checksum(_ot_to_row(stored)) == original_checksum
    assert repo.list_versions(ClassRef(OBJ)) == [version]
    assert version.definition == version_definition
    assert version.checksum == version_checksum
