"""RSA-signed HTTP identity regression; fixture never represents token/key values."""
import json
import time
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from mate_platform.auth.config import AuthConfig
from mate_platform.auth.middleware import install_auth

@pytest.fixture
def signed_client():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    cfg = AuthConfig('https://issuer.invalid', 'mp11', 'backend', 'backend',
                     'fixture-only', 300, 5, 0, False, False)
    app = FastAPI()
    verifier = install_auth(app, config=cfg)
    jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key()))
    verifier._cache._by_kid = {'mp11-test': jwk}
    @app.get('/identity')
    def identity(request: Request):
        ctx = request.state.ctx
        return {'method': ctx.auth_method.value, 'tenant': str(ctx.tenant_id),
                'scopes': sorted(ctx.scopes)}
    class SignedClient:
        def __repr__(self):
            return '<SignedIdentityClient>'
        def get(self, extra, headers=None):
            now = int(time.time())
            claims = {'iss': cfg.issuer, 'aud': cfg.audience, 'sub': 'user-1',
                      'azp': 'web', 'tenant_id': 'tenant-a', 'iat': now,
                      'exp': now + 60, 'scope': 'platform.read ont.read'}
            claims.update(extra)
            token = jwt.encode(claims, key, algorithm='RS256', headers={'kid': 'mp11-test'})
            with TestClient(app) as client:
                return client.get('/identity', headers={'Authorization': 'Bearer ' + token,
                                                         **(headers or {})})
    return SignedClient()

@pytest.mark.parametrize('metadata,expected', [
    ({'preferred_username': 'writer', 'sid': 'human-session'}, 'user'),
    ({'preferred_username': 'readonly', 'session_state': 'legacy-session'}, 'user'),
    ({'preferred_username': 'service-account-worker'}, 'service'),
    ({'preferred_username': 'service-account-worker', 'sid': 'service-session'}, 'service'),
    ({'preferred_username': 'writer'}, 'service'),
    ({'sid': 'session'}, 'service'),
    ({'azp': ''}, 'service'),
    ({'preferred_username': 'renamed-worker', 'sid': 'session', 'client_id': 'worker'}, 'service'),
    ({'preferred_username': ['writer'], 'sid': 'session'}, 'service'),
    ({'sub': '', 'preferred_username': 'writer', 'sid': 'session'}, 'service'),
])
def test_signed_identity_requires_human_session(signed_client, metadata, expected):
    response = signed_client.get(metadata)
    assert response.status_code == 200
    assert response.json()['method'] == expected

def test_headers_cannot_supply_human_identity_or_tenant(signed_client):
    response = signed_client.get({}, {'preferred_username': 'writer', 'sid': 'session'})
    assert response.json()['method'] == 'service'
    assert signed_client.get({}, {'X-Tenant-ID': 'tenant-b'}).status_code == 403

def test_expired_signed_identity_is_rejected(signed_client):
    assert signed_client.get({'exp': int(time.time()) - 1}).status_code == 401
