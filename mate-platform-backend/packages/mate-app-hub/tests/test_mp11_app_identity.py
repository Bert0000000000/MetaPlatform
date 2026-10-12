"""ID/code collisions resolve one tenant-local app across storage and HTTP."""
import json
import os
import time
from dataclasses import replace
from uuid import uuid4
from urllib.parse import urlparse
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI
from fastapi.testclient import TestClient
from mate_platform.auth.config import AuthConfig
from mate_platform.auth import install_auth
from mate_app_hub import repositories as repo
from mate_app_hub.repositories import in_memory as mem, sql_models
from mate_app_hub.api.app import router
from mate_app_hub.runtime.loader import load_app_runtime
from mate_tech_db.base import init_engine, reset_engine

@pytest.fixture(params=['memory', 'sqlite', 'pg'])
def store(request, monkeypatch, tmp_path):
    reset_engine()
    monkeypatch.delenv('DATABASE_URL', raising=False)
    monkeypatch.delenv('MATE_DB_URL', raising=False)
    if request.param == 'memory':
        mem.reset_store()
    else:
        dsn = os.environ.get('MP11_APP_ID_PG_DSN') if request.param == 'pg' else f'sqlite:///{tmp_path / "identity.db"}'
        if not dsn:
            pytest.skip('explicit owned MP11_APP_ID_PG_DSN required')
        if request.param == 'pg':
            target = urlparse(dsn)
            assert target.hostname == '127.0.0.1' and target.port == 55497 and target.path.startswith('/codex_mp11_')
        monkeypatch.setenv('MATE_DB_URL', dsn)
        engine = init_engine(dsn)
        for cls in vars(sql_models).values():
            if isinstance(cls, type) and getattr(cls, '__tablename__', None):
                cls.__table__.create(engine, checkfirst=True)
    yield
    reset_engine()
    mem.reset_store()

@pytest.fixture
def collision(store):
    tenant = 'mp11-id-' + uuid4().hex
    key = 'collision-' + uuid4().hex
    other = mem.ApphubApp('other-' + uuid4().hex, tenant, 'A code match', key, 'business', '')
    exact = mem.ApphubApp(key, tenant, 'B exact ID', 'exact-' + uuid4().hex, 'business', '')
    def published(app):
        snapshot = {'versionId': 'version-' + app.id, 'version': '1.0.0', 'status': 'PUBLISHED', 'modules': []}
        return replace(app, status='PUBLISHED', published_version_id=snapshot['versionId'], versions=[snapshot])
    other, exact = published(other), published(exact)
    repo.put_app(tenant, other)
    repo.put_app(tenant, exact)
    neighbor = mem.ApphubApp('neighbor-' + uuid4().hex, tenant + '-neighbor', 'Neighbor', key, 'business', '')
    repo.put_app(neighbor.tenant_id, neighbor)
    return tenant, key, other, exact, neighbor

def test_storage_and_loader_resolve_exact_id_then_local_code(collision):
    tenant, key, other, exact, neighbor = collision
    assert repo.get_app(tenant, key).id == exact.id
    assert repo.get_app(tenant, exact.code).id == exact.id
    assert repo.get_app(tenant, other.id).id == other.id
    assert repo.get_app(neighbor.tenant_id, key).id == neighbor.id
    assert repo.get_app(tenant, neighbor.id) is None
    runtime = load_app_runtime(tenant, key, published_only=True)
    assert runtime.app_id == exact.id
    assert runtime.published_version_id == 'version-' + exact.id

@pytest.mark.parametrize('entry', ['detail', 'patch', 'runtime'])
def test_http_detail_patch_runtime_delete_preserve_unrelated_app(collision, entry):
    tenant, key, other, exact, neighbor = collision
    app = FastAPI()
    cfg = AuthConfig('https://issuer.invalid', 'mp11', 'backend', 'backend', 'unused', 300, 5, 0, False, False)
    verifier = install_auth(app, config=cfg)
    signing_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    verifier._cache._by_kid = {'test': json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(signing_key.public_key()))}
    def headers(tid):
        now = int(time.time())
        token = jwt.encode({'sub': 'writer', 'preferred_username': 'writer', 'sid': 'signed-human', 'azp': 'web',
                            'tenant_id': tid, 'iss': cfg.issuer, 'aud': cfg.audience, 'iat': now, 'exp': now + 60,
                            'scope': 'platform.read platform.write'}, signing_key, algorithm='RS256', headers={'kid': 'test'})
        return {'Authorization': 'Bearer ' + token}
    app.include_router(router)
    base = '/api/v1/apphub/apps/'
    with TestClient(app, headers=headers(tenant), raise_server_exceptions=False) as client:
        # Each entry independently catches its original resolver failure.
        if entry == 'patch':
            response = client.patch(base + key, json={'description': 'Only exact ID edited'})
            assert response.status_code == 200
            assert response.json()['id'] == exact.id
            assert repo.get_app(tenant, other.id).description == ''
        elif entry == 'runtime':
            response = client.get(base + key + '/runtime')
            assert response.status_code == 200
            assert response.json()['app_id'] == exact.id
        detail = client.get(base + key)
        assert detail.status_code == 200
        assert detail.json()['id'] == exact.id
        runtime = client.get(base + key + '/runtime')
        assert runtime.status_code == 200
        assert runtime.json()['app_id'] == exact.id
        patched = client.patch(base + key, json={'description': 'Only exact ID edited'})
        assert patched.status_code == 200
        assert repo.get_app(tenant, exact.code).description == 'Only exact ID edited'
        assert repo.get_app(tenant, other.id).description == ''
        assert client.get(base + neighbor.id).status_code == 404
        assert client.patch(base + neighbor.id, json={'name': 'Denied'}).status_code == 404
        assert client.get(base + key, headers=headers(neighbor.tenant_id)).json()['id'] == neighbor.id
        assert client.delete(base + key).status_code == 200
        assert repo.get_app(tenant, key).id == other.id
        assert repo.get_app(neighbor.tenant_id, key).id == neighbor.id

def test_published_loader_collision_preserves_exact_snapshot(collision):
    tenant, key, other, exact, neighbor = collision
    runtime = load_app_runtime(tenant, key, published_only=True)
    assert runtime.app_id == exact.id
    assert runtime.published_version_id == 'version-' + exact.id
