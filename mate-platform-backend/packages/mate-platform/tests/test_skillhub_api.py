"""SKILL HUB API tests (marketplace skill kind).

Covers upload / browse / detail / download / install / delete, tenant
visibility (public vs own-private), and scope gating.
"""
from __future__ import annotations

import pytest
from fastapi import Depends, FastAPI, Request
from fastapi.testclient import TestClient

from mate_platform.marketplace.skillhub.api import router as skillhub_router
from mate_platform.marketplace.skillhub.store import SkillHubStore


class _User:
    def __init__(self, tenant_id: str, scopes: frozenset) -> None:
        self.id = f"u-{tenant_id}"
        self.tenant_id = tenant_id
        self.scopes = scopes


async def _inject_user(request: Request):
    request.state.user = _User(
        tenant_id=request.headers.get("X-Test-Tenant", "tenant-acme"),
        scopes=frozenset(["platform.marketplace.write", "platform.marketplace.read"]),
    )
    yield


def _app() -> TestClient:
    app = FastAPI()
    app.state.skillhub_store = SkillHubStore(memory=True)
    app.include_router(skillhub_router, dependencies=[Depends(_inject_user)])
    return TestClient(app)


def _upload(client: TestClient, name: str, tenant: str = "tenant-acme", visibility: str = "public", **kw) -> dict:
    r = client.post(
        "/skills",
        json={
            "name": name,
            "description": kw.get("description", f"desc of {name}"),
            "version": kw.get("version", "v1"),
            "visibility": visibility,
            "content": f"# {name}\\nskill content",
        },
        headers={"X-Test-Tenant": tenant},
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_upload_browse_download() -> None:
    c = _app()
    skill = _upload(c, "kb-extractor")
    assert skill["name"] == "kb-extractor"
    assert skill["visibility"] == "public"
    assert skill["author_tenant"] == "tenant-acme"

    # public skill visible to another tenant
    lst = c.get("/skills", headers={"X-Test-Tenant": "tenant-globex"})
    assert lst.status_code == 200
    assert any(s["name"] == "kb-extractor" for s in lst.json()["items"])

    # detail + download
    detail = c.get(f"/skills/{skill['id']}", headers={"X-Test-Tenant": "tenant-globex"})
    assert detail.status_code == 200
    dl = c.get(f"/skills/{skill['id']}/download", headers={"X-Test-Tenant": "tenant-globex"})
    assert "# kb-extractor" in dl.json()["content"]


def test_private_skill_tenant_isolated() -> None:
    c = _app()
    _upload(c, "private-tool", tenant="tenant-acme", visibility="private")
    lst_owner = c.get("/skills", headers={"X-Test-Tenant": "tenant-acme"})
    assert any(s["name"] == "private-tool" for s in lst_owner.json()["items"])
    lst_other = c.get("/skills", headers={"X-Test-Tenant": "tenant-globex"})
    assert not any(s["name"] == "private-tool" for s in lst_other.json()["items"])


def test_install_increments() -> None:
    c = _app()
    skill = _upload(c, "popular")
    r = c.post(f"/skills/{skill['id']}/install", headers={"X-Test-Tenant": "tenant-globex"})
    assert r.status_code == 200, r.text
    assert r.json()["installs"] == 1
    c.post(f"/skills/{skill['id']}/install", headers={"X-Test-Tenant": "tenant-globex"})
    detail = c.get(f"/skills/{skill['id']}", headers={"X-Test-Tenant": "tenant-globex"})
    assert detail.json()["installs"] == 2


def test_installed_list_per_tenant() -> None:
    c = _app()
    skill = _upload(c, "install-me")
    c.post(f"/skills/{skill['id']}/install", headers={"X-Test-Tenant": "tenant-acme"})
    # tenant-acme sees it in its installed list
    inst = c.get("/skills/installed", headers={"X-Test-Tenant": "tenant-acme"})
    assert inst.status_code == 200, inst.text
    assert any(s["name"] == "install-me" for s in inst.json()["items"])
    # tenant-globex has NOT installed it
    inst_other = c.get("/skills/installed", headers={"X-Test-Tenant": "tenant-globex"})
    assert not any(s["name"] == "install-me" for s in inst_other.json()["items"])


def test_search_filter() -> None:
    c = _app()
    _upload(c, "ocr-engine")
    _upload(c, "translate")
    lst = c.get("/skills", params={"q": "ocr"}, headers={"X-Test-Tenant": "tenant-globex"})
    names = [s["name"] for s in lst.json()["items"]]
    assert "ocr-engine" in names and "translate" not in names


def test_delete_only_owner() -> None:
    c = _app()
    skill = _upload(c, "mine", tenant="tenant-acme")
    # other tenant cannot delete
    r = c.delete(f"/skills/{skill['id']}", headers={"X-Test-Tenant": "tenant-globex"})
    assert r.status_code == 403
    # owner can
    r2 = c.delete(f"/skills/{skill['id']}", headers={"X-Test-Tenant": "tenant-acme"})
    assert r2.status_code == 200
    assert c.get(f"/skills/{skill['id']}", headers={"X-Test-Tenant": "tenant-acme"}).status_code == 404


def test_upload_requires_scope() -> None:
    async def _no_scope(request: Request):
        request.state.user = _User("tenant-acme", frozenset(["platform.marketplace.read"]))
        yield

    app = FastAPI()
    app.state.skillhub_store = SkillHubStore(memory=True)
    app.include_router(skillhub_router, dependencies=[Depends(_no_scope)])
    c = TestClient(app)
    r = c.post("/skills", json={"name": "x", "content": "y"})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_skill_installer_registers_to_store() -> None:
    import hashlib

    from mate_platform.marketplace.jobs.installer_skill import SkillInstaller

    store = SkillHubStore(memory=True)
    blob = b"# my skill\ncontent"
    digest = hashlib.sha256(blob).hexdigest()
    manifest = {"digest": {"sha256": digest}, "id": "skill-1", "version": "v1", "name": "myskill"}
    installer = SkillInstaller(store)
    result = await installer.run(install_id="i1", manifest=manifest, blob=blob)
    assert result["registered_digest"] == digest
    assert result["instance_uid"]
    skills = store.list("")
    assert len(skills) == 1
    assert skills[0].name == "myskill"
    assert skills[0].content == "# my skill\ncontent"
