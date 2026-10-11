"""Login/refresh tenant comes only from normal verified issuer claims.

Local RSA upstream responses isolate HTTP mapping, not actual provider proof.
No ASGI lifespan is started; these tests do not initialize IAM/Redis.
"""
import asyncio,importlib,json,sys,time
from pathlib import Path
import httpx,jwt,pytest
from cryptography.hazmat.primitives.asymmetric import rsa

@pytest.fixture
def login_client(monkeypatch):
    monkeypatch.setenv('KEYCLOAK_URL','https://issuer.invalid')
    monkeypatch.setenv('KEYCLOAK_INTERNAL_URL','https://issuer.invalid')
    monkeypatch.setenv('KEYCLOAK_REALM','mp11')
    monkeypatch.setenv('KEYCLOAK_AUDIENCE','backend')
    monkeypatch.setenv('KEYCLOAK_CLIENT_SECRET','fixture-only')
    monkeypatch.setenv('SERVICE_CLIENT_SECRET','fixture-only')
    monkeypatch.setenv('INSECURE_SKIP_SIGNATURE','false')
    monkeypatch.setenv('LEGACY_LOGIN_COMPAT','false')
    sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'src'))
    module=importlib.import_module('mate_auth_service.main')
    key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    module.app.state.token_verifier._cache._by_kid={'test':json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key()))}
    calls={'blacklist':0,'provider_logout':0}
    class Redis:
        async def set(self,*args,**kwargs):calls['blacklist']+=1
    module.app.state.redis=Redis()
    class Client:
        effects=calls
        def __repr__(self):return '<SignedLoginClient>'
        def call(self,flow,metadata):
            now=int(time.time());claims={'iss':'https://issuer.invalid/realms/mp11','aud':'backend','sub':'verified-user',
                'azp':'web','tenant_id':'verified-tenant','iat':now,'exp':now+60,'preferred_username':'writer','sid':'human','jti':'fixture-jti'}
            claims.update(metadata)
            token=jwt.encode(claims,key,algorithm='RS256',headers={'kid':'test'})
            async def run():
                def upstream(request):
                    if request.url.path.endswith('/logout'):
                        calls['provider_logout']+=1
                        return httpx.Response(503 if metadata.get('provider_failure') else 204)
                    if request.url.path.endswith('/token'):return httpx.Response(200,json={'access_token':token,'refresh_token':'fixture-refresh'})
                    return httpx.Response(200,json={'sub':'untrusted-userinfo-sub','preferred_username':'display'})
                async with httpx.AsyncClient(transport=httpx.MockTransport(upstream)) as provider:
                    module.app.state.client=provider
                    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=module.app),base_url='http://test') as client:
                        body={'username':'writer','password':'fixture-only','tenantId':'forged-hint'} if flow=='login' else {'refreshToken':'fixture-refresh'}
                        return await client.post('/api/v1/iam/auth/'+flow,json=body,headers={'Authorization':'Bearer '+token} if flow=='logout' else {})
            response=asyncio.run(run())
            class SafeResponse:
                status_code=response.status_code
                def __repr__(self):return '<SanitizedLoginResponse>'
                def json(self):
                    return {k: ('<redacted>' if k in ('accessToken','refreshToken') else v) for k,v in response.json().items()}
            return SafeResponse()
    return Client()

@pytest.mark.parametrize('flow',['login','refresh'])
def test_verified_tenant_and_subject_override_client_hint_and_userinfo(login_client,flow):
    response=login_client.call(flow,{})
    assert response.status_code==200
    data=response.json()
    assert data.get('tenantId')=='verified-tenant'
    assert data.get('userId')=='verified-user'

@pytest.mark.parametrize('metadata',[{'tenant_id':''},{'sub':''},{'exp':1},{'iss':'https://wrong.invalid'}])
@pytest.mark.parametrize('flow',['login','refresh'])
def test_missing_or_invalid_verified_login_context_fails_closed(login_client,flow,metadata):
    response=login_client.call(flow,metadata)
    assert response.status_code==401
    assert 'accessToken' not in response.json()


def test_logout_revokes_provider_session_after_verification(login_client):
    response=login_client.call('logout',{})
    assert response.status_code==200
    assert response.json().get('providerLoggedOut') is True
    assert login_client.effects=={'blacklist':1,'provider_logout':1}

@pytest.mark.parametrize('metadata',[{'exp':1},{'iss':'https://wrong.invalid'}])
def test_invalid_logout_cannot_write_blacklist(login_client,metadata):
    response=login_client.call('logout',metadata)
    assert response.status_code==401
    assert login_client.effects=={'blacklist':0,'provider_logout':0}

def test_logout_partial_provider_failure_is_visible(login_client):
    response=login_client.call('logout',{'provider_failure':True})
    assert response.status_code==200
    assert response.json().get('providerLoggedOut') is False
    assert response.json().get('blacklisted') is True
