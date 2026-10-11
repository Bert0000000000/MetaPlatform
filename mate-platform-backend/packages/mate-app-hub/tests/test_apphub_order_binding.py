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
    assert target.hostname=='127.0.0.1' and target.port==55497 and target.path.startswith('/codex_mp11_apphub_')
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
