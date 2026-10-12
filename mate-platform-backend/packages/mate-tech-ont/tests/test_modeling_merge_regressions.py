"""PostgreSQL regressions for modeling identity, mapping drift, and publication races."""

from copy import deepcopy
from io import BytesIO

import httpx
import pytest
from openpyxl import Workbook

from mate_kernel.ontology.identity import ClassRef
from mate_tech_ont.v2_kernel import api as native

from .test_modeling_integration import DSN, candidate, draft, validate_publish
from .test_modeling_integration import app as _modeling_app

app = _modeling_app

pytestmark = pytest.mark.skipif(not DSN, reason="MODELING_TEST_DSN requires isolated PostgreSQL")


def _workbook(sheet_name, rows):
    book = Workbook()
    sheet = book.active
    sheet.title = sheet_name
    for row in rows:
        sheet.append(row)
    output = BytesIO()
    book.save(output)
    return output.getvalue()


async def _save_draft(client, source, value):
    response = await client.put(
        f"/api/v1/ont/v2/modeling/sources/{source['id']}",
        json={
            "revision": source["revision"],
            "draft": value,
            "resolutions": source["resolutions"],
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


async def _validate(client, source):
    response = await client.post(
        f"/api/v1/ont/v2/modeling/sources/{source['id']}/validate",
        json={"revision": source["revision"]},
    )
    assert response.status_code == 200, response.text
    source = response.json()
    assert source["validation"]["canPublish"], source
    return source


@pytest.mark.asyncio
async def test_source_record_mappings_keep_distinct_stable_native_ids(app):
    # Omitting the mapping/row entity key collapses two logical records from one row.
    value = {
        "schemaVersion": 2,
        "name": "Tasks",
        "classes": [
            {
                "id": "task",
                "name": "Task",
                "properties": [{"id": "label", "name": "Label", "dataType": "text"}],
                "identity": [],
                "identityStatus": "source-record",
                "labelProperty": "label",
                "accepted": True,
            }
        ],
        "mappings": [
            {
                "id": "first",
                "classId": "task",
                "sheet": "Tasks",
                "bindings": {"label": "First"},
                "accepted": True,
            },
            {
                "id": "second",
                "classId": "task",
                "sheet": "Tasks",
                "bindings": {"label": "Second"},
                "accepted": True,
            },
        ],
        "relationships": [],
    }
    content = _workbook("Tasks", [["First", "Second"], ["Cut", "Pack"]])
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        source = await candidate(client, content)
        source = await validate_publish(client, await _save_draft(client, source, value))
        item = source["plan"]["types"][0]
        prefix = f"/api/v1/ont/v2/modeling/sources/{source['id']}"
        repo, tenant = app.state.kernel_repo, app.state.test_tenant
        initial_ids = None
        for _ in range(2):
            response = await client.post(prefix + "/sync", json={"revision": source["revision"]})
            assert response.status_code == 200, response.text
            assert response.json()["sync"]["status"] == "succeeded", response.text
            with repo.tenant_scope(tenant):
                instances = repo.list_individuals(ClassRef(item["rid"]))
            assert len(instances) == 2
            assert len({instance.primary_key for instance in instances}) == 2
            ids = {
                instance.get(ClassRef(item["propertyMap"]["label"])): instance.rid
                for instance in instances
            }
            assert set(ids) == {"Cut", "Pack"}
            assert len(set(ids.values())) == 2
            if initial_ids is None:
                initial_ids = ids
            else:
                assert ids == initial_ids

        # A reviewed label correction changes a value, not the source-record identity.
        value["instanceEdits"] = [{"key": "entity:task:row:first:2", "values": {"label": "Saw"}}]
        source["resolutions"] = {
            "task": {
                "mode": "reuse",
                "targetRid": item["rid"],
                "propertyMap": item["propertyMap"],
            }
        }
        source = await validate_publish(client, await _save_draft(client, source, value))
        response = await client.post(prefix + "/sync", json={"revision": source["revision"]})
        assert response.status_code == 200, response.text
        assert response.json()["sync"]["status"] == "succeeded", response.text
        with repo.tenant_scope(tenant):
            instances = repo.list_individuals(ClassRef(item["rid"]))
        assert len(instances) == 2
        assert {
            instance.get(ClassRef(item["propertyMap"]["label"])): instance.rid
            for instance in instances
        } == {"Saw": initial_ids["Cut"], "Pack": initial_ids["Pack"]}


@pytest.mark.asyncio
async def test_deleted_native_field_mapping_blocks_sync_without_restoring_it(app):
    # Comparing only present keys misses a human deletion and silently recreates it.
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        source = await validate_publish(client, await candidate(client))
        item = source["plan"]["types"][0]
        prefix = f"/api/v1/ont/v2/modeling/sources/{source['id']}"
        response = await client.post(prefix + "/sync", json={"revision": source["revision"]})
        assert response.status_code == 200, response.text
        assert response.json()["sync"]["status"] == "succeeded", response.text
        repo, tenant = app.state.kernel_repo, app.state.test_tenant
        with repo.tenant_scope(tenant):
            declaration = repo.list_backing_datasources(item["rid"])[0]
            assert item["propertyMap"]["name"] in declaration["field_mapping"]
            connection, _ = repo._connect()
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
                        "UPDATE ont_backing_datasource SET field_mapping=field_mapping - %s "
                        "WHERE tenant_id=%s AND rid=%s",
                        (item["propertyMap"]["name"], tenant, declaration["rid"]),
                    )
                connection.commit()
            finally:
                connection.close()
            removed_mapping = repo.list_backing_datasources(item["rid"])[0]["field_mapping"]
            assert set(removed_mapping) == {item["propertyMap"]["code"]}
            original_instances = {
                instance.rid: instance.get(ClassRef(item["propertyMap"]["name"]))
                for instance in repo.list_individuals(ClassRef(item["rid"]))
            }
        checked = await client.post(prefix + "/sync-check", json={"revision": source["revision"]})
        assert checked.status_code == 200, checked.text
        assert not checked.json()["syncCheck"]["canSync"]
        assert checked.json()["syncCheck"]["baselineError"]
        refused = await client.post(prefix + "/sync", json={"revision": source["revision"]})
        assert refused.status_code == 422, refused.text
        with repo.tenant_scope(tenant):
            preserved = repo.list_backing_datasources(item["rid"])[0]
            assert preserved["field_mapping"] == removed_mapping
            assert {
                instance.rid: instance.get(ClassRef(item["propertyMap"]["name"]))
                for instance in repo.list_individuals(ClassRef(item["rid"]))
            } == original_instances


@pytest.mark.asyncio
@pytest.mark.parametrize("race_point", ["before_save", "before_apply"])
async def test_new_type_publication_preserves_concurrent_native_creation(
    app, monkeypatch, race_point
):
    # A type created after preflight must never become an implicit extension/update.
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        source = await _validate(client, await candidate(client))
        item = source["plan"]["types"][0]
        repo, tenant = app.state.kernel_repo, app.state.test_tenant
        concurrent = native.ObjectTypeDTO(
            **{**item["payload"], "description": "Created concurrently in the native editor"}
        )

        def create_native_type():
            with repo.tenant_scope(tenant):
                repo.upsert_object_type(native._dto_to_ot(concurrent), create_only=True)

        if race_point == "before_save":
            original = native.save_schema_wip

            async def race(*args, **kwargs):
                create_native_type()
                return await original(*args, **kwargs)

            monkeypatch.setattr(native, "save_schema_wip", race)
        else:
            original = native.apply_schema_wip

            async def race(*args, **kwargs):
                create_native_type()
                return await original(*args, **kwargs)

            monkeypatch.setattr(native, "apply_schema_wip", race)
        response = await client.post(
            f"/api/v1/ont/v2/modeling/sources/{source['id']}/publish",
            json={
                "revision": source["revision"],
                "configHash": source["plan"]["configHash"],
                "acknowledgeWarnings": True,
            },
        )
        assert response.status_code == 200, response.text
        assert response.json()["publication"]["status"] == "failed", response.text
        assert item["rid"] not in response.json()["publication"]["completed"]
        with repo.tenant_scope(tenant):
            preserved = repo.get_object_type(ClassRef(item["rid"]))
        assert preserved.description == "Created concurrently in the native editor"
        assert [key.rid for key in preserved.primary_key] == item["payload"]["primary_key"]
        assert {prop.rid.rid for prop in preserved.properties} == {
            prop["rid"] for prop in item["payload"]["properties"]
        }


@pytest.mark.asyncio
async def test_new_relationship_publication_preserves_concurrent_native_creation(app, monkeypatch):
    # A missing relation baseline must be enforced at the real create operation.
    value = draft()
    target = deepcopy(value["classes"][0])
    target.update(id="target", name="Target")
    value["classes"].append(target)
    mapping = deepcopy(value["mappings"][0])
    mapping.update(id="target_rows", classId="target")
    value["mappings"].append(mapping)
    value["relationships"] = [
        {
            "id": "matches",
            "name": "Matches",
            "source": "item",
            "target": "target",
            "joins": [{"sourceProperty": "code", "targetProperty": "code"}],
            "accepted": True,
            "cardinality": "1:1",
            "cardinalityStatus": "confirmed",
            "cardinalityReason": "Each code identifies one item and one target",
            "targetSelection": "entity",
        }
    ]
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        source = await candidate(client)
        source = await _validate(client, await _save_draft(client, source, value))
        relation = source["plan"]["relationships"][0]
        repo, tenant = app.state.kernel_repo, app.state.test_tenant
        original = native.upsert_link_type

        async def race(*args, **kwargs):
            concurrent = native.LinkTypeDTO(
                **{**relation["payload"], "description": "Concurrent native relationship"}
            )
            with repo.tenant_scope(tenant):
                repo.upsert_link_type(native._dto_to_link_type(concurrent), create_only=True)
            return await original(*args, **kwargs)

        monkeypatch.setattr(native, "upsert_link_type", race)
        response = await client.post(
            f"/api/v1/ont/v2/modeling/sources/{source['id']}/publish",
            json={
                "revision": source["revision"],
                "configHash": source["plan"]["configHash"],
                "acknowledgeWarnings": True,
            },
        )
        assert response.status_code == 200, response.text
        assert response.json()["publication"]["status"] == "failed", response.text
        assert relation["rid"] not in response.json()["publication"]["completed"]
        with repo.tenant_scope(tenant):
            preserved = repo.get_link_type(ClassRef(relation["rid"]))
        assert preserved.description == "Concurrent native relationship"
        assert preserved.cardinality.value == "1:1"
        assert preserved.src.rid == relation["payload"]["src"]
        assert preserved.dst.rid == relation["payload"]["dst"]


@pytest.mark.asyncio
async def test_numeric_identity_reuse_keeps_existing_float_key_and_rid(app):
    # Hashing raw 1.0 against converted 1 duplicates the same numeric business identity.
    value = draft()
    value["classes"][0]["properties"][0]["dataType"] = "number"
    content = _workbook("Items", [["Code", "Name"], [1, "Imported name"]])
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        source = await candidate(client, content)
        published = await validate_publish(client, await _save_draft(client, source, value))
        item = published["plan"]["types"][0]
        tenant = app.state.test_tenant
        original_rid = f"ont.{tenant}.ind.item.1.0"
        response = await client.post(
            "/api/v1/ont/v2/individuals",
            json={
                "rid": original_rid,
                "class_rid": item["rid"],
                "primary_key": "1.0",
                "props": {
                    item["propertyMap"]["code"]: {"value": 1.0},
                    item["propertyMap"]["name"]: {"value": "Native name"},
                },
            },
        )
        assert response.status_code == 200, response.text
        reused = await candidate(
            client,
            content,
            resolutions={
                "item": {
                    "mode": "reuse",
                    "targetRid": item["rid"],
                    "propertyMap": item["propertyMap"],
                }
            },
        )
        reused = await validate_publish(client, await _save_draft(client, reused, value))
        prefix = f"/api/v1/ont/v2/modeling/sources/{reused['id']}"
        for _ in range(2):
            response = await client.post(prefix + "/sync", json={"revision": reused["revision"]})
            assert response.status_code == 200, response.text
            assert response.json()["sync"]["status"] == "succeeded", response.text
            with app.state.kernel_repo.tenant_scope(tenant):
                instances = app.state.kernel_repo.list_individuals(ClassRef(item["rid"]))
            assert len(instances) == 1
            assert instances[0].rid == original_rid
            assert instances[0].primary_key == "1.0"
            assert instances[0].get(ClassRef(item["propertyMap"]["code"])) == 1
            assert instances[0].get(ClassRef(item["propertyMap"]["name"])) == "Imported name"
