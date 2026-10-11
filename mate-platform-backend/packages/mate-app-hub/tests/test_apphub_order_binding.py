"""Narrow AppHub order bindings: mock upstream protocol, real validation logic."""
import asyncio
import httpx
import pytest
from fastapi import HTTPException
from mate_app_hub.runtime import binding as binding_module

ORDER = "ont.a.class.Order.v1"
CUSTOMER = "ont.a.class.Customer.v1"
ACTION = "ont.a.action.Review.v1"
LINK = "ont.a.link.CustomerOrders.v1"

def spec():
    return {"object_type": ORDER, "model_checksum": "order-sha", "fields": ["amount"],
            "customer_type": CUSTOMER, "customer_checksum": "customer-sha",
            "link_type": LINK, "action_rid": ACTION, "object_set": {"filter_expr": "", "paging_limit": 100}}

def documents():
    return {
        f"/api/v1/ont/v2/object-types/{ORDER}": {"rid": ORDER, "status": "active", "checksum": "order-sha", "properties": [{"rid": "amount", "format": "decimal"}]},
        f"/api/v1/ont/v2/object-types/{CUSTOMER}": {"rid": CUSTOMER, "status": "active", "checksum": "customer-sha", "properties": []},
        f"/api/v1/ont/v2/action-types/{ACTION}": {"rid": ACTION, "on": [ORDER], "parameters": []},
        f"/api/v1/ont/v2/link-types/{LINK}": {"rid": LINK, "src": CUSTOMER, "dst": ORDER},
    }

def validate(payload, docs):
    async def run():
        async with httpx.AsyncClient(base_url="http://ontology", transport=httpx.MockTransport(
            lambda request: httpx.Response(200, json=docs[request.url.path]))) as client:
            validator = getattr(binding_module, "validate_order_binding", None)
            assert validator is not None, "published binding must be validated against actual ontology metadata"
            return await validator(client, "a", payload)
    return asyncio.run(run())

@pytest.mark.parametrize("failure", ["field", "model", "action", "link", "draft", "tenant"])
def test_publication_rejects_unresolved_dependency(failure):
    payload, docs = spec(), documents()
    if failure == "field": payload["fields"] = ["missing"]
    if failure == "model": payload["model_checksum"] = "old"
    if failure == "action": docs[f"/api/v1/ont/v2/action-types/{ACTION}"]["on"] = [CUSTOMER]
    if failure == "link": docs[f"/api/v1/ont/v2/link-types/{LINK}"]["dst"] = CUSTOMER
    if failure == "draft": docs[f"/api/v1/ont/v2/object-types/{ORDER}"]["status"] = "draft"
    if failure == "tenant": payload["object_type"] = "ont.b.class.Order.v1"
    with pytest.raises(HTTPException) as error:
        validate(payload, docs)
    assert error.value.status_code in (403, 409, 422)

def test_valid_binding_captures_action_and_link_fingerprints():
    result = validate(spec(), documents())
    assert result["action_checksum"]
    assert result["link_checksum"]



@pytest.mark.parametrize("handler", ["confirm_proposal", "execute_proposal", "reject_proposal", "apply_edit_set"])
@pytest.mark.parametrize("identity", ["readonly", "service"])
def test_human_decision_requires_authenticated_user_write_scope(handler, identity):
    from starlette.requests import Request
    from mate_platform.tenancy.context import RequestContext, TenantId, UserId, AuthMethod
    from mate_tech_ont.v2_kernel import api
    request = Request({"type": "http", "method": "POST", "path": "/", "headers": []})
    request.state.ctx = RequestContext("r", "t", TenantId("a"), UserId("actor"), frozenset(), frozenset(),
                                      frozenset({"platform.read"} if identity == "readonly" else {"platform.read", "platform.write"}),
                                      auth_method=AuthMethod.USER if identity == "readonly" else AuthMethod.SERVICE)
    async def run():
        kwargs = {"proposal_id": "missing", "request": request}
        if handler == "apply_edit_set":
            kwargs = {"rid": "ont.a.act.review.v1", "request": request, "payload": api.EditSetApplyBodyDTO()}
        elif handler != "execute_proposal":
            kwargs["payload"] = api.ProposalConfirmDTO()
        await getattr(api, handler)(**kwargs)
    with pytest.raises(HTTPException) as error:
        asyncio.run(run())
    assert error.value.status_code == 403


@pytest.mark.skipif(not __import__('os').getenv('MP11_APPHUB_PG_DSN'), reason='explicit isolated Task6 PG required')
def test_actual_pg_declarative_proposal_replay_concurrency_and_state():
    import os, uuid
    from concurrent.futures import ThreadPoolExecutor
    from urllib.parse import urlparse
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository
    from mate_kernel.ontology import ClassRef
    from mate_kernel.action.engine import ProposalNotConfirmed
    dsn=os.environ['MP11_APPHUB_PG_DSN']; target=urlparse(dsn)
    assert target.hostname=='127.0.0.1' and target.port==55497 and (target.path.startswith('/codex_mp11_apphub_') or target.path=='/codex_mp11_candidate_tests_20261012')
    tenant='mp11-app-ui'; repo=PgOntologyRepository(dsn=dsn)
    def proposal():
        with repo.tenant_scope(tenant):
            p=repo.propose_action(ClassRef(f'ont.{tenant}.act.review'),{},f'ont.{tenant}.ind.order.2','Task6 PG idempotency')
            return repo.confirm_proposal(p.proposal_id,'real-fixture-user',idempotency_key='confirm-'+uuid.uuid4().hex)
    p=proposal(); key='execute-'+uuid.uuid4().hex
    def execute():
        own=PgOntologyRepository(dsn=dsn)
        with own.tenant_scope(tenant):
            return own.execute_proposal(p.proposal_id,actor_id='real-fixture-user',idempotency_key=key)
    with ThreadPoolExecutor(max_workers=2) as executor:
        results=list(executor.map(lambda _:execute(),range(2)))
    assert results[0]['audit_id']==results[1]['audit_id']
    assert execute()['audit_id']==results[0]['audit_id']
    with repo.tenant_scope(tenant):
        with pytest.raises(ValueError,match='conflict'):
            repo.execute_proposal(p.proposal_id,actor_id='different-actor',idempotency_key=key)
        audits=[a for a in repo.list_action_audit(100) if a['proposal_id']==p.proposal_id]
        assert len(audits)==1
    stale=proposal()
    import psycopg2
    with psycopg2.connect(dsn) as connection:
        with connection.cursor() as cursor:
            cursor.execute("UPDATE ont_proposal SET status='rejected' WHERE proposal_id=%s AND tenant_id=%s",(stale.proposal_id,tenant))
    with repo.tenant_scope(tenant), pytest.raises(ProposalNotConfirmed):
        repo._execute_edit_set_proposal(stale,actor_id='real-fixture-user',idempotency_key='stale-'+uuid.uuid4().hex,request_fingerprint='stale')

def test_binding_field_metadata_follows_selected_column_order():
    docs = documents()
    docs[f'/api/v1/ont/v2/object-types/{ORDER}']['properties'].append({'rid':'status','format':'string'})
    payload=spec();payload['fields']=['status','amount']
    assert [p['rid'] for p in validate(payload,docs)['field_metadata']]==['status','amount']

@pytest.mark.skipif(not __import__('os').getenv('MP11_APPHUB_PG_DSN'), reason='explicit isolated Task6 PG required')
def test_actual_pg_insert_only_module_page_concurrency():
    import os,uuid
    from concurrent.futures import ThreadPoolExecutor
    from urllib.parse import urlparse
    from mate_tech_db.base import init_engine,reset_engine
    from mate_app_hub.repositories import sql_store as repo,in_memory as model
    dsn=os.environ['MP11_APPHUB_PG_DSN'];target=urlparse(dsn)
    assert target.hostname=='127.0.0.1' and target.port==55497 and target.path.startswith('/codex_mp11_')
    reset_engine();init_engine(dsn);tenant='create-'+uuid.uuid4().hex
    for kind,entity in [('module',model.ApphubModule(tenant+'-m',tenant,'Review','review','orders','','')),('page',model.ApphubPage(tenant+'-p',tenant,'Review','review','review','grid',definition={'widgets':[{'id':'kept'}]}))]:
        def create(_):
            try:getattr(repo,'put_'+kind)(tenant,entity,insert_only=True);return 'created'
            except ValueError as error:assert 'exists' in str(error);return 'conflict'
        with ThreadPoolExecutor(max_workers=2) as workers:
            assert sorted(workers.map(create,range(2)))==['conflict','created']
    assert repo.get_page(tenant,tenant+'-p').definition=={'widgets':[{'id':'kept'}]}
    reset_engine()


@pytest.mark.skipif(not __import__('os').getenv('MP11_APPHUB_PG_DSN'), reason='explicit isolated Task6 PG required')
def test_actual_pg_app_create_two_processes_and_legacy_duplicate_rejection():
    import os, sys, uuid, subprocess, json, time
    from concurrent.futures import ThreadPoolExecutor
    from urllib.parse import urlparse
    from mate_tech_db.base import init_engine, reset_engine
    from mate_app_hub.repositories import sql_store as repo, in_memory as model
    from dataclasses import replace
    dsn = os.environ['MP11_APPHUB_PG_DSN']; target = urlparse(dsn)
    assert target.hostname == '127.0.0.1' and target.port == 55497 and target.path.startswith('/codex_mp11_')
    tenant = 'fix-create-' + uuid.uuid4().hex
    code = "orders"; app_id = 'app-' + uuid.uuid5(uuid.NAMESPACE_URL, f'apphub-app:{tenant}:{code}').hex
    worker = """import os,sys,json,time
from mate_tech_db.base import init_engine
from mate_app_hub.repositories import sql_store as repo,in_memory as model
payload=json.loads(sys.stdin.read());time.sleep(max(0,payload['start']-time.time()))
init_engine(os.environ['MP11_APPHUB_PG_DSN'])
try:
 repo.put_app(payload['tenant'],model.ApphubApp(payload['id'],payload['tenant'],'Original','orders','business',''),insert_only=True)
 print('created')
except ValueError:
 print('conflict')
"""
    processes = [subprocess.Popen([sys.executable, '-c', worker], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True) for _ in range(2)]
    payload = json.dumps({'tenant': tenant, 'id': app_id, 'start': time.time() + 3})
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda process: process.communicate(payload, timeout=60), processes))
    assert all(p.returncode == 0 for p in processes)
    assert sorted(out.strip() for out, _ in results) == ['conflict', 'created']
    reset_engine(); init_engine(dsn)
    assert len(repo.list_apps(tenant)) == 1
    legacy = model.ApphubApp('legacy-' + uuid.uuid4().hex, tenant, 'Keep legacy', 'legacy', 'business', '')
    repo.put_app(tenant, legacy)
    # A preexisting duplicate code remains untouched; no automatic destructive cleanup.
    repo.put_app(tenant, replace(legacy, id='legacy-duplicate-' + uuid.uuid4().hex))
    with pytest.raises(ValueError, match='already'):
        repo.put_app(tenant, replace(legacy, id='new-' + uuid.uuid4().hex), insert_only=True)
    assert len([a for a in repo.list_apps(tenant) if a.code == 'legacy']) == 2
    reset_engine()


@pytest.mark.skipif(not __import__('os').getenv('MP11_APPHUB_PG_DSN'), reason='explicit isolated Task6 PG required')
@pytest.mark.parametrize("kind", ["action", "edit_set"])
def test_actual_pg_history_filters_before_limit_and_survives_new_process(kind):
    import os, sys, uuid, subprocess, json
    from urllib.parse import urlparse
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository
    from mate_kernel.ontology import ClassRef
    dsn = os.environ['MP11_APPHUB_PG_DSN']; target = urlparse(dsn)
    assert target.hostname == '127.0.0.1' and target.port == 55497 and target.path.startswith('/codex_mp11_')
    tenant = 'mp11-app-ui'; repo = PgOntologyRepository(dsn=dsn)
    app_id = 'history-' + uuid.uuid4().hex
    base = {'app_id': app_id, 'page_id': 'page', 'app_version_id': 'v1', 'source': 'user'}
    receipts = []
    with repo.tenant_scope(tenant):
        for provenance in (base, {**base, 'app_id': 'other-app'}, {**base, 'page_id': 'other-page'}, {**base, 'app_version_id': 'v2'}, {}):
            if kind == 'action':
                p = repo.propose_action(ClassRef(f'ont.{tenant}.act.review'), {}, f'ont.{tenant}.ind.order.2', 'History fixture', provenance=provenance)
            else:
                p = repo.propose_edit_set(f'ont.{tenant}.act.review', f'ont.{tenant}.ind.order.2', {'provenance': provenance}, [], 'History fixture')
            repo.confirm_proposal(p.proposal_id, 'history-user', idempotency_key='confirm-' + uuid.uuid4().hex)
            receipts.append(repo.execute_proposal(p.proposal_id, actor_id='history-user', idempotency_key='execute-' + uuid.uuid4().hex))
            if provenance.get('app_id') == 'other-app':
                # A competing wrong-shape attribution must never override the
                # provenance owned by this persisted proposal kind.
                decoy = {'provenance': base} if kind == 'edit_set' else {'parameters': {'provenance': base}}
                connection, _ = repo._connect()
                try:
                    with connection.cursor() as cursor:
                        cursor.execute('UPDATE ont_proposal SET parameters = parameters || %s::jsonb WHERE proposal_id = %s AND tenant_id = %s',
                                       (json.dumps(decoy), p.proposal_id, tenant))
                    connection.commit()
                finally:
                    connection.close()
        filtered = repo.list_action_audit(1, action_rid=f'ont.{tenant}.act.review', app_id=app_id, page_id='page', app_version_id='v1')
        assert [r['audit_id'] for r in filtered] == [receipts[0]['audit_id']]
    with repo.tenant_scope('other-tenant'):
        assert repo.list_action_audit(1, app_id=app_id, page_id='page', app_version_id='v1') == []
    worker = """import os,sys,json
from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository
p=json.loads(sys.stdin.read());r=PgOntologyRepository(dsn=os.environ['MP11_APPHUB_PG_DSN'])
with r.tenant_scope('mp11-app-ui'):
 print(json.dumps([x['audit_id'] for x in r.list_action_audit(1,app_id=p['app_id'],page_id='page',app_version_id='v1')]))
"""
    result = subprocess.run([sys.executable, '-c', worker], input=json.dumps({'app_id': app_id}), capture_output=True, text=True, timeout=60)
    assert result.returncode == 0
    assert json.loads(result.stdout) == [receipts[0]['audit_id']]


@pytest.mark.parametrize("entry", ["top", "parameters"])
def test_direct_ontology_proposal_rejects_unverified_application_attribution(monkeypatch, entry):
    from starlette.requests import Request
    from mate_platform.tenancy.context import RequestContext, TenantId, UserId, AuthMethod
    from mate_tech_ont.v2_kernel import api
    from types import SimpleNamespace
    request = Request({"type": "http", "method": "POST", "path": "/", "headers": [(b'authorization', b'Bearer fixture-only')]})
    request.state.ctx = RequestContext('r', 't', TenantId('a'), UserId('human'), frozenset(), frozenset(),
        frozenset({'platform.read', 'platform.write'}), auth_method=AuthMethod.USER)
    provenance = {'app_id': 'forged', 'page_id': 'fake', 'app_version_id': 'fake'}
    payload = api.ProposalCreateDTO(target_iid='ont.a.ind.order.1', **({'provenance': provenance} if entry == 'top' else {'parameters': {'provenance': provenance}}))
    calls = []
    async def repository(*args, **kwargs):
        calls.append(args); raise AssertionError('unverified application attribution reached repository')
    monkeypatch.setattr(api, '_call_scoped', repository)
    real_client = httpx.AsyncClient
    monkeypatch.setattr(api, 'httpx', SimpleNamespace(AsyncClient=lambda **kwargs: real_client(**kwargs, transport=httpx.MockTransport(lambda req: httpx.Response(404))), HTTPError=httpx.HTTPError), raising=False)
    with pytest.raises(HTTPException) as error:
        asyncio.run(api.propose_action('ont.a.act.review', payload, request))
    assert error.value.status_code == 404
    assert not calls


@pytest.mark.parametrize("handler", ["propose_edit_set", "apply_edit_set"])
@pytest.mark.parametrize("custom_edits", [False, True])
def test_edit_set_alias_cannot_forge_application_history(monkeypatch, handler, custom_edits):
    from starlette.requests import Request
    from mate_platform.tenancy.context import RequestContext, TenantId, UserId, AuthMethod
    from mate_tech_ont.v2_kernel import api
    from types import SimpleNamespace
    request = Request({"type": "http", "method": "POST", "path": "/", "headers": [(b'authorization', b'Bearer fixture-only')]})
    request.state.ctx = RequestContext('r', 't', TenantId('a'), UserId('human'), frozenset(), frozenset(),
        frozenset({'platform.read', 'platform.write'}), auth_method=AuthMethod.USER)
    payload = api.EditSetApplyBodyDTO(target_iid='ont.a.ind.order.1', parameters={'provenance': {'app_id':'fake','page_id':'p','app_version_id':'v'}},
        edits=[{'op':'set_property'}] if custom_edits else [])
    async def repository(*args, **kwargs): raise AssertionError('unverified alias reached repository')
    monkeypatch.setattr(api, '_call_scoped', repository)
    real_client = httpx.AsyncClient
    monkeypatch.setattr(api, 'httpx', SimpleNamespace(AsyncClient=lambda **kwargs: real_client(**kwargs, transport=httpx.MockTransport(lambda req: httpx.Response(404))), HTTPError=httpx.HTTPError))
    with pytest.raises(HTTPException) as error:
        asyncio.run(getattr(api, handler)('ont.a.act.review', payload, request))
    assert error.value.status_code == (422 if custom_edits else 404)


@pytest.mark.parametrize('case', ['missing', 'conflict', 'duplicate', 'wrong_version'])
def test_application_attribution_rejects_incomplete_duplicate_and_conflicting_values(monkeypatch, case):
    from starlette.requests import Request
    from mate_tech_ont.v2_kernel import api
    from types import SimpleNamespace
    request = Request({'type':'http','method':'POST','path':'/','headers':[(b'authorization',b'Bearer fixture-only')]})
    provenance = {'app_id':'app','page_id':'page','app_version_id':'v1'}
    parameters = {}
    if case == 'missing': provenance.pop('page_id')
    elif case in ('conflict', 'duplicate'): parameters['provenance'] = {'app_id': 'different' if case == 'conflict' else 'app'}
    else: provenance['app_version'] = '9.0.0'
    real_client = httpx.AsyncClient
    monkeypatch.setattr(api, 'httpx', SimpleNamespace(AsyncClient=lambda **kwargs: real_client(**kwargs, transport=httpx.MockTransport(lambda req: httpx.Response(200,json={'app_id':'app','page_id':'page','app_version_id':'v1','app_version':'1.0.0'}))), HTTPError=httpx.HTTPError))
    with pytest.raises(HTTPException) as error:
        asyncio.run(api._validated_app_provenance(request,'ont.a.act.review','target',parameters,provenance))
    assert error.value.status_code == 422


@pytest.mark.parametrize('entry', ['top', 'parameters'])
def test_verified_direct_application_attribution_preserves_action_parameters(monkeypatch, entry):
    from starlette.requests import Request
    from mate_tech_ont.v2_kernel import api
    from types import SimpleNamespace
    request = Request({'type':'http','method':'POST','path':'/','headers':[(b'authorization',b'Bearer fixture-only')]})
    provenance = {'app_id':'app','page_id':'page','app_version_id':'old-published'}
    parameters = {'amount':7, **({'provenance':provenance} if entry=='parameters' else {})}
    observed = []
    def upstream(req):
        import json
        observed.append(json.loads(req.content))
        assert req.headers['Authorization'] == 'Bearer fixture-only'
        return httpx.Response(200,json={**provenance,'app_version':'1.0.0'})
    real_client = httpx.AsyncClient
    monkeypatch.setattr(api, 'httpx', SimpleNamespace(AsyncClient=lambda **kwargs: real_client(**kwargs, transport=httpx.MockTransport(upstream)), HTTPError=httpx.HTTPError))
    checked, trusted = asyncio.run(api._validated_app_provenance(request,'ont.a.act.review','target',parameters,provenance if entry=='top' else {}))
    assert checked['amount']==7 and trusted['app_version_id']=='old-published'
    assert trusted['app_version']=='1.0.0'
    assert observed==[{'page_id':'page','version_id':'old-published','action_rid':'ont.a.act.review','target_iid':'target'}]


def test_completed_release_task_canonical_declares_actual_completion_time():
    from pathlib import Path
    import yaml
    import jsonschema
    contract = Path(__file__).resolve().parents[3] / 'contracts/openapi/services/apphub.yaml'
    schema = yaml.safe_load(contract.read_text(encoding='utf-8'))['components']['schemas']['AppHubReleaseTask']
    # Actual completed response shape; check declared properties, because an
    # additionalProperties-permissive validator alone misses a wrong field name.
    completed = {'id': 'task-completed', 'name': 'Review', 'assignee': 'reviewer',
        'status': 'COMPLETED', 'createTime': '2026-10-11T17:15:09.387177+00:00',
        'endTime': '2026-10-11T17:15:09.399150+00:00'}
    assert set(completed) <= set(schema['properties'])
    assert 'completedAt' not in schema['properties']
    jsonschema.Draft202012Validator(schema).validate(completed)
