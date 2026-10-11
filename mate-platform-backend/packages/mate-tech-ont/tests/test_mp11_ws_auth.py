"""Direct WebSocket auth boundary regression (normal RSA verification)."""
import json
import time
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from mate_platform.auth.config import AuthConfig
from mate_platform.auth.middleware import install_auth
from mate_tech_ont.v2_kernel.api import router

@pytest.mark.parametrize("token_kind", ["anonymous", "invalid", "expired", "wrong-tenant", "no-scope"])
def test_websocket_rejects_unverified_or_unbound_reader(token_kind):
    app = FastAPI()
    app.include_router(router)
    cfg = AuthConfig("https://issuer.invalid", "mp11", "backend", "backend", "fixture-only", 300, 5, 0, False, False)
    verifier = install_auth(app, config=cfg)
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    verifier._cache._by_kid = {"test": json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key()))}
    now = int(time.time())
    claims = {"sub": "reader", "azp": "web", "tenant_id": "a", "iss": cfg.issuer,
              "aud": cfg.audience, "iat": now, "exp": now + 60, "scope": "platform.read ont.read"}
    if token_kind == "expired": claims["exp"] = now - 1
    if token_kind == "no-scope": claims["scope"] = ""
    token = jwt.encode(claims, key, algorithm="RS256", headers={"kid": "test"})
    headers = {} if token_kind == "anonymous" else {"Authorization": "Bearer " + ("invalid" if token_kind == "invalid" else token)}
    if token_kind == "wrong-tenant": headers["X-Tenant-ID"] = "b"
    with TestClient(app) as client:
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect("/api/v1/ont/v2/ws/object-changes", headers=headers) as ws:
                # An accepted connection is itself the baseline defect. No private
                # token/key/header object is used as an assertion value.
                assert False, "unauthorized websocket accepted"


def test_actual_pg_scoped_outbox_filters_before_limit():
    import os
    from urllib.parse import urlparse
    import psycopg2
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository
    dsn = os.environ.get("MP11_WS_PG_DSN", "")
    if not dsn:
        pytest.skip("explicit isolated MP11_WS_PG_DSN required")
    target = urlparse(dsn)
    if target.hostname != "127.0.0.1" or target.port != 55497 or not target.path.startswith("/codex_mp11_"):
        raise RuntimeError("refusing unowned test database")
    class SafeRepo(PgOntologyRepository):
        def __repr__(self): return "<OwnedOutboxRepository>"
    repo = SafeRepo(dsn=dsn)
    repo._ensure_schema()
    with psycopg2.connect(dsn) as conn:
        with conn.cursor() as cur:
            for tenant in ("ws-a", "ws-b"):
                cur.execute("INSERT INTO ont_proposal(proposal_id,tenant_id,action_rid,parameters,status) VALUES(%s,%s,'', '{}'::jsonb,'pending') ON CONFLICT DO NOTHING", ("mp11-ws-"+tenant,tenant))
                cur.execute("INSERT INTO ont_outbox_event(event_id,tenant_id,proposal_id,event_type,payload) VALUES(%s,%s,%s,'changed','{}'::jsonb) ON CONFLICT DO NOTHING", ("mp11-event-"+tenant,tenant,"mp11-ws-"+tenant))
    with repo.tenant_scope("ws-a"):
        rows = repo.list_outbox_events(limit=1)
        assert [row["tenant_id"] for row in rows] == ["ws-a"]
    with repo.tenant_scope("ws-b"):
        assert [row["tenant_id"] for row in repo.list_outbox_events(limit=1)] == ["ws-b"]
    assert {'mp11-event-ws-a','mp11-event-ws-b'} <= {row['event_id'] for row in repo.list_outbox_events(limit=10000)}  # explicit unscoped admin compatibility
