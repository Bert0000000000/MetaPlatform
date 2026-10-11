"""Task7 behavioral scope and deadline regressions (no live/shared resources)."""
import asyncio
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
import pytest
from mate_platform.tenancy import AuthMethod
from mate_tech_mcp.server import create_server
from mate_tech_mcp.caller_context import bind_caller
from mate_tech_mcp.api.management_routes import _api_key_tenant
from fastapi import HTTPException
from mate_kernel.action.engine import ActionService, ProposalNotConfirmed


def test_confirm_has_server_deadline():
    service = ActionService()
    p = service.propose('action', {}, None, 'review')
    c = service.confirm_proposal(p.proposal_id, 'human')
    deadline = getattr(c, 'approval_expires_at', None)
    assert deadline is not None
    assert timedelta(seconds=899) <= deadline - c.confirmed_at <= timedelta(seconds=901)


@pytest.mark.parametrize('method', [AuthMethod.API_KEY, AuthMethod.SERVICE, AuthMethod.ANONYMOUS])
def test_only_verified_human_manages_keys(method):
    req = SimpleNamespace(state=SimpleNamespace(ctx=SimpleNamespace(auth_method=method, tenant_id='tenant-a')))
    with pytest.raises(HTTPException) as exc:
        _api_key_tenant(req)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_hidden_hitl_is_not_discovered():
    server = create_server()
    server.register_tool(SimpleNamespace(name='approve', agent_invokable=False, input_schema={}))
    assert not await server.list_tools('tenant-a')


@pytest.mark.asyncio
async def test_readonly_scope_denies_proposal_and_unknown_tools():
    server = create_server()
    server.register_tool(SimpleNamespace(name='write', required_scope='platform.write', agent_invokable=True, handler=lambda: 'bad'))
    server.register_tool(SimpleNamespace(name='unknown', agent_invokable=True, handler=lambda: 'bad'))
    with bind_caller(tenant_id='tenant-a', bearer_token='', scopes=frozenset({'platform.read'}), auth_method=AuthMethod.API_KEY):
        assert not await server.list_tools('tenant-a')
        for name in ('write', 'unknown'):
            with pytest.raises(PermissionError):
                await server.call_tool(name, {}, tenant_id='tenant-a')


@pytest.mark.parametrize('deadline', [None, datetime.now(UTC)-timedelta(seconds=1)])
def test_undated_expired_approval_cannot_invoke_function(deadline):
    service = ActionService()
    p = service.propose('action', {}, None, 'review')
    p = service.confirm_proposal(p.proposal_id, 'human')
    assert hasattr(p, 'approval_expires_at')
    service._proposals[p.proposal_id] = replace(p, approval_expires_at=deadline)
    calls = []
    service.register_function('fn', lambda *args: calls.append(args))
    from mate_kernel.action.engine import SubmissionContext
    with pytest.raises(ProposalNotConfirmed):
        service.apply('action', [], 'fn', '', None, {}, [], SubmissionContext(actor='human'), proposal_id=p.proposal_id)
    assert calls == []

@pytest.mark.parametrize('issuer,requested,status', [
    ({'platform.read'}, ['platform.read'], 201),
    ({'platform.read'}, ['platform.write'], 403),
    ({'platform.read'}, ['ont.read'], 403),
    ({'platform.read','platform.write','ont.read','ont.write'}, ['ont.read','ont.write','platform.write'], 201),
    ({'platform.write'}, ['admin'], 403),
])
def test_key_grants_subset_of_verified_issuer(issuer, requested, status, _fresh_store):
    from fastapi import FastAPI, Request
    from fastapi.testclient import TestClient
    from mate_platform.tenancy import RequestContext
    from mate_tech_mcp.api.management_routes import router
    from mate_tech_mcp.security.api_keys import mcp_api_key_verifier
    app=FastAPI(); app.include_router(router)
    @app.middleware('http')
    async def inject(request, call_next):
        request.state.ctx=RequestContext('', '', 'tenant-a', 'human', frozenset({'ADMIN'}), frozenset(), scopes=frozenset(issuer), auth_method=AuthMethod.USER)
        return await call_next(request)
    client=TestClient(app)
    result=client.post('/api/v1/mcp/api-keys',json={'name':'probe','scopes':requested,'tenant_id':'forged'})
    assert result.status_code == status
    if status == 201:
        body=result.json()
        import jsonschema, yaml
        from pathlib import Path
        base=next(p for p in Path(__file__).resolve().parents if (p/'contracts').is_dir())
        contract=yaml.safe_load((base/'contracts/openapi/services/mcp.yaml').read_text(encoding='utf-8'))
        jsonschema.validate(body,contract['components']['schemas']['McpApiKeyCreated'])
        actual=app.openapi()['paths']['/api/v1/mcp/api-keys']
        for method in ('get','post'):
            assert actual[method]['operationId']==contract['paths']['/api/v1/mcp/api-keys'][method]['operationId']
        assert app.openapi()['paths']['/api/v1/mcp/api-keys/{kid}']['delete']['operationId']==contract['paths']['/api/v1/mcp/api-keys/{kid}']['delete']['operationId']
        ctx=asyncio.run(mcp_api_key_verifier(SimpleNamespace(headers={},state=SimpleNamespace()),body['key']))
        assert ctx.scopes == frozenset(requested)
        assert ctx.tenant_id == 'tenant-a'
        assert 'key' not in client.get('/api/v1/mcp/api-keys').json()[0]


@pytest.fixture
def _fresh_store():
    from mate_tech_db.base import reset_engine, init_engine, create_all
    from mate_tech_mcp.security.api_keys import McpApiKeyStore, set_api_key_runtime
    from mate_tech_mcp.repositories import sql_models
    reset_engine(); init_engine('sqlite:///:memory:'); create_all()
    store=McpApiKeyStore(); set_api_key_runtime(store)
    yield store
    set_api_key_runtime(None); reset_engine()


@pytest.mark.asyncio
async def test_protocol_filters_discovery_and_all_fallbacks(monkeypatch):
    from mate_tech_mcp.protocol.streamable import MateStreamableHttpServer
    from mate_tech_mcp.tools.ontology_proxy import OntObjectQueryTool, OntProposeInstanceTool, OntConfirmProposalTool
    from mate_tech_mcp.repositories import register_tool, reset_store
    from mcp.server.lowlevel.server import request_ctx
    server=create_server()
    for tool in (OntObjectQueryTool(),OntProposeInstanceTool(),OntConfirmProposalTool()): server.register_tool(tool)
    reset_store(); register_tool('tenant-a','remote_write',endpoint='http://127.0.0.1:1')
    surf=MateStreamableHttpServer(server)
    ctx=SimpleNamespace(tenant_id='tenant-a',scopes=frozenset({'ont.read','platform.read'}),auth_method=AuthMethod.API_KEY)
    token=request_ctx.set(SimpleNamespace(request=SimpleNamespace(state=SimpleNamespace(ctx=ctx),headers={})))
    try:
        names={t.name for t in await surf.list_tools()}
        assert names == {'ont_object_query'}
        for name in ('ont_propose_instance','ont_confirm_proposal','remote_write','federated_unknown'):
            with pytest.raises(PermissionError):
                await surf.call_tool(name,{'__caller__':'user','proposal_id':'p'})
    finally:
        request_ctx.reset(token); reset_store()


def test_ttl_invalid_config_fails_without_confirmation(monkeypatch):
    service=ActionService(); p=service.propose('a',{},None,'review')
    monkeypatch.setenv('ONT_APPROVAL_TTL_SECONDS','0')
    with pytest.raises(ValueError): service.confirm_proposal(p.proposal_id,'human')
    assert service.get_proposal(p.proposal_id).status == 'pending'

@pytest.mark.asyncio
async def test_key_rejects_requested_foreign_workspace(_fresh_store):
    from mate_tech_mcp.security.api_keys import mcp_api_key_verifier, McpApiKeyRejected
    _, key = _fresh_store.create(tenant_id='tenant-a',scopes=frozenset({'ont.read'}))
    with pytest.raises(McpApiKeyRejected):
        await mcp_api_key_verifier(SimpleNamespace(headers={'x-tenant-id':'tenant-b'},state=SimpleNamespace()),key)

@pytest.mark.skipif(not __import__('os').getenv('MP11_APPHUB_PG_DSN'),reason='explicit owned PG required')
def test_actual_pg_deadline_guards_and_completed_replay():
    import os,uuid,subprocess,sys,json
    from urllib.parse import urlparse
    import psycopg2
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository
    from mate_kernel.ontology import ClassRef
    dsn=os.environ['MP11_APPHUB_PG_DSN'];u=urlparse(dsn)
    assert u.hostname=='127.0.0.1' and u.port==55497 and u.path.startswith('/codex_mp11_')
    tenant='mp11-app-ui';r=PgOntologyRepository(dsn=dsn);r._ensure_schema()
    def proposal(confirm=True):
        with r.tenant_scope(tenant):
            p=r.propose_action(ClassRef(f'ont.{tenant}.act.review'),{},f'ont.{tenant}.ind.order.2','Task7 deadline')
            return r.confirm_proposal(p.proposal_id,'human',idempotency_key=uuid.uuid4().hex) if confirm else p
    p=proposal(False)
    with r.tenant_scope(tenant),pytest.raises(ProposalNotConfirmed): r.execute_proposal(p.proposal_id,'human',uuid.uuid4().hex)
    for deadline in (None,datetime.now(UTC)-timedelta(seconds=1)):
        p=proposal()
        with psycopg2.connect(dsn) as conn:
            with conn.cursor() as q:q.execute('UPDATE ont_proposal SET approval_expires_at=%s WHERE proposal_id=%s AND tenant_id=%s',(deadline,p.proposal_id,tenant))
        with r.tenant_scope(tenant),pytest.raises(ProposalNotConfirmed):
            # stale in-memory confirmed object must still fail at the locked DB check.
            r._execute_edit_set_proposal(p,actor_id='human',idempotency_key=uuid.uuid4().hex,request_fingerprint='test')
        with r.tenant_scope(tenant): assert not any(a['proposal_id']==p.proposal_id for a in r.list_action_audit(100))
    p=proposal();key=uuid.uuid4().hex
    with r.tenant_scope(tenant): receipt=r.execute_proposal(p.proposal_id,'human',key)
    with psycopg2.connect(dsn) as conn:
        with conn.cursor() as q:q.execute('UPDATE ont_proposal SET approval_expires_at=%s WHERE proposal_id=%s AND tenant_id=%s',(datetime.now(UTC)-timedelta(seconds=1),p.proposal_id,tenant))
    with r.tenant_scope(tenant): assert r.execute_proposal(p.proposal_id,'human',key)['audit_id']==receipt['audit_id']
    code="""import os,json,sys
from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository
r=PgOntologyRepository(dsn=os.environ['MP11_APPHUB_PG_DSN']);p=json.loads(sys.stdin.read())
with r.tenant_scope('mp11-app-ui'):
 result=r.execute_proposal(p['id'],'human',p['key']);assert result['audit_id']==p['audit']
print('PASS independent-process completed deadline replay')
"""
    child=subprocess.run([sys.executable,'-c',code],input=json.dumps({'id':p.proposal_id,'key':key,'audit':receipt['audit_id']}),capture_output=True,text=True)
    assert child.returncode==0,child.stderr

@pytest.mark.skipif(not __import__('os').getenv('MP11_APPHUB_PG_DSN'),reason='explicit owned PG required')
def test_actual_pg_legacy_proposal_rolls_back_before_receipt(monkeypatch):
    import os,uuid
    from urllib.parse import urlparse
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository
    dsn=os.environ['MP11_APPHUB_PG_DSN'];u=urlparse(dsn)
    assert u.hostname=='127.0.0.1' and u.port==55497 and u.path.startswith('/codex_mp11_')
    r=PgOntologyRepository(dsn=dsn);tenant='mp11-app-ui';number=int(uuid.uuid4().hex[:7],16)
    with r.tenant_scope(tenant):
        p=r.propose_create_instance(f'ont.{tenant}.obj.order',{'id':number,'total':5,'status':'pending'},'Task7 rollback')
        r.confirm_proposal(p.proposal_id,'human')
        def fail(*args,**kwargs): raise RuntimeError('injected receipt failure')
        monkeypatch.setattr(r,'_persist_proposal_transition',fail)
        with pytest.raises(RuntimeError,match='injected'):r.execute_proposal(p.proposal_id,'human',uuid.uuid4().hex)
        with pytest.raises(KeyError): r.get_individual(f'ont.{tenant}.ind.order.{number}')
        assert r.get_proposal(p.proposal_id).status=='confirmed'
        with pytest.raises(KeyError):r.get_proposal_execution(p.proposal_id)

@pytest.mark.skipif(not __import__('os').getenv('MP11_APPHUB_PG_DSN'),reason='explicit owned PG required')
def test_actual_pg_legacy_guard_replay_and_ordinary_connection(monkeypatch):
    import os,uuid,psycopg2
    from urllib.parse import urlparse
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository, _LEGACY_PROPOSAL_TX
    from mate_kernel.ontology import ClassRef
    dsn=os.environ['MP11_APPHUB_PG_DSN'];u=urlparse(dsn)
    assert u.hostname=='127.0.0.1' and u.port==55497 and u.path.startswith('/codex_mp11_')
    r=PgOntologyRepository(dsn=dsn);tenant='mp11-app-ui'
    def new():
        number=int(uuid.uuid4().hex[:7],16)
        return r.propose_create_instance(f'ont.{tenant}.obj.order',{'id':number,'total':5,'status':'pending'},'Task7 legacy deadline')
    with r.tenant_scope(tenant):
        for value in (None,datetime.now(UTC)-timedelta(seconds=1)):
            p=new();r.confirm_proposal(p.proposal_id,'human')
            with psycopg2.connect(dsn) as conn:
                with conn.cursor() as q:q.execute('UPDATE ont_proposal SET approval_expires_at=%s WHERE proposal_id=%s',(value,p.proposal_id))
            with pytest.raises(ProposalNotConfirmed):r.execute_proposal(p.proposal_id,'human',uuid.uuid4().hex)
            with pytest.raises(KeyError):r.get_proposal_execution(p.proposal_id)
        p=new();r.confirm_proposal(p.proposal_id,'human');key=uuid.uuid4().hex
        result=r.execute_proposal(p.proposal_id,'human',key)
        with psycopg2.connect(dsn) as conn:
            with conn.cursor() as q:q.execute('UPDATE ont_proposal SET approval_expires_at=NULL WHERE proposal_id=%s',(p.proposal_id,))
        assert r.execute_proposal(p.proposal_id,'human',key)==result
        assert _LEGACY_PROPOSAL_TX.get() is None
        # Ordinary repository update still commits and is visible on a new connection.
        ind=r.get_individual(result['individual_rid'])
        r.create_individual(replace(ind,rid=ind.rid+'ordinary',primary_key=ind.primary_key+'ordinary'))
        independent=PgOntologyRepository(dsn=dsn)
        with independent.tenant_scope(tenant): assert independent.get_individual(ind.rid+'ordinary').rid==ind.rid+'ordinary'
        r.delete_individual(ind.rid+'ordinary')
        r.delete_individual(ind.rid)

@pytest.mark.skipif(not __import__('os').getenv('MP11_APPHUB_PG_DSN'),reason='explicit owned PG required')
def test_actual_pg_legacy_state_rechecked_after_row_lock(monkeypatch):
    import os,uuid,threading,psycopg2
    from urllib.parse import urlparse
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository
    dsn=os.environ['MP11_APPHUB_PG_DSN'];u=urlparse(dsn)
    assert u.hostname=='127.0.0.1' and u.port==55497 and u.path.startswith('/codex_mp11_')
    r=PgOntologyRepository(dsn=dsn);tenant='mp11-app-ui'
    with r.tenant_scope(tenant):
        p=r.propose_create_instance(f'ont.{tenant}.obj.order',{'id':int(uuid.uuid4().hex[:7],16),'total':5,'status':'pending'},'Task7 state race')
        r.confirm_proposal(p.proposal_id,'human')
    outcome=[];started=threading.Event()
    original_get=r.get_proposal
    def get_and_signal(pid):
        value=original_get(pid)
        started.set()  # initial confirmed read completed while the row is locked elsewhere
        return value
    monkeypatch.setattr(r,'get_proposal',get_and_signal)
    def worker():
        with r.tenant_scope(tenant):
            try:r.execute_proposal(p.proposal_id,'human',uuid.uuid4().hex)
            except Exception as exc:outcome.append(exc)
    with psycopg2.connect(dsn) as conn:
        with conn.cursor() as q:
            q.execute('SELECT proposal_id FROM ont_proposal WHERE proposal_id=%s FOR UPDATE',(p.proposal_id,))
            t=threading.Thread(target=worker);t.start();assert started.wait(2)
            q.execute("UPDATE ont_proposal SET status='rejected' WHERE proposal_id=%s",(p.proposal_id,))
    t.join(10);assert not t.is_alive()
    assert len(outcome)==1 and isinstance(outcome[0],ProposalNotConfirmed)
    with r.tenant_scope(tenant),pytest.raises(KeyError):r.get_proposal_execution(p.proposal_id)

@pytest.mark.skipif(not __import__('os').getenv('MP11_APPHUB_PG_DSN'),reason='explicit owned PG required')
@pytest.mark.parametrize('kind',['model_type','merge_suggestion'])
def test_actual_pg_legacy_model_merge_atomic_receipt(kind,monkeypatch):
    import os,uuid,psycopg2
    from urllib.parse import urlparse
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository
    from mate_kernel.ontology import ClassRef
    from mate_kernel.ontology.types import ObjectType,Property,PropertyFormat
    dsn=os.environ['MP11_APPHUB_PG_DSN'];u=urlparse(dsn)
    assert u.hostname=='127.0.0.1' and u.port==55497 and u.path.startswith('/codex_mp11_')
    r=PgOntologyRepository(dsn=dsn);tenant='mp11-app-ui';slug='task7-'+uuid.uuid4().hex[:10]
    rid=f'ont.{tenant}.obj.task7.{slug}.v1';pk=f'ont.{tenant}.prop.{slug}-id'
    with r.tenant_scope(tenant):
        if kind=='model_type':
            p=r.propose_model_type({'rid':rid,'primary_key':[pk],'properties':[{'rid':pk,'type_id':'string','primary_key':True,'nullable':False}]},'Task7 model rollback')
        else:
            other=rid.replace(slug,slug+'target')
            for ref in (rid,other):r.upsert_object_type(ObjectType(rid=ClassRef(ref),primary_key=(ClassRef(pk),),properties=(Property(rid=ClassRef(pk),type_id='string',nullable=False,primary_key=True,title='id',format=PropertyFormat.STRING),)))
            p=r.propose_merge(rid,other,1.0,'Task7 merge rollback')
        r.confirm_proposal(p.proposal_id,'human');key=uuid.uuid4().hex
        original=r._persist_proposal_transition
        def fail(*args,**kwargs):raise RuntimeError('injected receipt failure')
        monkeypatch.setattr(r,'_persist_proposal_transition',fail)
        with pytest.raises(RuntimeError,match='injected'):r.execute_proposal(p.proposal_id,'human',key)
        with psycopg2.connect(dsn) as conn:
            with conn.cursor() as q:
                q.execute('SELECT archived FROM ont_object_type WHERE rid=%s',(rid,));row=q.fetchone()
                assert row is None if kind=='model_type' else row==(False,)
        assert r.get_proposal(p.proposal_id).status=='confirmed'
        with pytest.raises(KeyError):r.get_proposal_execution(p.proposal_id)
        monkeypatch.setattr(r,'_persist_proposal_transition',original)
        receipt=r.execute_proposal(p.proposal_id,'human',key)
        assert receipt['kind']==kind
        assert r.execute_proposal(p.proposal_id,'human',key)==receipt

def test_legacy_transaction_lease_rejects_wrong_tenant_and_escaped_context():
    import contextvars
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository,_ProposalConnectionLease,_LEGACY_PROPOSAL_TX
    owner=SimpleNamespace(_current_tenant=lambda:'tenant-a')
    connection=SimpleNamespace(closed=False)
    lease=_ProposalConnectionLease(owner,connection)
    token=_LEGACY_PROPOSAL_TX.set(lease)
    try:
        escaped=contextvars.copy_context()
        owner._current_tenant=lambda:'tenant-b'
        with pytest.raises(RuntimeError,match='context mismatch'):PgOntologyRepository._connect(owner)
        owner._current_tenant=lambda:'tenant-a'
        lease.active=False
        with pytest.raises(RuntimeError,match='context mismatch'):escaped.run(PgOntologyRepository._connect,owner)
    finally:_LEGACY_PROPOSAL_TX.reset(token)

@pytest.mark.asyncio
async def test_concrete_operation_authority_and_preview_metadata():
    from mate_tech_mcp.tools.ontology_proxy import OntPreviewProposalTool,OntValidatePreflightTool,OntologyProxyTool
    from mate_tech_ont.v2_kernel.api import router
    route=next(r for r in router.routes if r.path.endswith('/proposals/{proposal_id}/preview'))
    assert OntPreviewProposalTool.operation_id==route.operation_id
    server=create_server();tools=[OntValidatePreflightTool(),OntologyProxyTool()]
    try:
        for tool in tools:server.register_tool(tool)
        with bind_caller(tenant_id='a',bearer_token='',scopes=frozenset({'ont.read','platform.read'}),auth_method=AuthMethod.API_KEY):
            assert not await server.list_tools('a')
            for tool in tools:
                with pytest.raises(PermissionError):await tool._outbound_headers()
        with bind_caller(tenant_id='a',bearer_token='',scopes=frozenset({'ont.read','platform.read','ont.write','platform.write'}),auth_method=AuthMethod.API_KEY):
            assert [t['name'] for t in await server.list_tools('a')]==['ont_validate_preflight']
    finally:
        for tool in tools:await tool.aclose()


@pytest.fixture
def owned_embedding_repo(monkeypatch):
    """Dedicated Fix1 DB; never alter the accepted published Order schema."""
    import os, uuid
    from urllib.parse import urlparse
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository
    from mate_kernel.ontology import ClassRef
    from mate_kernel.ontology.types import ObjectType, Property, PropertyFormat
    source = os.environ.get('MP11_APPHUB_PG_DSN')
    if not source:
        pytest.skip('explicit owned PG required')
    parsed = urlparse(source)
    assert parsed.hostname == '127.0.0.1' and parsed.port == 55497
    assert parsed.path.startswith('/codex_mp11_')
    dsn = source.rsplit('/', 1)[0] + '/codex_mp11_agent_pgvector_fix1_20261012'
    monkeypatch.setenv('ONT_VECTOR_DIM', '3')
    repo = PgOntologyRepository(dsn=dsn)
    tenant = 'mp11-vector-fix'
    slug = 'case-' + uuid.uuid4().hex[:10]
    rid = f'ont.{tenant}.obj.{slug}'
    pk = ClassRef(f'ont.{tenant}.prop.id')
    status = ClassRef(f'ont.{tenant}.prop.status')
    calls = []
    class Embedder:
        def embed(self, text):
            calls.append(text)
            return [0.25, 0.5, 0.75]
    repo.set_embedder(Embedder())
    with repo.tenant_scope(tenant):
        repo.upsert_object_type(ObjectType(
            rid=ClassRef(rid), primary_key=(pk,), properties=(
                Property(pk, 'string', False, True, 'id', PropertyFormat.STRING),
                Property(status, 'string', True, False, 'status', PropertyFormat.STRING),
            ),
        ))
        class OwnedEmbeddingFixture(tuple):
            def __repr__(self): return "<owned embedding fixture: loopback55497/codex_mp11_agent_pgvector_fix1_20261012>"
        yield OwnedEmbeddingFixture((repo, dsn, tenant, rid, calls))


def test_actual_pg_proposal_embedding_unavailable_extension_falls_back(owned_embedding_repo, monkeypatch):
    """Real failed CREATE EXTENSION aborts PG, not a Python-only mock error."""
    import uuid, psycopg2
    from psycopg2.extensions import TRANSACTION_STATUS_INERROR
    repo, dsn, tenant, rid, embeddings = owned_embedding_repo
    original_cursor = repo._cursor
    failures = []
    class ExtensionUnavailableCursor:
        def __init__(self, cursor): self.cursor = cursor
        def __enter__(self): self.cursor.__enter__(); return self
        def __exit__(self, *args): return self.cursor.__exit__(*args)
        def __getattr__(self, name): return getattr(self.cursor, name)
        def execute(self, statement, params=None):
            if statement == 'CREATE EXTENSION IF NOT EXISTS vector':
                try:
                    self.cursor.execute('CREATE EXTENSION codex_mp11_unavailable_vector')
                except psycopg2.Error as exc:
                    failures.append((exc.pgcode, self.cursor.connection.get_transaction_status()))
                    raise
            return self.cursor.execute(statement, params)
    monkeypatch.setattr(repo, '_cursor', lambda conn: ExtensionUnavailableCursor(original_cursor(conn)))
    repo._pgvector_ready = False
    repo._pgvector_dim = 0
    repo._try_pgvector_upgrade()  # Prove genuine unavailable extension on owned PG.
    assert failures == [('0A000', TRANSACTION_STATUS_INERROR)]
    proposal = repo.propose_create_instance(rid, {'id': uuid.uuid4().hex, 'status': 'new'}, 'Fix1 JSONB fallback')
    repo.confirm_proposal(proposal.proposal_id, 'human')
    key = uuid.uuid4().hex
    receipt = repo.execute_proposal(proposal.proposal_id, 'human', key)
    assert receipt['kind'] == 'create_instance' and embeddings
    assert len(failures) == 1  # Lease never performs opportunistic extension DDL.
    assert repo._pgvector_ready is False and repo._pgvector_dim == 0
    with psycopg2.connect(dsn) as conn, conn.cursor() as cur:
        cur.execute('SELECT embedding,embedding_vec IS NULL FROM ont_object_embedding WHERE individual_rid=%s', (receipt['individual_rid'],))
        rows = cur.fetchall()
        assert len(rows) == 2 and all(row == ([0.25, 0.5, 0.75], True) for row in rows)
    assert repo.execute_proposal(proposal.proposal_id, 'human', key) == receipt
    # Ordinary create still tries the optional upgrade on its own connection;
    # its genuine SQL failure is isolated and JSONB embeddings still commit.
    ind = repo.get_individual(receipt['individual_rid'])
    direct = replace(ind, rid=ind.rid+'ordinary', primary_key=ind.primary_key+'ordinary')
    repo.create_individual(direct)
    assert len(failures) > 1
    with psycopg2.connect(dsn) as conn, conn.cursor() as cur:
        cur.execute('SELECT count(*) FROM ont_object_embedding WHERE individual_rid=%s', (direct.rid,))
        assert cur.fetchone() == (2,)


def test_actual_pg_proposal_embedding_receipt_rollback_keeps_readiness_honest(owned_embedding_repo, monkeypatch):
    import uuid, psycopg2
    repo, dsn, tenant, rid, embeddings = owned_embedding_repo
    # Isolated Fix1 DB only: make the optional vector column genuinely absent.
    with psycopg2.connect(dsn) as conn, conn.cursor() as cur:
        cur.execute('ALTER TABLE ont_object_embedding DROP COLUMN IF EXISTS embedding_vec')
    repo._pgvector_ready = False
    repo._pgvector_dim = 0
    proposal = repo.propose_create_instance(rid, {'id': uuid.uuid4().hex, 'status': 'new'}, 'Fix1 receipt rollback')
    repo.confirm_proposal(proposal.proposal_id, 'human')
    original = repo._persist_proposal_transition
    def fail(*args, **kwargs): raise RuntimeError('injected post-embedding receipt failure')
    monkeypatch.setattr(repo, '_persist_proposal_transition', fail)
    key = uuid.uuid4().hex
    with pytest.raises(RuntimeError, match='post-embedding'):
        repo.execute_proposal(proposal.proposal_id, 'human', key)
    assert embeddings
    iid = 'ont.'+tenant+'.ind.'+rid.split('.')[-1]+'.'+proposal.parameters['props']['id']
    with psycopg2.connect(dsn) as conn, conn.cursor() as cur:
        cur.execute('SELECT 1 FROM ont_individual WHERE rid=%s', (iid,)); assert cur.fetchone() is None
        cur.execute('SELECT 1 FROM ont_object_embedding WHERE individual_rid=%s', (iid,)); assert cur.fetchone() is None
        cur.execute("SELECT 1 FROM pg_attribute WHERE attrelid='ont_object_embedding'::regclass AND attname='embedding_vec' AND NOT attisdropped")
        assert cur.fetchone() is None
    assert repo._pgvector_ready is False and repo._pgvector_dim == 0
    assert repo.get_proposal(proposal.proposal_id).status == 'confirmed'
    with pytest.raises(KeyError): repo.get_proposal_execution(proposal.proposal_id)
    monkeypatch.setattr(repo, '_persist_proposal_transition', original)
    receipt = repo.execute_proposal(proposal.proposal_id, 'human', key)
    assert repo.execute_proposal(proposal.proposal_id, 'human', key) == receipt
    # Outside a Proposal, existing upgrade/indexing still succeeds and commits.
    repo._try_pgvector_upgrade()
    assert repo._pgvector_ready is True and repo._pgvector_dim == 3
    ind = repo.get_individual(receipt['individual_rid'])
    direct = replace(ind, rid=ind.rid+'ordinary', primary_key=ind.primary_key+'ordinary')
    repo.create_individual(direct)
    with psycopg2.connect(dsn) as conn, conn.cursor() as cur:
        cur.execute('SELECT embedding_vec::text FROM ont_object_embedding WHERE individual_rid=%s', (direct.rid,))
        assert cur.fetchall() == [('[0.25,0.5,0.75]',), ('[0.25,0.5,0.75]',)]
