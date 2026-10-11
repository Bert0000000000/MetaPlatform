"""Published application artifacts must persist without fabricating lifecycle state."""
from dataclasses import replace

import pytest

from mate_app_hub.repositories import in_memory as mem, sql_store as sql
from mate_tech_db.base import init_engine, create_all, reset_engine


@pytest.fixture
def database(tmp_path):
    url = f"sqlite:///{tmp_path / 'apphub.db'}"
    reset_engine()
    init_engine(url)
    create_all()
    yield url
    reset_engine()


def test_legacy_metadata_does_not_invent_publication_or_timestamps(database):
    app = mem.ApphubApp('app-order', 'a', 'Orders', 'orders', 'business', '')
    sql.put_app('a', app)
    actual = sql.get_app('a', 'app-order')
    assert getattr(actual, 'status', None) == 'DESIGNING'
    assert actual.created_at is None
    assert actual.updated_at is None


def test_published_snapshot_and_page_definition_survive_engine_restart(database):
    app = mem.ApphubApp('app-order', 'a', 'Orders', 'orders', 'business', '')
    definition = {'widgets': [], 'binding': {'object_type': 'Order.v1', 'fields': ['amount']}}
    page = mem.ApphubPage('page-order', 'a', 'Orders', 'orders', 'orders', 'grid')
    assert hasattr(page, 'definition'), 'actual page definition must be stored'
    sql.put_page('a', replace(page, definition=definition))
    snapshot = {'versionId': 'v1', 'version': '1.0.0', 'status': 'PUBLISHED', 'modules': [{'pages': [definition]}]}
    sql.put_app('a', replace(app, status='PUBLISHED', versions=[snapshot], published_version_id='v1'))
    reset_engine()
    init_engine(database)
    saved = sql.get_app('a', 'app-order')
    assert saved.versions == [snapshot]
    assert saved.published_version_id == 'v1'
    assert sql.get_page('a', 'page-order').definition == definition
    assert sql.get_app('b', 'app-order') is None


def test_sql_write_cannot_overwrite_another_tenants_app(database):
    app = mem.ApphubApp('app-shared', 'a', 'Original', 'orders', 'business', '')
    sql.put_app('a', app)
    with pytest.raises(ValueError, match='tenant'):
        sql.put_app('b', replace(app, tenant_id='b', name='Stolen'))
    assert sql.get_app('a', 'app-shared').name == 'Original'


def test_facade_uses_configured_sql_without_seed_data(database, monkeypatch):
    from mate_app_hub import repositories
    monkeypatch.setenv('MATE_DB_URL', database)
    assert repositories.list_apps('a') == []
    app = mem.ApphubApp('app-order', 'a', 'Orders', 'orders', 'business', '')
    repositories.put_app('a', app)
    assert sql.get_app('a', 'app-order') == app
    assert repositories.get_app('a', 'orders') == app


def test_sql_http_page_save_and_unpublished_runtime(database, monkeypatch, auth_headers_acme):
    from fastapi.testclient import TestClient
    from mate_app_hub.main import create_app
    monkeypatch.setenv('MATE_DB_URL', database)
    app = mem.ApphubApp('app-order', 'tenant-acme', 'Orders', 'orders', 'business', '')
    sql.put_app('tenant-acme', app)
    sql.put_module('tenant-acme', mem.ApphubModule('mod-order', 'tenant-acme', 'Orders', 'orders', 'orders', '', ''))
    sql.put_page('tenant-acme', mem.ApphubPage('page-order', 'tenant-acme', 'Orders', 'orders', 'orders', 'grid'))
    with TestClient(create_app()) as client:
        detail = client.get('/api/v1/apphub/apps/app-order', headers=auth_headers_acme)
        assert detail.status_code == 200
        assert detail.json()['status'] == 'DESIGNING'
        assert detail.json()['module_count'] == 1
        saved = client.put('/api/v1/apphub/pages/page-order', headers=auth_headers_acme,
                           json={'name': 'Order review', 'layout': 'grid', 'widgets': [{'id': 'real-table', 'type': 'table'}]})
        assert saved.status_code == 200
        assert sql.get_page('tenant-acme', 'page-order').definition['widgets'][0]['id'] == 'real-table'
        runtime = client.get('/api/v1/apphub/apps/orders/runtime', headers=auth_headers_acme)
        assert runtime.status_code == 409
        assert 'publish' in runtime.text.lower()


def test_empty_publish_and_readonly_mutations_fail_closed(client, auth_headers_acme):
    import jwt
    claims = jwt.decode(auth_headers_acme['Authorization'].split()[1], options={"verify_signature": False})
    claims['scope'] = 'platform.read'
    readonly = {'Authorization': 'Bearer ' + jwt.encode(claims, 'fixture-only-signing-key-long-enough', algorithm='HS256')}
    publish = client.post('/api/v1/apphub/apps/order-review/publish', headers=auth_headers_acme)
    assert publish.status_code == 422
    for path, method, body in [
        ('/apps/order-review/publish', 'post', {}),
        ('/pages/page-kb-search', 'put', {'name': 'Stolen', 'widgets': []}),
        ('/shortlinks', 'post', {'app_id': 'order-review'}),
    ]:
        assert getattr(client, method)('/api/v1/apphub' + path, headers=readonly, json=body).status_code == 403



def test_shortlink_uses_sql_and_survives_new_store(database, monkeypatch):
    from mate_app_hub.shortlink.service import get_default_store, create_shortlink, resolve_shortlink, revoke_shortlink
    monkeypatch.setenv('MATE_DB_URL', database)
    entry = create_shortlink(get_default_store(), 'a', 'app-order')
    assert sql.get_shortlink_by_code('a', entry.code) is not None
    reset_engine()
    init_engine(database)
    assert resolve_shortlink(get_default_store(), 'a', entry.code)['app_id'] == 'app-order'
    with pytest.raises(ValueError):
        resolve_shortlink(get_default_store(), 'b', entry.code)
    assert revoke_shortlink(get_default_store(), 'a', entry.code)
    with pytest.raises(ValueError):
        resolve_shortlink(get_default_store(), 'a', entry.code)



def test_saved_binding_publishes_snapshot_runtime_and_tenant_usage(client, auth_headers_acme, auth_headers_globex, monkeypatch):
    import httpx
    from mate_app_hub.api import app as api_module
    import runpy
    from pathlib import Path
    fixtures = runpy.run_path(str(Path(__file__).with_name('test_apphub_order_binding.py')))
    spec, documents = fixtures['spec'], fixtures['documents']
    # This test covers real AppHub handlers with an explicitly mocked ontology HTTP dependency.
    docs = {key.replace("ont.a.", "ont.tenant-acme."): value for key, value in documents().items()}
    import json
    docs = json.loads(json.dumps(docs).replace("ont.a.", "ont.tenant-acme."))
    bound = json.loads(json.dumps(spec()).replace("ont.a.", "ont.tenant-acme."))
    monkeypatch.setattr(api_module, "ontology_client", lambda request: httpx.AsyncClient(
        base_url="http://ontology", transport=httpx.MockTransport(lambda req: httpx.Response(200, json=docs[req.url.path]))),
        raising=False)
    mem.put_app('tenant-acme', mem.ApphubApp('app-real', 'tenant-acme', 'Real orders', 'real', 'business', ''))
    mem.put_module('tenant-acme', mem.ApphubModule('mod-real', 'tenant-acme', 'Orders', 'real', 'real', '', ''))
    mem.put_page('tenant-acme', replace(mem.ApphubPage('page-real', 'tenant-acme', 'Orders', 'real', 'real', 'grid'),
                                      definition={'binding': bound, 'widgets': []}))
    published = client.post('/api/v1/apphub/apps/real/publish', headers=auth_headers_acme)
    assert published.status_code == 200, published.text
    versions = client.get('/api/v1/apphub/apps/real/versions', headers=auth_headers_acme).json()['items']
    assert len(versions) == 1
    assert versions[0]['modules'][0]['pages'][0]['definition']['binding']['action_checksum']
    usage = client.get('/api/v1/apphub/bindings/usage', params={'class_rid': bound['object_type']}, headers=auth_headers_acme)
    assert usage.status_code == 200
    assert any(i['app_id'] == 'app-real' and i['status'] == 'PUBLISHED' for i in usage.json()['items'])
    denied = client.get('/api/v1/apphub/bindings/usage', params={'class_rid': bound['object_type']}, headers=auth_headers_globex)
    assert denied.status_code == 403
    # Editing the draft must not mutate the previously published snapshot.
    client.put('/api/v1/apphub/pages/page-real', headers=auth_headers_acme, json={'name': 'Unsaved next release', 'widgets': []})
    rt = client.get('/api/v1/apphub/apps/real/runtime', headers=auth_headers_acme)
    assert rt.status_code == 200
    assert rt.json()['render_tree'][0]['config']['binding']['object_type'] == bound['object_type']
    docs['/api/v1/ont/v2/object-types/' + bound['object_type']]['checksum'] = 'changed'
    assert client.get('/api/v1/apphub/apps/real/runtime', headers=auth_headers_acme).status_code == 409




def test_release_snapshot_and_tasks_are_durable_and_tenant_scoped(database, monkeypatch, auth_headers_acme, auth_headers_globex):
    from fastapi.testclient import TestClient
    from mate_app_hub.main import create_app
    monkeypatch.setenv('MATE_DB_URL', database)
    sql.put_app('tenant-acme', mem.ApphubApp('app-real', 'tenant-acme', 'Real', 'real', 'business', ''))
    sql.put_module('tenant-acme', mem.ApphubModule('mod-real', 'tenant-acme', 'Real', 'real', 'real', '', ''))
    sql.put_page('tenant-acme', replace(mem.ApphubPage('page-real', 'tenant-acme', 'Real', 'real', 'real', 'grid'),
                                      definition={'widgets': [{'id': 'text', 'type': 'text', 'title': 'Saved'}]}))
    with TestClient(create_app()) as client:
        release = client.post('/api/v1/apphub/apps/real/releases', headers=auth_headers_acme,
                              json={'version': '1.2.0', 'strategy': 'FULL'}).json()
        assert sql.get_app('tenant-acme', 'real').releases, 'release records must be persisted'
        process = release['processInstanceId']
        assert client.get('/api/v1/apphub/v1/wfe/release-approval/' + process + '/tasks', headers=auth_headers_globex).status_code == 404
    reset_engine(); init_engine(database)
    with TestClient(create_app()) as client:
        assert client.get('/api/v1/apphub/releases/' + release['releaseId'], headers=auth_headers_acme).status_code == 200
        assert client.get('/api/v1/apphub/releases/' + release['releaseId'], headers=auth_headers_globex).status_code == 404



def test_offline_app_cannot_issue_shortlink(client, auth_headers_acme):
    mem.put_app('tenant-acme', replace(mem.ApphubApp('app-offline', 'tenant-acme', 'Offline', 'offline', 'business', ''),
                                     status='OFFLINE', published_version_id='previous'))
    response = client.post('/api/v1/apphub/shortlinks', headers=auth_headers_acme, json={'app_id': 'offline'})
    assert response.status_code == 409


def test_preview_reads_draft_binding_without_publishing(client, auth_headers_acme, monkeypatch):
    import httpx, runpy, json
    from pathlib import Path
    from mate_app_hub.api import app as api_module
    fixtures = runpy.run_path(str(Path(__file__).with_name('test_apphub_order_binding.py')))
    docs = json.loads(json.dumps(fixtures['documents']()).replace('ont.a.', 'ont.tenant-acme.'))
    bound = json.loads(json.dumps(fixtures['spec']()).replace('ont.a.', 'ont.tenant-acme.'))
    queries = []
    def upstream(request):
        if request.url.path.endswith('object-sets:evaluate'):
            query = json.loads(request.content); queries.append(query)
            return httpx.Response(200, json=[{'rid': query['class_rid'] + '.one', 'props': {}}])
        if request.url.path.endswith('link-instances'):
            return httpx.Response(200, json=[])
        return httpx.Response(200, json=docs[request.url.path])
    monkeypatch.setattr(api_module, 'ontology_client', lambda request: httpx.AsyncClient(base_url='http://ontology', transport=httpx.MockTransport(upstream)))
    mem.put_page('tenant-acme', mem.ApphubPage('page-preview', 'tenant-acme', 'Draft', 'draft', 'orders', 'grid'))
    response = client.post('/api/v1/apphub/pages/page-preview/preview', headers=auth_headers_acme,
                           json={'name': 'Draft', 'binding': bound})
    assert response.status_code == 200, response.text
    assert response.json()['orders'][0]['rid'] == bound['object_type'] + '.one'
    assert response.json()['version'] == 'DRAFT_PREVIEW'
    assert queries[0]['class_rid'] == bound['object_type']
    assert next(p for p in mem.list_pages('tenant-acme') if p.id == 'page-preview').definition == {}

@pytest.mark.parametrize('backend', ['sql', 'memory'])
def test_stale_application_write_cannot_erase_publication_history(database, backend):
    repo = sql if backend == 'sql' else mem
    repo.put_app('race', mem.ApphubApp('app-race', 'race', 'Race', 'race', 'business', ''))
    old = repo.get_app('race', 'race')
    repo.put_app('race', replace(old, status='PUBLISHED', published_version_id='new', versions=[{'versionId':'new'}]))
    with pytest.raises(ValueError, match='changed'):
        repo.put_app('race', replace(old, name='stale page save', published_version_id='old'))
    actual = repo.get_app('race', 'race')
    assert actual.published_version_id == 'new'
    assert actual.versions == [{'versionId':'new'}]

def test_sql_group_creation_is_insert_only_and_tenant_isolated(database, monkeypatch, auth_headers_acme, auth_headers_globex):
    from fastapi.testclient import TestClient
    from mate_app_hub.main import create_app
    monkeypatch.setenv('MATE_DB_URL',database)
    with TestClient(create_app()) as client:
        for headers,name in [(auth_headers_acme,'Acme Business'),(auth_headers_globex,'Globex Business')]:
            result=client.post('/api/v1/apphub/groups',headers=headers,json={'code':'business','name':name})
            assert result.status_code==201,result.text
        assert sql.get_group('tenant-acme','business').name=='Acme Business'
        assert sql.get_group('tenant-globex','business').name=='Globex Business'
        existing=sql.get_group('tenant-acme','business')
        with pytest.raises(ValueError,match='exists'):
            sql.insert_group('tenant-acme',replace(existing,name='Do not overwrite'))
        assert sql.get_group('tenant-acme','business').name=='Acme Business'

def test_offline_reverse_reference_reports_actual_application_state(client, auth_headers_acme):
    binding={'object_type':'ont.tenant-acme.obj.order','model_checksum':'sha'}
    mem.put_app('tenant-acme',replace(mem.ApphubApp('ref-offline','tenant-acme','Offline','ref-offline','business',''),status='OFFLINE',published_version_id='v1',versions=[{'versionId':'v1','modules':[{'pages':[{'id':'page','definition':{'binding':binding}}]}]}]))
    response=client.get('/api/v1/apphub/bindings/usage',params={'class_rid':binding['object_type']},headers=auth_headers_acme)
    assert response.status_code==200
    assert response.json()['items'][0]['status']=='OFFLINE'

@pytest.mark.parametrize('shape',['fresh','legacy','already_current'])
def test_role_migration_supports_fresh_legacy_and_startup_created_table(tmp_path, shape):
    import importlib.util
    from pathlib import Path
    from sqlalchemy import create_engine, text, inspect
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    path=Path(__file__).resolve().parents[3]/'alembic/versions/20260831_0017_orchestrator_role_actor_roles.py'
    spec=importlib.util.spec_from_file_location('role_migration',path)
    migration=importlib.util.module_from_spec(spec);spec.loader.exec_module(migration)
    engine=create_engine('sqlite:///'+str(tmp_path/'role-migration.sqlite'))
    with engine.begin() as connection:
        if shape!='fresh':
            connection.execute(text('CREATE TABLE orchestrator_roles(tenant_id VARCHAR(64) NOT NULL, role VARCHAR(64) NOT NULL,name VARCHAR(256) NOT NULL,capabilities TEXT NOT NULL,enabled BOOLEAN NOT NULL,created_at VARCHAR(64) NOT NULL, PRIMARY KEY(tenant_id,role))'))
            connection.execute(text("INSERT INTO orchestrator_roles VALUES('a','reviewer','Keep','[]',1,'old')"))
        if shape=='already_current':
            connection.execute(text("ALTER TABLE orchestrator_roles ADD COLUMN allowed_actor_roles TEXT NOT NULL DEFAULT '[]'"))
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            assert 'allowed_actor_roles' in {c['name'] for c in inspect(connection).get_columns('orchestrator_roles')}
            assert set(inspect(connection).get_pk_constraint('orchestrator_roles')['constrained_columns'])=={'tenant_id','role'}
            if shape!='fresh':
                assert connection.execute(text('SELECT name,allowed_actor_roles FROM orchestrator_roles')).one()==('Keep','[]')
            migration.downgrade()
            assert 'orchestrator_roles' in inspect(connection).get_table_names()
            assert 'allowed_actor_roles' not in {c['name'] for c in inspect(connection).get_columns('orchestrator_roles')}

def test_publication_migration_adds_revision_and_release_history(tmp_path):
    import importlib.util
    from pathlib import Path
    from sqlalchemy import create_engine, text, inspect
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    path=Path(__file__).resolve().parents[3]/'alembic/versions/20261011_0021_apphub_publication.py'
    spec=importlib.util.spec_from_file_location('publication_migration',path)
    migration=importlib.util.module_from_spec(spec);spec.loader.exec_module(migration)
    engine=create_engine('sqlite:///'+str(tmp_path/'publication-migration.sqlite'))
    with engine.begin() as connection:
        connection.execute(text('CREATE TABLE apphub_apps(id VARCHAR(64) PRIMARY KEY)'))
        connection.execute(text("INSERT INTO apphub_apps VALUES('old')"))
        connection.execute(text('CREATE TABLE apphub_pages(id VARCHAR(64) PRIMARY KEY)'))
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            assert connection.execute(text('SELECT revision,releases,versions,status FROM apphub_apps')).one()==(0,'[]','[]','DESIGNING')
            migration.upgrade()
            migration.downgrade()
            assert {c['name'] for c in inspect(connection).get_columns('apphub_apps')}=={'id'}

def test_production_requires_explicit_sql_selection(database, monkeypatch):
    from mate_app_hub.main import create_app
    monkeypatch.setenv('MATE_PROFILE','production')
    monkeypatch.delenv('MATE_DB_URL',raising=False);monkeypatch.delenv('DATABASE_URL',raising=False)
    with pytest.raises(RuntimeError,match='in-memory AppHub'):
        create_app()
    monkeypatch.setenv('MATE_DB_URL',database)
    assert create_app().title=='mate-app-hub'

def test_page_save_reports_partial_result_when_app_metadata_conflicts(client,auth_headers_acme,monkeypatch):
    from mate_app_hub.api import app as api
    from fastapi import HTTPException
    mem.put_app('tenant-acme',mem.ApphubApp('partial','tenant-acme','Partial','partial','business',''))
    mem.put_module('tenant-acme',mem.ApphubModule('partial','tenant-acme','Partial','partial','partial','',''))
    mem.put_page('tenant-acme',mem.ApphubPage('partial','tenant-acme','Partial','partial','partial','grid'))
    def conflict(*args,**kwargs):raise HTTPException(status_code=409,detail='newer publication')
    monkeypatch.setattr(api,'put_app',conflict)
    response=client.put('/api/v1/apphub/pages/partial',headers=auth_headers_acme,json={'name':'Saved input','widgets':[]})
    assert response.status_code==200 and response.json()['application_metadata_updated'] is False
    assert next(p for p in mem.list_pages('tenant-acme') if p.id=='partial').definition['name']=='Saved input'

def test_stale_release_approval_cannot_replace_new_running_snapshot(client,auth_headers_acme):
    import jwt
    claims=jwt.decode(auth_headers_acme['Authorization'].split()[1],options={'verify_signature':False});claims.pop('azp',None)
    headers={'Authorization':'Bearer '+jwt.encode(claims,'fixture-signing-key-at-least-32-characters',algorithm='HS256')}
    mem.put_app('tenant-acme',mem.ApphubApp('stale-release','tenant-acme','Release','stale-release','business',''))
    mem.put_module('tenant-acme',mem.ApphubModule('stale-release','tenant-acme','Release','stale-release','stale-release','',''))
    mem.put_page('tenant-acme',replace(mem.ApphubPage('stale-release','tenant-acme','Release','stale-release','stale-release','grid'),definition={'widgets':[{'id':'text','type':'text'}]}))
    response=client.post('/api/v1/apphub/apps/stale-release/releases',headers=headers,json={'version':'1.0.0'})
    assert response.status_code==201,response.text
    release=response.json();prefix='/api/v1/apphub/v1/wfe/release-approval/'+release['processInstanceId']+'/tasks'
    tasks=client.get(prefix,headers=headers).json()
    assert client.post(prefix+'/'+tasks[0]['id']+'/complete',headers=headers,json={'approved':True}).status_code==200
    newer=client.post('/api/v1/apphub/apps/stale-release/publish',headers=headers)
    assert newer.status_code==200,newer.text
    result=client.post(prefix+'/'+tasks[1]['id']+'/complete',headers=headers,json={'approved':True})
    assert result.status_code==409,result.text
    actual=mem.get_app('tenant-acme','stale-release')
    assert actual.published_version_id==newer.json()['version_id']
    assert actual.releases[0]['tasks'][1]['status']=='ACTIVE'

def test_sql_module_and_page_codes_are_isolated_between_tenants(database,monkeypatch,auth_headers_acme,auth_headers_globex):
    from fastapi.testclient import TestClient
    from mate_app_hub.main import create_app
    monkeypatch.setenv('MATE_DB_URL',database)
    for tenant in ['tenant-acme','tenant-globex']:
        sql.put_app(tenant,mem.ApphubApp(tenant,tenant,tenant,'orders','business',''))
    with TestClient(create_app()) as client:
        for headers,name in [(auth_headers_acme,'Acme page'),(auth_headers_globex,'Globex page')]:
            module=client.post('/api/v1/apphub/modules',headers=headers,json={'code':'review','name':name,'app_code':'orders'})
            assert module.status_code==201,module.text
        assert sql.get_module('tenant-acme','review').name=='Acme page'
        assert sql.get_module('tenant-globex','review').name=='Globex page'
        for headers,name in [(auth_headers_acme,'Acme page'),(auth_headers_globex,'Globex page')]:
            page=client.post('/api/v1/apphub/pages',headers=headers,json={'code':'review','name':name,'module_code':'review'})
            assert page.status_code==201,page.text
        assert next(p for p in sql.list_pages('tenant-acme') if p.code=='review').name=='Acme page'
        assert next(p for p in sql.list_pages('tenant-globex') if p.code=='review').name=='Globex page'
    with pytest.raises(ValueError,match='cross-tenant'):
        sql.put_module('tenant-globex',replace(sql.get_module('tenant-acme','review'),tenant_id='tenant-globex',name='stolen'))

@pytest.mark.parametrize('backend',['memory','sql'])
def test_insert_only_page_preserves_saved_definition_on_duplicate(database,backend):
    repo=sql if backend=='sql' else mem
    page=replace(mem.ApphubPage('stable-page','insert','Saved','review','review','grid'),definition={'binding':{'object_type':'chosen'}})
    repo.put_page('insert',page,insert_only=True)
    with pytest.raises(ValueError,match='exists'):
        repo.put_page('insert',replace(page,definition={}),insert_only=True)
    assert next(p for p in repo.list_pages('insert') if p.code=='review').definition==page.definition
    module=mem.ApphubModule('stable-module','insert','Saved','review','orders','','')
    repo.put_module('insert',module,insert_only=True)
    with pytest.raises(ValueError,match='exists'):
        repo.put_module('insert',replace(module,name='overwrite'),insert_only=True)
