"""MP11 strict-new, WIP concurrency, and same-family link continuity regressions."""
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import UTC, datetime
import os
import threading
from urllib.parse import urlparse
from uuid import uuid4
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
import jwt
from mate_platform.auth import install_auth
from mate_kernel.ontology import Cardinality, Directionality, ClassRef, InMemoryOntologyRepository, Individual, LinkInstance, LinkType
from mate_tech_ont.v2_kernel.api import router, ObjectTypeDTO, _dto_to_ot
BASE = '/api/v1/ont/v2'
T = 'tenant-acme'

def definition(name='Original', rid=None):
    rid = rid or f'ont.{T}.obj.crm.test{uuid4().hex}.v1'
    prop = f'ont.{T}.prop.crm.id.v1'
    return dict(rid=rid, display_name=name, primary_key=[prop], properties=[dict(rid=prop, type_id='string', format='string', nullable=False, primary_key=True)], interfaces=[])

@pytest.fixture(params=['memory', 'pg'])
def store(request):
    if request.param == 'memory':
        yield InMemoryOntologyRepository()
        return
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository
    dsn = os.environ.get('MP11_OBJECT_PG_DSN')
    if not dsn:
        pytest.skip('Dedicated MP11_OBJECT_PG_DSN required')
    parsed = urlparse(dsn)
    assert parsed.hostname == '127.0.0.1' and parsed.port == 55497
    assert parsed.path.startswith('/codex_mp11_')
    repo = PgOntologyRepository(dsn=dsn)
    repo._ensure_schema()
    yield repo

@pytest.fixture
def client(store, auth_headers):
    app = FastAPI()
    install_auth(app)
    app.include_router(router)
    app.state.kernel_repo = store
    with TestClient(app, headers=auth_headers, raise_server_exceptions=False) as c:
        yield c

def test_new_refuses_existing_but_default_update_survives(client):
    payload = definition()
    assert client.post(f'{BASE}/object-types', json=payload).status_code == 200
    rejected = client.post(f'{BASE}/object-types?create_only=true', json=payload | {'display_name': 'Overwrite'})
    assert rejected.status_code == 409, rejected.text
    assert client.get(f'{BASE}/object-types/{payload["rid"]}').json()['display_name'] == 'Original'
    assert client.post(f'{BASE}/object-types', json=payload | {'display_name': 'Edited'}).status_code == 200

def test_concurrent_new_has_one_winner(client):
    payload = definition()
    barrier = threading.Barrier(2)
    def create(name):
        barrier.wait()
        return client.post(f'{BASE}/object-types?create_only=true', json=payload | {'display_name': name})
    with ThreadPoolExecutor(2) as pool:
        results = list(pool.map(create, ['First', 'Second']))
    assert sorted(r.status_code for r in results) == [200, 409]
    winner = next(r.json() for r in results if r.status_code == 200)
    assert client.get(f'{BASE}/object-types/{payload["rid"]}').json() == winner

def test_new_wip_restore_competing_create_publish_preserves_winner(client):
    draft = definition('Draft')
    staged = client.post(f'{BASE}/object-types/wip?create_only=true', json={'payload': draft, 'author': 'forged'})
    assert staged.status_code == 200, staged.text
    restored = next(w for w in client.get(f'{BASE}/object-types/wip').json() if w['rid'] == draft['rid'])
    assert restored['author'] == 'u-1'
    assert restored['create_only'] is True
    winner = client.post(f'{BASE}/object-types?create_only=true', json=draft | {'display_name': 'Winner', 'description': 'Retain me'}).json()
    result = client.post(f'{BASE}/object-types/wip/{draft["rid"]}/apply')
    assert result.status_code == 409, result.text
    assert client.get(f'{BASE}/object-types/{draft["rid"]}').json() == winner
    assert any(w['rid'] == draft['rid'] for w in client.get(f'{BASE}/object-types/wip').json())

@pytest.mark.parametrize('operation', ['create', 'save', 'apply', 'discard'])
def test_read_only_cannot_mutate(client, operation, auth_headers):
    payload = definition()
    client.post(f'{BASE}/object-types/wip', json={'payload': payload})
    claims = jwt.decode(auth_headers["Authorization"].split()[1], options={"verify_signature": False})
    claims["scope"] = "platform.read"
    headers = {"Authorization": "Bearer " + jwt.encode(claims, "test-secret", algorithm="HS256")}
    paths = {'create': '/object-types', 'save': '/object-types/wip', 'apply': f'/object-types/wip/{payload["rid"]}/apply', 'discard': f'/object-types/wip/{payload["rid"]}'}
    response = client.request('DELETE' if operation == 'discard' else 'POST', BASE + paths[operation], json=payload if operation == 'create' else {'payload': payload}, headers=headers)
    assert response.status_code == 403, response.text

def test_wip_checksum_is_rechecked_at_write(client, store, monkeypatch):
    payload = definition()
    assert client.post(f'{BASE}/object-types', json=payload).status_code == 200
    assert client.post(f'{BASE}/object-types/wip', json={'payload': payload | {'description': 'Draft edit'}}).status_code == 200
    original = store.upsert_object_type
    entered = False
    def competing_write(ot, **kwargs):
        nonlocal entered
        if not entered:
            entered = True
            original(replace(ot, display_name='Concurrent winner'))
        return original(ot, **kwargs)
    monkeypatch.setattr(store, 'upsert_object_type', competing_write)
    response = client.post(f'{BASE}/object-types/wip/{payload["rid"]}/apply')
    assert response.status_code == 409, response.text
    assert client.get(f'{BASE}/object-types/{payload["rid"]}').json()['display_name'] == 'Concurrent winner'

@pytest.mark.parametrize("endpoint", ["src", "dst"])
def test_pg_version_publication_retains_links_and_supports_new_links(store, endpoint):
    if isinstance(store, InMemoryOntologyRepository):
        pytest.skip('PG supersede publication regression')
    with store.tenant_scope(T):
        customer = _dto_to_ot(ObjectTypeDTO(**definition('Customer')))
        order = _dto_to_ot(ObjectTypeDTO(**definition('Order')))
        store.upsert_object_type(customer)
        store.upsert_object_type(order)
        lt = LinkType(rid=ClassRef(f'ont.{T}.link.orders_{uuid4().hex}.v1'), src=customer.rid, dst=order.rid, cardinality=Cardinality.ONE_TO_MANY, directionality=Directionality.DIRECTED)
        store.upsert_link_type(lt)
        now = datetime.now(UTC)
        objects = []
        for cls in [customer, order, order]:
            iid = f'ont.{T}.ind.test.{uuid4().hex}'
            obj = Individual(rid=iid, class_rid=cls.rid, props=((cls.primary_key[0], iid),), primary_key=iid, tenant_id=T, created_at=now, updated_at=now)
            store.create_individual(obj)
            objects.append(obj)
        def link(index):
            return LinkInstance(rid=f'ont.{T}.lnk.test.{uuid4().hex}', link_type_rid=lt.rid, src=objects[0].rid, dst=objects[index].rid, props=(), created_at=now, tenant_id=T)
        store.create_link_instance(link(1), require_endpoints=True)
        previous = customer if endpoint == 'src' else order
        v2 = replace(previous, rid=ClassRef(previous.rid.rid[:-2] + 'v2'))
        store.upsert_object_type(v2, supersede_rids=(previous.rid.rid,))
        assert store.get_individual(objects[0 if endpoint == 'src' else 1].rid).class_rid == v2.rid
        assert store.search_around(objects[0].rid)[0]['peers'][0]['__rid__'] == objects[1].rid
        assert store.search_around(objects[1].rid)[0]['peers'][0]['__rid__'] == objects[0].rid
        store.create_link_instance(link(2), require_endpoints=True)
        assert getattr(store.get_link_type(lt.rid), endpoint) == v2.rid






def test_wip_discard_is_reachable_and_does_not_delete_live_type(client):
    payload = definition()
    assert client.post(f'{BASE}/object-types', json=payload).status_code == 200
    assert client.post(f'{BASE}/object-types/wip', json={'payload': payload}).status_code == 200
    result = client.delete(f'{BASE}/object-types/wip/{payload["rid"]}')
    assert result.status_code == 200, result.text
    assert result.json()['discarded'] is True
    assert client.get(f'{BASE}/object-types/{payload["rid"]}').status_code == 200
    assert not any(w['rid'] == payload['rid'] for w in client.get(f'{BASE}/object-types/wip').json())


def test_wip_rejects_metadata_change_after_save(client):
    payload = definition()
    client.post(f'{BASE}/object-types', json=payload)
    client.post(f'{BASE}/object-types/wip', json={'payload': payload | {'description': 'draft'}})
    client.post(f'{BASE}/object-types', json=payload | {'description': 'winner'})
    # Re-saving the stale draft cannot implicitly reset its conflict baseline.
    client.post(f'{BASE}/object-types/wip', json={'payload': payload | {'description': 'revised draft'}})
    result = client.post(f'{BASE}/object-types/wip/{payload["rid"]}/apply')
    assert result.status_code == 409, result.text


def test_pg_relation_definition_rechecks_version_after_publish(store, monkeypatch):
    if isinstance(store, InMemoryOntologyRepository):
        pytest.skip('PG schema-lock regression')
    with store.tenant_scope(T):
        old = _dto_to_ot(ObjectTypeDTO(**definition('Old')))
        target = _dto_to_ot(ObjectTypeDTO(**definition('Target')))
        store.upsert_object_type(old); store.upsert_object_type(target)
        v2 = replace(old, rid=ClassRef(old.rid.rid[:-2] + 'v2'))
    original = store._lock_schema_definitions
    started, proceed = threading.Event(), threading.Event()
    def pause(cur, tenant, *, shared):
        if shared and threading.current_thread().name.startswith('ThreadPoolExecutor'):
            started.set(); assert proceed.wait(8)
        return original(cur, tenant, shared=shared)
    monkeypatch.setattr(store, '_lock_schema_definitions', pause)
    def creating():
        with store.tenant_scope(T):
            return store.upsert_link_type(LinkType(rid=ClassRef(f'ont.{T}.link.race{uuid4().hex}.v1'),
                src=old.rid, dst=target.rid, cardinality=Cardinality.ONE_TO_MANY, directionality=Directionality.DIRECTED))
    with ThreadPoolExecutor(1) as pool:
        creating_future = pool.submit(creating)
        try:
            assert started.wait(8)
            with store.tenant_scope(T): store.upsert_object_type(v2, supersede_rids=(old.rid.rid,))
        finally: proceed.set()
        with pytest.raises((ValueError, KeyError), match='archived|active|version'):
            creating_future.result(timeout=8)


@pytest.mark.parametrize('route,method', [('branch','POST'), ('rollback','POST'), ('lifecycle','POST'), ('','DELETE'), ('properties','POST')])
def test_readonly_object_mutation_routes(client, auth_headers, route, method):
    payload = definition()
    assert client.post(f'{BASE}/object-types', json=payload).status_code == 200
    claims = jwt.decode(auth_headers['Authorization'].split()[1], options={'verify_signature':False})
    claims['scope']='platform.read'
    headers={'Authorization':'Bearer '+jwt.encode(claims,'test-secret',algorithm='HS256')}
    data = payload['properties'][0] if route == 'properties' else {'action':'deprecate','new_rid':payload['rid'][:-2]+'v2'}
    result=client.request(method, f'{BASE}/object-types/{payload["rid"]}' + ('/'+route if route else ''), headers=headers,json=data)
    assert result.status_code == 403, result.text


def test_wip_cross_tenant_mutations_denied(client):
    payload=definition(rid='ont.other.obj.crm.customer.v1')
    assert client.post(f'{BASE}/object-types/wip?create_only=true',json={'payload':payload}).status_code == 403
    assert client.post(f'{BASE}/object-types/wip/{payload["rid"]}/apply').status_code == 403
    assert client.delete(f'{BASE}/object-types/wip/{payload["rid"]}').status_code == 403


def test_open_editor_baseline_survives_first_save(client):
    payload=definition()
    baseline=client.post(f'{BASE}/object-types',json=payload).json()['checksum']
    client.post(f'{BASE}/object-types',json=payload|{'description':'winner before save'})
    assert client.post(f'{BASE}/object-types/wip',params={'expected_checksum':baseline},json={'payload':payload}).status_code == 200
    result=client.post(f'{BASE}/object-types/wip/{payload["rid"]}/apply')
    assert result.status_code == 409, result.text



def test_class_inspection_filters_actions_to_verified_tenant(client, store, monkeypatch):
    from mate_kernel.ontology import ActionType
    payload=definition()
    client.post(f'{BASE}/object-types',json=payload)
    def action(tenant):
        return ActionType(rid=ClassRef(f'ont.{tenant}.act.review.v1'),parameters=(),submission_criteria=(),side_effects=(),function_ref=ClassRef(f'ont.{tenant}.fn.review.v1'),on=(ClassRef(payload['rid']),))
    # A repository adapter may return an unfiltered catalog; HTTP still filters exact ownership.
    monkeypatch.setattr(store,'list_action_types',lambda:[action(T),action('other')])
    result=client.get(f'{BASE}/classes/{payload["rid"]}/inspect')
    assert result.status_code == 200, result.text
    assert result.json()['actions'] == [f'ont.{T}.act.review.v1']
    assert client.get(f'{BASE}/classes/ont.other.obj.crm.secret.v1/inspect').status_code == 403


def test_pg_strict_new_survives_legacy_writer_without_advisory_lock(store, monkeypatch):
    if isinstance(store, InMemoryOntologyRepository):
        pytest.skip('SQL conflict race requires PostgreSQL')
    from contextlib import contextmanager
    import json
    import psycopg2
    from mate_kernel.ontology.api import ObjectTypeAlreadyExistsError
    from mate_tech_ont.v2_kernel.pg_repo import _ot_to_row
    payload = definition('Draft')
    winner = _dto_to_ot(ObjectTypeDTO(**(payload | {'display_name': 'Legacy winner'})))
    row = _ot_to_row(winner)
    original = store._cursor
    inserted = False

    class CursorProxy:
        def __init__(self, cursor):
            self.cursor = cursor

        def __getattr__(self, key):
            return getattr(self.cursor, key)

        def execute(self, query, parameters=None):
            nonlocal inserted
            if not inserted and 'INSERT INTO ont_object_type' in query:
                inserted = True
                with psycopg2.connect(os.environ['MP11_OBJECT_PG_DSN']) as connection:
                    with connection.cursor() as cursor:
                        cursor.execute(
                            'INSERT INTO ont_object_type (rid, tenant_id, slug, primary_key, properties, display_name) '
                            'VALUES (%s, %s, %s, %s, %s::jsonb, %s)',
                            (row['rid'], row['tenant_id'], row['slug'], row['primary_key'], json.dumps(row['properties']), row['display_name']),
                        )
            return self.cursor.execute(query, parameters)

    @contextmanager
    def intercept(connection):
        with original(connection) as cursor:
            yield CursorProxy(cursor)

    monkeypatch.setattr(store, '_cursor', intercept)
    with store.tenant_scope(T):
        with pytest.raises(ObjectTypeAlreadyExistsError):
            store.upsert_object_type(_dto_to_ot(ObjectTypeDTO(**payload)), create_only=True)
        assert store.get_object_type(winner.rid).display_name == 'Legacy winner'


def test_explicit_compared_checksum_can_retry_stale_draft(client):
    original = definition()
    assert client.post(f'{BASE}/object-types', json=original).status_code == 200
    draft = original | {'description': 'My retained changes'}
    assert client.post(f'{BASE}/object-types/wip', json={'payload': draft}).status_code == 200
    assert client.post(f'{BASE}/object-types', json=original | {'description': 'Concurrent changes'}).status_code == 200
    assert client.post(f'{BASE}/object-types/wip/{original["rid"]}/apply').status_code == 409
    latest = client.get(f'{BASE}/object-types/{original["rid"]}').json()
    result = client.post(f'{BASE}/object-types/wip/{original["rid"]}/apply', params={'expected_checksum': latest['checksum']})
    assert result.status_code == 200, result.text
    assert result.json()['description'] == 'My retained changes'


def test_pg_edit_set_then_link_and_supersede_do_not_deadlock(store, monkeypatch):
    if isinstance(store, InMemoryOntologyRepository):
        pytest.skip('PG transactional edit-set lock regression')
    from contextlib import contextmanager
    import time
    import psycopg2

    with store.tenant_scope(T):
        source = _dto_to_ot(ObjectTypeDTO(**definition('Edit source')))
        target = _dto_to_ot(ObjectTypeDTO(**definition('Edit target')))
        store.upsert_object_type(source)
        store.upsert_object_type(target)
        relation = LinkType(rid=ClassRef(f'ont.{T}.link.editrace{uuid4().hex}.v1'), src=source.rid, dst=target.rid,
                            cardinality=Cardinality.ONE_TO_MANY, directionality=Directionality.DIRECTED)
        store.upsert_link_type(relation)
        now = datetime.now(UTC)
        individuals = []
        for object_type in [source, target]:
            iid = f'ont.{T}.ind.editrace.{uuid4().hex}'
            individual = Individual(rid=iid, class_rid=object_type.rid, props=((object_type.primary_key[0], iid),),
                                    primary_key=iid, tenant_id=T, created_at=now, updated_at=now)
            store.create_individual(individual)
            individuals.append(individual)
        v2 = replace(source, rid=ClassRef(source.rid.rid[:-2] + 'v2'))

    edit_locked, publish_attempted, resume_edit = threading.Event(), threading.Event(), threading.Event()
    pids = {}
    original_cursor, original_schema_lock = store._cursor, store._lock_schema_definitions

    class CursorProxy:
        def __init__(self, cursor):
            self.cursor = cursor
        def __getattr__(self, key):
            return getattr(self.cursor, key)
        def execute(self, query, parameters=None):
            result = self.cursor.execute(query, parameters)
            if threading.current_thread().name == 'mp11-edit-race' and 'SELECT props FROM ont_individual' in query and 'FOR UPDATE' in query:
                pids['edit'] = self.cursor.connection.get_backend_pid()
                edit_locked.set()
                assert resume_edit.wait(12), 'Publisher never reached its blocked transaction'
            return result

    @contextmanager
    def intercept(connection):
        with original_cursor(connection) as cursor:
            cursor.execute("SET LOCAL statement_timeout = '12s'")
            yield CursorProxy(cursor)

    def record_publish(cursor, tenant, *, shared):
        if threading.current_thread().name == 'mp11-publish-race' and not shared:
            pids['publish'] = cursor.connection.get_backend_pid()
            publish_attempted.set()
        return original_schema_lock(cursor, tenant, shared=shared)

    monkeypatch.setattr(store, '_cursor', intercept)
    monkeypatch.setattr(store, '_lock_schema_definitions', record_publish)

    def edit():
        threading.current_thread().name = 'mp11-edit-race'
        with store.tenant_scope(T):
            return store.apply_edit_set_now(f'ont.{T}.act.editrace.v1', individuals[0].rid, {}, [
                {'op':'set_property','target':individuals[0].rid,'property_rid':source.primary_key[0].rid,'value':'edited'},
                {'op':'add_link','link_type_rid':relation.rid.rid,'src':individuals[0].rid,'dst':individuals[1].rid},
            ], actor='verified-test-actor')

    def publish():
        threading.current_thread().name = 'mp11-publish-race'
        with store.tenant_scope(T):
            return store.upsert_object_type(v2, supersede_rids=(source.rid.rid,))

    with ThreadPoolExecutor(2) as pool:
        editing = pool.submit(edit)
        try:
            assert edit_locked.wait(8), 'Edit-set did not acquire the individual row lock'
            publishing = pool.submit(publish)
            assert publish_attempted.wait(8)
            # Observe a real database wait, not a sleep-based assumption. Before the
            # fix publisher waits for the row; after it waits for shared schema lock.
            with psycopg2.connect(os.environ['MP11_OBJECT_PG_DSN']) as observer:
                observer.autocommit = True
                with observer.cursor() as cursor:
                    deadline = time.monotonic() + 8
                    while time.monotonic() < deadline:
                        cursor.execute('SELECT pg_blocking_pids(%s)', (pids['publish'],))
                        if pids['edit'] in cursor.fetchone()[0]:
                            break
                        time.sleep(0.02)
                    else:
                        pytest.fail('Publisher was not blocked by the edit-set transaction')
        finally:
            resume_edit.set()
        assert editing.result(timeout=15)['applied_count'] == 2
        publishing.result(timeout=15)
    with store.tenant_scope(T):
        assert store.get_individual(individuals[0].rid).class_rid == v2.rid
        assert store.get_individual(individuals[0].rid).get(source.primary_key[0]) == 'edited'
        assert store.get_link_type(relation.rid).src == v2.rid
        assert store.search_around(individuals[0].rid)[0]['peers'][0]['__rid__'] == individuals[1].rid
