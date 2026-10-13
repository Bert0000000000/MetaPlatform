"""Published application artifacts must persist without fabricating lifecycle state."""

from dataclasses import replace

import pytest
from mate_app_hub.repositories import in_memory as mem
from mate_app_hub.repositories import sql_store as sql

from mate_tech_db.base import create_all, init_engine, reset_engine


@pytest.fixture
def database(tmp_path):
    url = f"sqlite:///{tmp_path / 'apphub.db'}"
    reset_engine()
    init_engine(url)
    create_all()
    yield url
    reset_engine()


def test_legacy_metadata_does_not_invent_publication_or_timestamps(database):
    app = mem.ApphubApp("app-order", "a", "Orders", "orders", "business", "")
    sql.put_app("a", app)
    actual = sql.get_app("a", "app-order")
    assert getattr(actual, "status", None) == "DESIGNING"
    assert actual.created_at is None
    assert actual.updated_at is None


def test_published_snapshot_and_page_definition_survive_engine_restart(database):
    app = mem.ApphubApp("app-order", "a", "Orders", "orders", "business", "")
    definition = {"widgets": [], "binding": {"object_type": "Order.v1", "fields": ["amount"]}}
    page = mem.ApphubPage("page-order", "a", "Orders", "orders", "orders", "grid")
    assert hasattr(page, "definition"), "actual page definition must be stored"
    sql.put_page("a", replace(page, definition=definition))
    snapshot = {
        "versionId": "v1",
        "version": "1.0.0",
        "status": "PUBLISHED",
        "modules": [{"pages": [definition]}],
    }
    sql.put_app(
        "a", replace(app, status="PUBLISHED", versions=[snapshot], published_version_id="v1")
    )
    reset_engine()
    init_engine(database)
    saved = sql.get_app("a", "app-order")
    assert saved.versions == [snapshot]
    assert saved.published_version_id == "v1"
    assert sql.get_page("a", "page-order").definition == definition
    assert sql.get_app("b", "app-order") is None


def test_sql_write_cannot_overwrite_another_tenants_app(database):
    app = mem.ApphubApp("app-shared", "a", "Original", "orders", "business", "")
    sql.put_app("a", app)
    with pytest.raises(ValueError, match="tenant"):
        sql.put_app("b", replace(app, tenant_id="b", name="Stolen"))
    assert sql.get_app("a", "app-shared").name == "Original"


def test_facade_uses_configured_sql_without_seed_data(database, monkeypatch):
    from mate_app_hub import repositories

    monkeypatch.setenv("MATE_DB_URL", database)
    assert repositories.list_apps("a") == []
    app = mem.ApphubApp("app-order", "a", "Orders", "orders", "business", "")
    repositories.put_app("a", app)
    assert sql.get_app("a", "app-order") == app
    assert repositories.get_app("a", "orders") == app


def test_sql_http_page_save_and_unpublished_runtime(database, monkeypatch, auth_headers_acme):
    from fastapi.testclient import TestClient
    from mate_app_hub.main import create_app

    monkeypatch.setenv("MATE_DB_URL", database)
    app = mem.ApphubApp("app-order", "tenant-acme", "Orders", "orders", "business", "")
    sql.put_app("tenant-acme", app)
    sql.put_module(
        "tenant-acme",
        mem.ApphubModule("mod-order", "tenant-acme", "Orders", "orders", "orders", "", ""),
    )
    sql.put_page(
        "tenant-acme",
        mem.ApphubPage("page-order", "tenant-acme", "Orders", "orders", "orders", "grid"),
    )
    with TestClient(create_app()) as client:
        detail = client.get("/api/v1/apphub/apps/app-order", headers=auth_headers_acme)
        assert detail.status_code == 200
        assert detail.json()["status"] == "DESIGNING"
        assert detail.json()["module_count"] == 1
        saved = client.put(
            "/api/v1/apphub/pages/page-order",
            headers=auth_headers_acme,
            json={
                "name": "Order review",
                "layout": "grid",
                "widgets": [{"id": "real-table", "type": "table"}],
            },
        )
        assert saved.status_code == 200
        assert (
            sql.get_page("tenant-acme", "page-order").definition["widgets"][0]["id"] == "real-table"
        )
        runtime = client.get("/api/v1/apphub/apps/orders/runtime", headers=auth_headers_acme)
        assert runtime.status_code == 409
        assert "publish" in runtime.text.lower()


def test_empty_publish_and_readonly_mutations_fail_closed(client, auth_headers_acme):
    import jwt

    claims = jwt.decode(
        auth_headers_acme["Authorization"].split()[1], options={"verify_signature": False}
    )
    claims["scope"] = "platform.read"
    readonly = {
        "Authorization": "Bearer "
        + jwt.encode(claims, "fixture-only-signing-key-long-enough", algorithm="HS256")
    }
    publish = client.post("/api/v1/apphub/apps/order-review/publish", headers=auth_headers_acme)
    assert publish.status_code == 422
    for path, method, body in [
        ("/apps/order-review/publish", "post", {}),
        ("/pages/page-kb-search", "put", {"name": "Stolen", "widgets": []}),
        ("/shortlinks", "post", {"app_id": "order-review"}),
    ]:
        assert (
            getattr(client, method)(
                "/api/v1/apphub" + path, headers=readonly, json=body
            ).status_code
            == 403
        )


def test_shortlink_uses_sql_and_survives_new_store(database, monkeypatch):
    from mate_app_hub.shortlink.service import (
        create_shortlink,
        get_default_store,
        resolve_shortlink,
        revoke_shortlink,
    )

    monkeypatch.setenv("MATE_DB_URL", database)
    entry = create_shortlink(get_default_store(), "a", "app-order")
    assert sql.get_shortlink_by_code("a", entry.code) is not None
    reset_engine()
    init_engine(database)
    assert resolve_shortlink(get_default_store(), "a", entry.code)["app_id"] == "app-order"
    with pytest.raises(ValueError):
        resolve_shortlink(get_default_store(), "b", entry.code)
    assert revoke_shortlink(get_default_store(), "a", entry.code)
    with pytest.raises(ValueError):
        resolve_shortlink(get_default_store(), "a", entry.code)


def test_saved_binding_publishes_snapshot_runtime_and_tenant_usage(
    client, auth_headers_acme, auth_headers_globex, monkeypatch
):
    import runpy
    from pathlib import Path

    import httpx
    from mate_app_hub.api import app as api_module

    fixtures = runpy.run_path(str(Path(__file__).with_name("test_apphub_order_binding.py")))
    spec, documents = fixtures["spec"], fixtures["documents"]
    # This test covers real AppHub handlers with an explicitly mocked ontology HTTP dependency.
    docs = {key.replace("ont.a.", "ont.tenant-acme."): value for key, value in documents().items()}
    import json

    docs = json.loads(json.dumps(docs).replace("ont.a.", "ont.tenant-acme."))
    docs["/api/v1/ont/v2/object-sets:evaluate"] = []
    docs["/api/v1/ont/v2/link-instances"] = []
    bound = json.loads(json.dumps(spec()).replace("ont.a.", "ont.tenant-acme."))
    monkeypatch.setattr(
        api_module,
        "ontology_client",
        lambda request: httpx.AsyncClient(
            base_url="http://ontology",
            transport=httpx.MockTransport(lambda req: httpx.Response(200, json=docs[req.url.path])),
        ),
        raising=False,
    )
    mem.put_app(
        "tenant-acme",
        mem.ApphubApp("app-real", "tenant-acme", "Real orders", "real", "business", ""),
    )
    mem.put_module(
        "tenant-acme", mem.ApphubModule("mod-real", "tenant-acme", "Orders", "real", "real", "", "")
    )
    mem.put_page(
        "tenant-acme",
        replace(
            mem.ApphubPage("page-real", "tenant-acme", "Orders", "real", "real", "grid"),
            definition={"binding": bound, "widgets": []},
        ),
    )
    published = client.post("/api/v1/apphub/apps/real/publish", headers=auth_headers_acme)
    assert published.status_code == 200, published.text
    versions = client.get("/api/v1/apphub/apps/real/versions", headers=auth_headers_acme).json()[
        "items"
    ]
    assert len(versions) == 1
    assert versions[0]["modules"][0]["pages"][0]["definition"]["binding"]["action_checksum"]
    usage = client.get(
        "/api/v1/apphub/bindings/usage",
        params={"class_rid": bound["object_type"]},
        headers=auth_headers_acme,
    )
    assert usage.status_code == 200
    assert any(
        i["app_id"] == "app-real" and i["status"] == "PUBLISHED" for i in usage.json()["items"]
    )
    denied = client.get(
        "/api/v1/apphub/bindings/usage",
        params={"class_rid": bound["object_type"]},
        headers=auth_headers_globex,
    )
    assert denied.status_code == 403
    # Editing the draft must not mutate the previously published snapshot.
    client.put(
        "/api/v1/apphub/pages/page-real",
        headers=auth_headers_acme,
        json={"name": "Unsaved next release", "widgets": []},
    )
    rt = client.get("/api/v1/apphub/apps/real/runtime", headers=auth_headers_acme)
    assert rt.status_code == 200
    assert rt.json()["render_tree"][0]["config"]["binding"]["object_type"] == bound["object_type"]
    docs["/api/v1/ont/v2/object-types/" + bound["object_type"]]["checksum"] = "changed"
    assert (
        client.get("/api/v1/apphub/apps/real/runtime", headers=auth_headers_acme).status_code == 409
    )


def test_release_snapshot_and_tasks_are_durable_and_tenant_scoped(
    database, monkeypatch, auth_headers_acme, auth_headers_globex
):
    from fastapi.testclient import TestClient
    from mate_app_hub.main import create_app

    monkeypatch.setenv("MATE_DB_URL", database)
    sql.put_app(
        "tenant-acme", mem.ApphubApp("app-real", "tenant-acme", "Real", "real", "business", "")
    )
    sql.put_module(
        "tenant-acme", mem.ApphubModule("mod-real", "tenant-acme", "Real", "real", "real", "", "")
    )
    sql.put_page(
        "tenant-acme",
        replace(
            mem.ApphubPage("page-real", "tenant-acme", "Real", "real", "real", "grid"),
            definition={"widgets": [{"id": "text", "type": "text", "title": "Saved"}]},
        ),
    )
    with TestClient(create_app()) as client:
        release = client.post(
            "/api/v1/apphub/apps/real/releases",
            headers=auth_headers_acme,
            json={"version": "1.2.0", "strategy": "FULL"},
        ).json()
        assert sql.get_app("tenant-acme", "real").releases, "release records must be persisted"
        process = release["processInstanceId"]
        assert (
            client.get(
                "/api/v1/apphub/v1/wfe/release-approval/" + process + "/tasks",
                headers=auth_headers_globex,
            ).status_code
            == 404
        )
    reset_engine()
    init_engine(database)
    with TestClient(create_app()) as client:
        assert (
            client.get(
                "/api/v1/apphub/releases/" + release["releaseId"], headers=auth_headers_acme
            ).status_code
            == 200
        )
        assert (
            client.get(
                "/api/v1/apphub/releases/" + release["releaseId"], headers=auth_headers_globex
            ).status_code
            == 404
        )


def test_offline_app_cannot_issue_shortlink(client, auth_headers_acme):
    mem.put_app(
        "tenant-acme",
        replace(
            mem.ApphubApp("app-offline", "tenant-acme", "Offline", "offline", "business", ""),
            status="OFFLINE",
            published_version_id="previous",
        ),
    )
    response = client.post(
        "/api/v1/apphub/shortlinks", headers=auth_headers_acme, json={"app_id": "offline"}
    )
    assert response.status_code == 409


def test_preview_reads_draft_binding_without_publishing(client, auth_headers_acme, monkeypatch):
    import json
    import runpy
    from pathlib import Path

    import httpx
    from mate_app_hub.api import app as api_module

    fixtures = runpy.run_path(str(Path(__file__).with_name("test_apphub_order_binding.py")))
    docs = json.loads(json.dumps(fixtures["documents"]()).replace("ont.a.", "ont.tenant-acme."))
    bound = json.loads(json.dumps(fixtures["spec"]()).replace("ont.a.", "ont.tenant-acme."))
    queries = []

    def upstream(request):
        if request.url.path.endswith("object-sets:evaluate"):
            query = json.loads(request.content)
            queries.append(query)
            return httpx.Response(200, json=[{"rid": query["class_rid"] + ".one", "props": {}}])
        if request.url.path.endswith("link-instances"):
            return httpx.Response(200, json=[])
        return httpx.Response(200, json=docs[request.url.path])

    monkeypatch.setattr(
        api_module,
        "ontology_client",
        lambda request: httpx.AsyncClient(
            base_url="http://ontology", transport=httpx.MockTransport(upstream)
        ),
    )
    mem.put_page(
        "tenant-acme",
        mem.ApphubPage("page-preview", "tenant-acme", "Draft", "draft", "orders", "grid"),
    )
    response = client.post(
        "/api/v1/apphub/pages/page-preview/preview",
        headers=auth_headers_acme,
        json={"name": "Draft", "binding": bound},
    )
    assert response.status_code == 200, response.text
    assert response.json()["orders"][0]["rid"] == bound["object_type"] + ".one"
    assert response.json()["version"] == "DRAFT_PREVIEW"
    assert queries[0]["class_rid"] == bound["object_type"]
    assert next(p for p in mem.list_pages("tenant-acme") if p.id == "page-preview").definition == {}


@pytest.mark.parametrize("backend", ["sql", "memory"])
def test_stale_application_write_cannot_erase_publication_history(database, backend):
    repo = sql if backend == "sql" else mem
    repo.put_app("race", mem.ApphubApp("app-race", "race", "Race", "race", "business", ""))
    old = repo.get_app("race", "race")
    repo.put_app(
        "race",
        replace(
            old, status="PUBLISHED", published_version_id="new", versions=[{"versionId": "new"}]
        ),
    )
    with pytest.raises(ValueError, match="changed"):
        repo.put_app("race", replace(old, name="stale page save", published_version_id="old"))
    actual = repo.get_app("race", "race")
    assert actual.published_version_id == "new"
    assert actual.versions == [{"versionId": "new"}]


def test_sql_group_creation_is_insert_only_and_tenant_isolated(
    database, monkeypatch, auth_headers_acme, auth_headers_globex
):
    from fastapi.testclient import TestClient
    from mate_app_hub.main import create_app

    monkeypatch.setenv("MATE_DB_URL", database)
    with TestClient(create_app()) as client:
        for headers, name in [
            (auth_headers_acme, "Acme Business"),
            (auth_headers_globex, "Globex Business"),
        ]:
            result = client.post(
                "/api/v1/apphub/groups", headers=headers, json={"code": "business", "name": name}
            )
            assert result.status_code == 201, result.text
        assert sql.get_group("tenant-acme", "business").name == "Acme Business"
        assert sql.get_group("tenant-globex", "business").name == "Globex Business"
        existing = sql.get_group("tenant-acme", "business")
        with pytest.raises(ValueError, match="exists"):
            sql.insert_group("tenant-acme", replace(existing, name="Do not overwrite"))
        assert sql.get_group("tenant-acme", "business").name == "Acme Business"


def test_offline_reverse_reference_reports_actual_application_state(client, auth_headers_acme):
    binding = {"object_type": "ont.tenant-acme.obj.order", "model_checksum": "sha"}
    mem.put_app(
        "tenant-acme",
        replace(
            mem.ApphubApp("ref-offline", "tenant-acme", "Offline", "ref-offline", "business", ""),
            status="OFFLINE",
            published_version_id="v1",
            versions=[
                {
                    "versionId": "v1",
                    "modules": [{"pages": [{"id": "page", "definition": {"binding": binding}}]}],
                }
            ],
        ),
    )
    response = client.get(
        "/api/v1/apphub/bindings/usage",
        params={"class_rid": binding["object_type"]},
        headers=auth_headers_acme,
    )
    assert response.status_code == 200
    assert response.json()["items"][0]["status"] == "OFFLINE"


@pytest.mark.parametrize("shape", ["fresh", "legacy", "already_current"])
def test_role_migration_supports_fresh_legacy_and_startup_created_table(tmp_path, shape):
    import importlib.util
    from pathlib import Path

    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from sqlalchemy import create_engine, inspect, text

    path = (
        Path(__file__).resolve().parents[3]
        / "alembic/versions/20260831_0017_orchestrator_role_actor_roles.py"
    )
    spec = importlib.util.spec_from_file_location("role_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine("sqlite:///" + str(tmp_path / "role-migration.sqlite"))
    with engine.begin() as connection:
        if shape != "fresh":
            connection.execute(
                text(
                    "CREATE TABLE orchestrator_roles(tenant_id VARCHAR(64) NOT NULL, role VARCHAR(64) NOT NULL,name VARCHAR(256) NOT NULL,capabilities TEXT NOT NULL,enabled BOOLEAN NOT NULL,created_at VARCHAR(64) NOT NULL, PRIMARY KEY(tenant_id,role))"
                )
            )
            connection.execute(
                text("INSERT INTO orchestrator_roles VALUES('a','reviewer','Keep','[]',1,'old')")
            )
        if shape == "already_current":
            connection.execute(
                text(
                    "ALTER TABLE orchestrator_roles ADD COLUMN allowed_actor_roles TEXT NOT NULL DEFAULT '[]'"
                )
            )
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            assert "allowed_actor_roles" in {
                c["name"] for c in inspect(connection).get_columns("orchestrator_roles")
            }
            assert set(
                inspect(connection).get_pk_constraint("orchestrator_roles")["constrained_columns"]
            ) == {"tenant_id", "role"}
            if shape != "fresh":
                assert connection.execute(
                    text("SELECT name,allowed_actor_roles FROM orchestrator_roles")
                ).one() == ("Keep", "[]")
            migration.downgrade()
            assert "orchestrator_roles" in inspect(connection).get_table_names()
            assert "allowed_actor_roles" not in {
                c["name"] for c in inspect(connection).get_columns("orchestrator_roles")
            }


def test_publication_migration_adds_revision_and_release_history(tmp_path):
    import importlib.util
    from pathlib import Path

    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from sqlalchemy import create_engine, inspect, text

    path = (
        Path(__file__).resolve().parents[3] / "alembic/versions/20261011_0021_apphub_publication.py"
    )
    spec = importlib.util.spec_from_file_location("publication_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine("sqlite:///" + str(tmp_path / "publication-migration.sqlite"))
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE apphub_apps(id VARCHAR(64) PRIMARY KEY)"))
        connection.execute(text("INSERT INTO apphub_apps VALUES('old')"))
        connection.execute(text("CREATE TABLE apphub_pages(id VARCHAR(64) PRIMARY KEY)"))
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            assert connection.execute(
                text("SELECT revision,releases,versions,status FROM apphub_apps")
            ).one() == (0, "[]", "[]", "DESIGNING")
            migration.upgrade()
            migration.downgrade()
            assert {c["name"] for c in inspect(connection).get_columns("apphub_apps")} == {"id"}


def test_production_requires_explicit_sql_selection(database, monkeypatch):
    from mate_app_hub.main import create_app

    monkeypatch.setenv("MATE_PROFILE", "production")
    monkeypatch.delenv("MATE_DB_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(RuntimeError, match="in-memory AppHub"):
        create_app()
    monkeypatch.setenv("MATE_DB_URL", database)
    assert create_app().title == "mate-app-hub"


def test_page_save_reports_partial_result_when_app_metadata_conflicts(
    client, auth_headers_acme, monkeypatch
):
    from fastapi import HTTPException
    from mate_app_hub.api import app as api

    mem.put_app(
        "tenant-acme", mem.ApphubApp("partial", "tenant-acme", "Partial", "partial", "business", "")
    )
    mem.put_module(
        "tenant-acme",
        mem.ApphubModule("partial", "tenant-acme", "Partial", "partial", "partial", "", ""),
    )
    mem.put_page(
        "tenant-acme",
        mem.ApphubPage("partial", "tenant-acme", "Partial", "partial", "partial", "grid"),
    )

    def conflict(*args, **kwargs):
        raise HTTPException(status_code=409, detail="newer publication")

    monkeypatch.setattr(api, "put_app", conflict)
    response = client.put(
        "/api/v1/apphub/pages/partial",
        headers=auth_headers_acme,
        json={"name": "Saved input", "widgets": []},
    )
    assert response.status_code == 200 and response.json()["application_metadata_updated"] is False
    assert (
        next(p for p in mem.list_pages("tenant-acme") if p.id == "partial").definition["name"]
        == "Saved input"
    )


def test_stale_release_approval_cannot_replace_new_running_snapshot(client, auth_headers_acme):
    headers = auth_headers_acme
    mem.put_app(
        "tenant-acme",
        mem.ApphubApp("stale-release", "tenant-acme", "Release", "stale-release", "business", ""),
    )
    mem.put_module(
        "tenant-acme",
        mem.ApphubModule(
            "stale-release", "tenant-acme", "Release", "stale-release", "stale-release", "", ""
        ),
    )
    mem.put_page(
        "tenant-acme",
        replace(
            mem.ApphubPage(
                "stale-release", "tenant-acme", "Release", "stale-release", "stale-release", "grid"
            ),
            definition={"widgets": [{"id": "text", "type": "text"}]},
        ),
    )
    response = client.post(
        "/api/v1/apphub/apps/stale-release/releases", headers=headers, json={"version": "1.0.0"}
    )
    assert response.status_code == 201, response.text
    release = response.json()
    prefix = "/api/v1/apphub/v1/wfe/release-approval/" + release["processInstanceId"] + "/tasks"
    tasks = client.get(prefix, headers=headers).json()
    assert (
        client.post(
            prefix + "/" + tasks[0]["id"] + "/complete", headers=headers, json={"approved": True}
        ).status_code
        == 200
    )
    newer = client.post("/api/v1/apphub/apps/stale-release/publish", headers=headers)
    assert newer.status_code == 200, newer.text
    result = client.post(
        prefix + "/" + tasks[1]["id"] + "/complete", headers=headers, json={"approved": True}
    )
    assert result.status_code == 409, result.text
    actual = mem.get_app("tenant-acme", "stale-release")
    assert actual.published_version_id == newer.json()["version_id"]
    assert actual.releases[0]["tasks"][1]["status"] == "ACTIVE"


def test_sql_module_and_page_codes_are_isolated_between_tenants(
    database, monkeypatch, auth_headers_acme, auth_headers_globex
):
    from fastapi.testclient import TestClient
    from mate_app_hub.main import create_app

    monkeypatch.setenv("MATE_DB_URL", database)
    for tenant in ["tenant-acme", "tenant-globex"]:
        sql.put_app(tenant, mem.ApphubApp(tenant, tenant, tenant, "orders", "business", ""))
    with TestClient(create_app()) as client:
        for headers, name in [
            (auth_headers_acme, "Acme page"),
            (auth_headers_globex, "Globex page"),
        ]:
            module = client.post(
                "/api/v1/apphub/modules",
                headers=headers,
                json={"code": "review", "name": name, "app_code": "orders"},
            )
            assert module.status_code == 201, module.text
        assert sql.get_module("tenant-acme", "review").name == "Acme page"
        assert sql.get_module("tenant-globex", "review").name == "Globex page"
        for headers, name in [
            (auth_headers_acme, "Acme page"),
            (auth_headers_globex, "Globex page"),
        ]:
            page = client.post(
                "/api/v1/apphub/pages",
                headers=headers,
                json={"code": "review", "name": name, "module_code": "review"},
            )
            assert page.status_code == 201, page.text
        assert (
            next(p for p in sql.list_pages("tenant-acme") if p.code == "review").name == "Acme page"
        )
        assert (
            next(p for p in sql.list_pages("tenant-globex") if p.code == "review").name
            == "Globex page"
        )
    with pytest.raises(ValueError, match="cross-tenant"):
        sql.put_module(
            "tenant-globex",
            replace(
                sql.get_module("tenant-acme", "review"), tenant_id="tenant-globex", name="stolen"
            ),
        )


@pytest.mark.parametrize("backend", ["memory", "sql"])
def test_insert_only_page_preserves_saved_definition_on_duplicate(database, backend):
    repo = sql if backend == "sql" else mem
    page = replace(
        mem.ApphubPage("stable-page", "insert", "Saved", "review", "review", "grid"),
        definition={"binding": {"object_type": "chosen"}},
    )
    repo.put_page("insert", page, insert_only=True)
    with pytest.raises(ValueError, match="exists"):
        repo.put_page("insert", replace(page, definition={}), insert_only=True)
    assert (
        next(p for p in repo.list_pages("insert") if p.code == "review").definition
        == page.definition
    )
    module = mem.ApphubModule("stable-module", "insert", "Saved", "review", "orders", "", "")
    repo.put_module("insert", module, insert_only=True)
    with pytest.raises(ValueError, match="exists"):
        repo.put_module("insert", replace(module, name="overwrite"), insert_only=True)


@pytest.mark.parametrize("store", [mem, sql])
def test_delete_by_returned_id_removes_published_runtime(
    database, monkeypatch, auth_headers_acme, store
):
    from fastapi.testclient import TestClient
    from mate_app_hub.main import create_app

    mem.reset_store()
    if store is sql:
        monkeypatch.setenv("MATE_DB_URL", database)
    else:
        monkeypatch.delenv("MATE_DB_URL", raising=False)
        monkeypatch.delenv("DATABASE_URL", raising=False)
    tid = "tenant-acme"
    store.put_group(tid, mem.ApphubGroup("fix-business", tid, "Business", "business", "", 0))
    with TestClient(create_app()) as client:
        created = client.post(
            "/api/v1/apphub/apps",
            headers=auth_headers_acme,
            json={"name": "Delete me", "code": "fix-delete", "category": "business"},
        )
        assert created.status_code == 201, created.text
        app_id = created.json()["id"]
        store.put_module(
            tid, mem.ApphubModule("fix-module", tid, "Module", "fix-module", "fix-delete", "", "")
        )
        store.put_page(
            tid,
            replace(
                mem.ApphubPage("fix-page", tid, "Page", "fix-page", "fix-module", "grid"),
                definition={"widgets": [{"id": "text", "type": "text"}]},
            ),
        )
        assert (
            client.post(
                f"/api/v1/apphub/apps/{app_id}/publish", headers=auth_headers_acme
            ).status_code
            == 200
        )
        assert (
            client.get(
                "/api/v1/apphub/apps/fix-delete/runtime", headers=auth_headers_acme
            ).status_code
            == 200
        )
        assert (
            client.delete(f"/api/v1/apphub/apps/{app_id}", headers=auth_headers_acme).status_code
            == 200
        )
        assert (
            client.get(f"/api/v1/apphub/apps/{app_id}", headers=auth_headers_acme).status_code
            == 404
        )
        assert (
            client.get(
                "/api/v1/apphub/apps/fix-delete/runtime", headers=auth_headers_acme
            ).status_code
            == 404
        )
        assert (
            client.delete(f"/api/v1/apphub/apps/{app_id}", headers=auth_headers_acme).status_code
            == 404
        )


@pytest.mark.parametrize("store", [mem, sql])
def test_atomic_app_creation_preserves_legacy_id_and_publication(database, store):
    mem.reset_store()
    original = replace(
        mem.ApphubApp("legacy-random-id", "fix-tenant", "Original", "orders", "business", ""),
        versions=[{"versionId": "preserved"}],
        published_version_id="preserved",
    )
    store.put_app("fix-tenant", original)
    duplicate = replace(original, id="new-deterministic-id", name="Overwrite", versions=[])
    with pytest.raises(ValueError, match="already"):
        store.put_app("fix-tenant", duplicate, insert_only=True)
    assert [a for a in store.list_apps("fix-tenant") if a.code == "orders"] == [original]
    other = replace(duplicate, id="other-tenant-id", tenant_id="other-tenant")
    assert store.put_app("other-tenant", other, insert_only=True).id == other.id


def test_draft_version_never_labels_the_running_snapshot(client, auth_headers_acme):
    from .publication_helpers import save_runtime_fixture

    app_id = save_runtime_fixture(client, auth_headers_acme)
    path = "/api/v1/apphub/apps/" + app_id
    first = client.get(path, headers=auth_headers_acme).json()
    patched = client.patch(path, headers=auth_headers_acme, json={"version": "2.0.0"})
    assert patched.status_code == 200
    assert patched.json()["version"] == "2.0.0"
    assert patched.json()["published_version"] == first["version"]
    assert (
        client.get(path + "/runtime", headers=auth_headers_acme).json()["version"]
        == first["version"]
    )
    assert client.post(path + "/publish", headers=auth_headers_acme).status_code == 200
    assert client.get(path, headers=auth_headers_acme).json()["published_version"] == "2.0.0"
    assert (
        client.post(
            path + "/versions/" + first["published_version_id"] + "/rollback",
            headers=auth_headers_acme,
        ).status_code
        == 200
    )
    rolled = client.get(path, headers=auth_headers_acme).json()
    assert rolled["published_version"] == first["version"]
    assert (
        client.get(path + "/runtime", headers=auth_headers_acme).json()["version"]
        == rolled["published_version"]
    )


def test_publication_checkpoint_checks_actual_saved_pages_and_access(client, auth_headers_acme):
    from .publication_helpers import save_runtime_fixture

    path = "/api/v1/apphub/apps/kb/publication-check"
    empty = client.get(path, headers=auth_headers_acme)
    assert empty.status_code == 200
    assert empty.json()["can_publish"] is False
    assert {c["key"] for c in empty.json()["checks"]} == {
        "bindings",
        "reference_versions",
        "access",
        "components",
        "action_policy",
        "runtime",
    }
    assert next(c for c in empty.json()["checks"] if c["key"] == "components")["status"] == "fail"
    save_runtime_fixture(client, auth_headers_acme, publish=False)
    ready = client.get(path, headers=auth_headers_acme).json()
    assert ready["can_publish"] is True
    assert all(c["status"] == "pass" for c in ready["checks"])
    assert (
        client.get("/api/v1/apphub/apps/kb", headers=auth_headers_acme).json()[
            "published_version_id"
        ]
        is None
    )


def test_history_authorizes_snapshot_page_and_ignores_live_objectset(
    client, auth_headers_acme, auth_headers_globex, monkeypatch
):
    import httpx
    from mate_app_hub.api import app as api

    tid = "tenant-acme"
    snapshot = {
        "versionId": "v-history",
        "version": "1.0.0",
        "status": "PUBLISHED",
        "modules": [
            {
                "pages": [
                    {
                        "id": "page-history",
                        "definition": {"binding": {"action_rid": "ont.tenant-acme.act.review"}},
                    }
                ]
            }
        ],
    }
    mem.put_app(
        tid,
        replace(
            mem.ApphubApp("app-history", tid, "History", "history", "business", ""),
            status="PUBLISHED",
            published_version_id="v-history",
            versions=[snapshot],
        ),
    )
    calls = []

    def upstream(request):
        assert request.url.path.endswith("/action-audit")
        calls.append(dict(request.url.params))
        return httpx.Response(
            200, json=[{"audit_id": "receipt", "target_iid": "order-no-longer-pending"}]
        )

    monkeypatch.setattr(
        api,
        "ontology_client",
        lambda request: httpx.AsyncClient(
            base_url="http://ontology", transport=httpx.MockTransport(upstream)
        ),
    )
    url = "/api/v1/apphub/apps/app-history/runtime/history"
    result = client.get(
        url,
        headers=auth_headers_acme,
        params={"page_id": "page-history", "app_version_id": "forged"},
    )
    assert result.status_code == 200
    assert result.json()[0]["audit_id"] == "receipt"
    assert calls == [
        {
            "limit": "100",
            "action_rid": "ont.tenant-acme.act.review",
            "app_id": "app-history",
            "page_id": "page-history",
            "app_version_id": "v-history",
        }
    ]
    for headers, params in [
        (auth_headers_globex, {"page_id": "page-history"}),
        (auth_headers_acme, {"page_id": "other-page"}),
        (auth_headers_acme, {"page_id": "page-history", "version_id": "draft-or-other"}),
    ]:
        assert client.get(url, headers=headers, params=params).status_code == 404
    assert len(calls) == 1


def test_publication_dependency_failure_is_unknown_and_preserves_draft(
    client, auth_headers_acme, monkeypatch
):
    import json

    import httpx
    from mate_app_hub.api import app as api

    from .test_apphub_order_binding import spec

    bound = json.loads(json.dumps(spec()).replace("ont.a.", "ont.tenant-acme."))
    mem.put_module(
        "tenant-acme", mem.ApphubModule("check-m", "tenant-acme", "Check", "check-m", "kb", "", "")
    )
    page = replace(
        mem.ApphubPage("check-p", "tenant-acme", "Check", "check-p", "check-m", "grid"),
        definition={"binding": bound},
    )
    mem.put_page("tenant-acme", page)
    monkeypatch.setattr(
        api,
        "ontology_client",
        lambda request: httpx.AsyncClient(
            base_url="http://ontology", transport=httpx.MockTransport(lambda _: httpx.Response(503))
        ),
    )
    report = client.get(
        "/api/v1/apphub/apps/kb/publication-check", headers=auth_headers_acme
    ).json()
    assert report["can_publish"] is False
    assert next(c for c in report["checks"] if c["key"] == "bindings")["status"] == "unknown"
    assert (
        client.post("/api/v1/apphub/apps/kb/publish", headers=auth_headers_acme).status_code == 422
    )
    assert (
        next(p for p in mem.list_pages("tenant-acme") if p.id == page.id).definition
        == page.definition
    )
    assert mem.get_app("tenant-acme", "kb").published_version_id is None


def test_proposal_attribution_keeps_loaded_snapshot_across_concurrent_publication(
    client, auth_headers_acme, monkeypatch
):
    import json

    import httpx
    from mate_app_hub.api import app as api

    from .test_apphub_order_binding import documents, spec

    bound = json.loads(json.dumps(spec()).replace("ont.a.", "ont.tenant-acme."))
    docs = json.loads(json.dumps(documents()).replace("ont.a.", "ont.tenant-acme."))
    snapshot = {
        "versionId": "loaded-v1",
        "version": "1.0.0",
        "status": "PUBLISHED",
        "modules": [{"pages": [{"id": "fixed-page", "definition": {"binding": bound}}]}],
    }
    app = replace(
        mem.ApphubApp("fixed-app", "tenant-acme", "Fixed", "fixed", "business", ""),
        status="PUBLISHED",
        published_version_id="loaded-v1",
        versions=[snapshot],
    )
    mem.put_app("tenant-acme", app)
    original_load = api.load_app_runtime

    def concurrent_publish(*args, **kwargs):
        context = original_load(*args, **kwargs)
        current = mem.get_app("tenant-acme", "fixed")
        newer = {**snapshot, "versionId": "new-v2", "version": "2.0.0"}
        mem.put_app(
            "tenant-acme",
            replace(current, published_version_id="new-v2", versions=[newer, snapshot]),
        )
        return context

    monkeypatch.setattr(api, "load_app_runtime", concurrent_publish)
    proposed = []

    def upstream(request):
        if request.url.path.endswith("object-sets:evaluate"):
            return httpx.Response(200, json=[{"rid": "order-in-loaded-set"}])
        if request.url.path.endswith("/propose"):
            proposed.append(json.loads(request.content))
            return httpx.Response(200, json={"proposal_id": "fixed-proposal"})
        return httpx.Response(200, json=docs[request.url.path])

    monkeypatch.setattr(
        api,
        "ontology_client",
        lambda request: httpx.AsyncClient(
            base_url="http://ontology", transport=httpx.MockTransport(upstream)
        ),
    )
    response = client.post(
        "/api/v1/apphub/apps/fixed/runtime/execute",
        headers=auth_headers_acme,
        json={
            "action_type": "ontology_propose",
            "page_id": "fixed-page",
            "provenance": {"app_id": "forged"},
            "payload": {"target_iid": "order-in-loaded-set", "parameters": {"amount": 5}},
        },
    )
    assert response.status_code == 200
    assert proposed[0]["provenance"] == {
        "source": "user",
        "app_id": "fixed-app",
        "page_id": "fixed-page",
        "app_version": "1.0.0",
        "app_version_id": "loaded-v1",
    }
    assert proposed[0]["parameters"] == {"amount": 5}
    assert mem.get_app("tenant-acme", "fixed").published_version_id == "new-v2"


@pytest.mark.parametrize("store", [mem, sql])
def test_delete_prefers_exact_id_over_another_apps_code(
    database, monkeypatch, auth_headers_acme, store
):
    from fastapi.testclient import TestClient
    from mate_app_hub.main import create_app

    if store is sql:
        monkeypatch.setenv("MATE_DB_URL", database)
    else:
        monkeypatch.delenv("MATE_DB_URL", raising=False)
        monkeypatch.delenv("DATABASE_URL", raising=False)
        mem.reset_store()
    tid = "tenant-acme"
    code_owner = mem.ApphubApp("different-id", tid, "A code owner", "collision-key", "business", "")
    id_owner = mem.ApphubApp("collision-key", tid, "Z id owner", "different-code", "business", "")
    store.put_app(tid, code_owner)
    store.put_app(tid, id_owner)
    with TestClient(create_app()) as client:
        response = client.delete("/api/v1/apphub/apps/collision-key", headers=auth_headers_acme)
        assert response.status_code == 200
    remaining = store.list_apps(tid)
    assert code_owner in remaining
    assert id_owner not in remaining


def test_proposal_context_validates_old_snapshot_readonly_and_actual_target(
    client, auth_headers_acme, auth_headers_globex, monkeypatch
):
    import json

    import httpx
    import jwt
    from mate_app_hub.api import app as api

    from .test_apphub_order_binding import documents, spec

    bound = json.loads(json.dumps(spec()).replace("ont.a.", "ont.tenant-acme."))
    docs = json.loads(json.dumps(documents()).replace("ont.a.", "ont.tenant-acme."))
    old = {
        "versionId": "old",
        "version": "1.0.0",
        "status": "PUBLISHED",
        "modules": [{"pages": [{"id": "page", "definition": {"binding": bound}}]}],
    }
    current = {**old, "versionId": "new", "version": "2.0.0"}
    mem.put_app(
        "tenant-acme",
        replace(
            mem.ApphubApp("context-app", "tenant-acme", "Context", "context", "business", ""),
            status="PUBLISHED",
            published_version_id="new",
            versions=[current, old],
        ),
    )

    def upstream(req):
        return httpx.Response(
            200,
            json=[{"rid": "allowed"}]
            if req.url.path.endswith("object-sets:evaluate")
            else docs[req.url.path],
        )

    monkeypatch.setattr(
        api,
        "ontology_client",
        lambda request: httpx.AsyncClient(
            base_url="http://ontology", transport=httpx.MockTransport(upstream)
        ),
    )
    claims = jwt.decode(
        auth_headers_acme["Authorization"].split()[1], options={"verify_signature": False}
    )
    claims["scope"] = "platform.read"
    reader = {
        "Authorization": "Bearer "
        + jwt.encode(claims, "fixture-attribution-long-key-for-tests", algorithm="HS256")
    }
    path = "/api/v1/apphub/apps/context-app/runtime/proposal-context"
    body = {
        "page_id": "page",
        "version_id": "old",
        "action_rid": bound["action_rid"],
        "target_iid": "allowed",
    }
    result = client.post(path, headers=reader, json=body)
    assert result.status_code == 200 and result.json()["app_version"] == "1.0.0"
    assert result.json()["app_version_id"] == "old"
    for key, value, code in [
        ("page_id", "wrong", 422),
        ("version_id", "wrong", 404),
        ("action_rid", "wrong", 422),
        ("target_iid", "outside", 422),
    ]:
        assert client.post(path, headers=reader, json={**body, key: value}).status_code == code
    assert client.post(path, headers=auth_headers_globex, json=body).status_code == 404
    assert mem.get_app("tenant-acme", "context").published_version_id == "new"
