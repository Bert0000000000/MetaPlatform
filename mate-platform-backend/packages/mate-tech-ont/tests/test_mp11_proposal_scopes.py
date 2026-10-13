"""Normal RSA-signed proposals share the platform.write capability boundary."""

import json
import os
import time
from urllib.parse import urlparse
from uuid import uuid4

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI
from fastapi.testclient import TestClient

from mate_kernel.ontology import InMemoryOntologyRepository
from mate_platform.auth import install_auth
from mate_platform.auth.config import AuthConfig
from mate_tech_ont.v2_kernel.api import router

BASE = "/api/v1/ont/v2"


@pytest.fixture(params=["memory", "pg"])
def scoped(request):
    if request.param == "memory":
        repo = InMemoryOntologyRepository()
    else:
        from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

        dsn = os.environ.get("MP11_PROPOSAL_PG_DSN")
        if not dsn:
            pytest.fail("explicit owned MP11_PROPOSAL_PG_DSN required", pytrace=False)
        target = urlparse(dsn)
        assert (
            target.hostname == "127.0.0.1"
            and target.port == 55497
            and target.path.startswith("/codex_mp11_")
        )
        repo = PgOntologyRepository(dsn=dsn)
        repo._ensure_schema()
    tenant = "mp11-proposal-" + uuid4().hex
    app = FastAPI()
    cfg = AuthConfig(
        "https://issuer.invalid", "mp11", "backend", "backend", "unused", 300, 5, 0, False, False
    )
    verifier = install_auth(app, config=cfg)
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    verifier._cache._by_kid = {
        "test": json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key()))
    }

    def headers(scope, service=False, tid=None):
        now = int(time.time())
        claims = {
            "sub": "service-account-test" if service else "writer",
            "azp": "service" if service else "web",
            "tenant_id": tid or tenant,
            "iss": cfg.issuer,
            "aud": cfg.audience,
            "iat": now,
            "exp": now + 120,
            "scope": scope,
            "preferred_username": "service-account-test" if service else "writer",
        }
        if not service:
            claims["sid"] = "signed-human"
        return {
            "Authorization": "Bearer "
            + jwt.encode(claims, key, algorithm="RS256", headers={"kid": "test"})
        }

    app.include_router(router)
    app.state.kernel_repo = repo
    with TestClient(
        app, headers=headers("platform.read platform.write ont.read ont.write")
    ) as client:
        prop = f"ont.{tenant}.prop.id"

        def definition(kind):
            return {
                "rid": f"ont.{tenant}.obj.{kind}",
                "display_name": kind,
                "primary_key": [prop],
                "properties": [
                    {
                        "rid": prop,
                        "type_id": "string",
                        "format": "string",
                        "primary_key": True,
                        "nullable": False,
                    }
                ],
                "interfaces": [],
            }

        for kind in ("source", "target"):
            assert client.post(BASE + "/object-types", json=definition(kind)).status_code == 200
        yield client, repo, tenant, headers, definition


def proposal(kind, tenant, definition):
    if kind == "instance":
        return f"/classes/ont.{tenant}.obj.source/propose-instance", {
            "props": {f"ont.{tenant}.prop.id": "new"}
        }
    if kind == "model":
        return "/object-types/propose", {"type_def": definition("new")}
    return "/object-types/propose-merge", {
        "source_rid": f"ont.{tenant}.obj.source",
        "target_rid": f"ont.{tenant}.obj.target",
    }


@pytest.mark.parametrize("kind", ["instance", "model", "merge"])
def test_readonly_direct_proposal_denied_without_persistence(scoped, kind):
    client, repo, tenant, headers, definition = scoped
    path, body = proposal(kind, tenant, definition)
    before = proposal_count(repo, tenant)
    response = client.post(BASE + path, json=body, headers=headers("platform.read ont.read"))
    assert response.status_code == 403
    assert proposal_count(repo, tenant) == before


@pytest.mark.parametrize("kind", ["instance", "model", "merge"])
@pytest.mark.parametrize("service", [False, True])
def test_scoped_user_and_service_can_propose_but_only_human_can_confirm(scoped, kind, service):
    client, repo, tenant, headers, definition = scoped
    path, body = proposal(kind, tenant, definition)
    response = client.post(
        BASE + path,
        json=body,
        headers=headers("platform.read platform.write ont.read ont.write", service),
    )
    assert response.status_code == 200
    value = response.json()
    assert (
        value["kind"]
        == {"instance": "create_instance", "model": "model_type", "merge": "merge_suggestion"}[kind]
    )
    assert proposal_count(repo, tenant) == 1
    assert (
        client.post(
            BASE + "/proposals/" + value["proposal_id"] + "/confirm",
            json={},
            headers=headers("platform.write", True),
        ).status_code
        == 403
    )
    assert (
        client.post(
            BASE + path, json=body, headers=headers("platform.write", tid=tenant + "-neighbor")
        ).status_code
        == 403
    )


def proposal_count(repo, tenant):
    if isinstance(repo, InMemoryOntologyRepository):
        return len(repo.list_proposals())
    import psycopg2

    with psycopg2.connect(os.environ["MP11_PROPOSAL_PG_DSN"]) as conn, conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM ont_proposal WHERE tenant_id=%s", (tenant,))
        return cur.fetchone()[0]
