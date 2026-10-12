"""Actual signed candidate checks. No token/password/DSN enters the receipt."""
from __future__ import annotations
import asyncio,json,os,sys,time,uuid
from pathlib import Path
import httpx
import manage
if hasattr(sys.stdout,'reconfigure'):sys.stdout.reconfigure(encoding='utf-8')

OUT=manage.ROOT/'docs/active/delivery/evidence/mp11-candidate'
class PrivateInputs:
    def __init__(self):self._data=json.loads((manage.PRIVATE/'credentials.json').read_text())
    def __repr__(self):return '<ProtectedCandidateInputs>'
    def get(self,name):return self._data[name]

class Session:
    def __init__(self,name,token):self.name=name;self._token=token
    def __repr__(self):return '<SignedCandidateSession '+self.name+'>'
    @property
    def headers(self):return {'Authorization':'Bearer '+self._token}

class Acceptance:
    def __repr__(self):return '<CandidateAcceptance>'
    def __init__(self):
        os.environ.update(manage.environment())
        for path in os.environ['PYTHONPATH'].split(os.pathsep):sys.path.insert(0,path)
        self.client=httpx.Client(base_url='http://127.0.0.1:55522/api/v1',timeout=30,trust_env=False)
        self.inputs=PrivateInputs();self.sessions={}
        self.evidence=json.loads((OUT/'acceptance.json').read_text()) if (OUT/'acceptance.json').exists() else {'tested_head':manage.command(['git','rev-parse','HEAD']), 'identity':'normal signed Keycloak; bypass flags false','checks':{},'complete':False}
    def request(self,method,path,actor='writer',expected=200,**kwargs):
        headers={**self.sessions[actor].headers,**kwargs.pop('headers',{})}
        r=self.client.request(method,path,headers=headers,**kwargs)
        if r.status_code!=expected:raise RuntimeError(f'{method} {path.split("?")[0]} expected{expected} actual{r.status_code}')
        return None if not r.content else r.json()
    def login(self):
        self.sessions={}
        for name in ('writer','readonly','neighbor'):
            r=httpx.post('http://127.0.0.1:55523/api/v1/iam/auth/login',json={'username':name,'password':self.inputs.get(name+'_password')},trust_env=False,timeout=20)
            if r.status_code!=200:raise RuntimeError('signed login '+name+' HTTP'+str(r.status_code))
            self.sessions[name]=Session(name,r.json()['accessToken'])
        r=httpx.post('http://127.0.0.1:55520/realms/codex-mp11/protocol/openid-connect/token',data={'grant_type':'client_credentials','client_id':'mp11-service','client_secret':self.inputs.get('service_secret')},trust_env=False,timeout=20)
        if r.status_code!=200:raise RuntimeError('client credentials grant failed')
        self.sessions['service']=Session('service',r.json()['access_token'])
        from mate_platform.auth.config import load_auth_config
        from mate_platform.auth.verifier import TokenVerifier
        from mate_platform.auth.middleware import _looks_like_service
        verifier=TokenVerifier(load_auth_config())
        grants={}
        for name,session in self.sessions.items():
            claims=verifier.verify(session._token)
            expected_tenant='mp11-neighbor' if name=='neighbor' else 'mp11-candidate'
            assert claims.tenant_id==expected_tenant
            assert _looks_like_service(claims)==(name=='service')
            expected={'platform.read','ont.read'}|({'platform.write','ont.write'} if name!='readonly' else set())
            assert expected<=claims.scopes
            if name=='readonly':assert not {'platform.write','ont.write'} & claims.scopes
            grants[name]={'tenant':claims.tenant_id,'human':not _looks_like_service(claims),'scope':sorted(claims.scopes),'session_present':bool(claims.session_id)}
        self.evidence['checks']['signed_grants']=grants
    async def effective_clients(self):
        """Inspect actual factory clients; observer delegates unchanged real HTTP."""
        from starlette.requests import Request
        from starlette.responses import Response
        from mate_platform.auth.middleware import AuthMiddleware
        from mate_platform.auth.config import load_auth_config
        from mate_platform.auth.verifier import TokenVerifier
        from mate_app_hub.runtime.binding import ontology_client,ontology_request
        from mate_tech_ont.v2_kernel.api import _validated_app_provenance
        from mate_tech_mcp.tools.ontology_proxy import build_ontology_proxy_tools
        from unittest.mock import patch
        request=Request({'type':'http','method':'GET','path':'/candidate-probe','headers':[(b'authorization',self.sessions['writer'].headers['Authorization'].encode())]})
        cfg=load_auth_config()
        middleware=AuthMiddleware(lambda *args:None,config=cfg,verifier=TokenVerifier(cfg))
        async def checked(req):return Response(status_code=204)
        response=await middleware.dispatch(request,checked)
        if response.status_code!=204:raise RuntimeError('normal request context verification failed')
        targets={}
        async with ontology_client(request) as client:
            targets['apphub_to_ontology']=str(client.base_url).rstrip('/')
            await ontology_request(client,'GET','/object-types')
        tools=build_ontology_proxy_tools()
        try:
            targets['mcp_to_ontology']=sorted({str(t._client.base_url).rstrip('/') for t in tools})
        finally:
            for tool in tools:await tool._client.aclose()
        state=json.loads((manage.PRIVATE/'business-state.json').read_text())
        app=self.request('GET','/apphub/apps/'+state['app_id'])
        version=app.get('published_version_id') or app.get('app',{}).get('published_version_id')
        provenance={'app_id':state['app_id'],'page_id':state['page_id'],'app_version_id':version}
        actual_client=httpx.AsyncClient
        class ObservedClient(actual_client):
            def __init__(client,*args,**kwargs):
                super().__init__(*args,**kwargs)
                targets['ontology_to_apphub']=str(client.base_url).rstrip('/')
                if targets['ontology_to_apphub']!='http://127.0.0.1:55522':raise RuntimeError('unsafe actual AppHub client')
        with patch('mate_tech_ont.v2_kernel.api.httpx.AsyncClient',ObservedClient):
            await _validated_app_provenance(request,'ont.mp11-candidate.act.review','ont.mp11-candidate.ind.order.1',{},provenance)
        if targets['apphub_to_ontology']!='http://127.0.0.1:55522' or targets['mcp_to_ontology']!=['http://127.0.0.1:55522']:raise RuntimeError('unsafe effective dependency target')
        self.evidence['checks']['effective_client_targets']={'targets':targets,'method':'normal installed middleware verified real Keycloak request; real factory clients and unchanged real HTTP, constructor observer records only base URL'}

    def key_permissions(self):
        for name in ('writer','readonly'):
            result=self.request('POST','/mcp/api-keys',actor=name,expected=201,json={'name':'candidate-'+name,'scopes':['platform.read','ont.read']})
            self.sessions[name+'_key']=Session(name+'_key',result['key'])
            self.evidence[name+'_key_id']=result['id']
        for name in ('readonly','service','writer_key'):
            self.request('POST','/mcp/api-keys',actor=name,expected=403,json={'name':'forbidden-grant','scopes':['platform.read','platform.write','ont.read','ont.write']})
        self.request('GET','/ont/v2/object-types',actor='writer',expected=403,headers={'X-Tenant-ID':'mp11-neighbor'})
        self.evidence['checks']['key_issuance']='actual signed USER read keys; readonly overgrant/service/API_KEY creator denied'
    def source_chain(self):
        import psycopg2
        from psycopg2.extensions import parse_dsn
        tenant='mp11-candidate';self.tenant=tenant
        self.types={name:f'ont.{tenant}.obj.{name}' for name in ('customer','order')}
        self.prop=lambda name:f'ont.{tenant}.prop.{name}'
        dsn=manage.pg_dsn(manage.active_database())
        with psycopg2.connect(dsn) as conn,conn.cursor() as cur:
            cur.execute('CREATE SCHEMA IF NOT EXISTS mp11_ui_source')
            cur.execute('CREATE TABLE IF NOT EXISTS mp11_ui_source.customers(id integer PRIMARY KEY,name text NOT NULL,modified_at timestamptz NOT NULL)')
            cur.execute('CREATE TABLE IF NOT EXISTS mp11_ui_source.orders(id integer PRIMARY KEY,total integer NOT NULL,status text NOT NULL,modified_at timestamptz NOT NULL)')
            cur.execute("INSERT INTO mp11_ui_source.customers VALUES(1,'Candidate Customer','2026-10-01T00:00:00Z') ON CONFLICT DO NOTHING")
            cur.execute("INSERT INTO mp11_ui_source.orders VALUES(1,10,'pending','2026-10-01T00:00:00Z'),(2,20,'pending','2026-10-01T00:00:00Z') ON CONFLICT DO NOTHING")
        cfg=parse_dsn(dsn)
        config={'host':cfg['host'],'port':int(cfg['port']),'database':cfg['dbname'],'username':cfg['user'],'password':cfg['password'],'schema':'mp11_ui_source'}
        sources=self.request('GET','/data/sources')['items']
        source=next((x for x in sources if x['name']=='MP11 Verified PostgreSQL'),None)
        if source is None:source=self.request('POST','/data/sources',json={'name':'MP11 Verified PostgreSQL','type':'postgres','connection_config':config})
        self.source=source['id']
        discovered=self.request('GET','/data/sources/'+self.source+'/schema')
        assert len(discovered['tables'])==2
        assert 'password' not in source.get('connection_config',{})
        proof=[];self.evidence['mappings']=[];self.evidence['runs']=[]
        for name in ('customer','order'):
            table=next(x for x in discovered['tables'] if x['name']==name+'s')
            columns=[x for x in table['columns'] if x['name']!='modified_at']
            props=[{'rid':self.prop(x['name']),'type_id':'integer' if x['type']=='integer' else 'string','format':'integer' if x['type']=='integer' else 'string','nullable':x['nullable'],'primary_key':x['primary_key'],'title':x['name']} for x in columns]
            body={'rid':self.types[name],'primary_key':[p['rid'] for p in props if p['primary_key']],'properties':props,'display_name':name.title()}
            existing=self.request('GET','/ont/v2/object-types')
            if not any(x['rid']==body['rid'] for x in existing):
                self.request('POST','/ont/v2/object-types/wip?create_only=true',json={'payload':body,'author':'forged-client'})
                self.request('GET','/ont/v2/object-types/'+body['rid'],expected=404)
                restored=self.request('GET','/ont/v2/object-types/wip')
                draft=next(x for x in restored if x['rid']==body['rid'])
                assert draft['author']!='forged-client' and draft['create_only']
                self.request('POST','/ont/v2/object-types/wip/'+body['rid']+'/apply')
            mapping={'class_rid':body['rid'],'name':'Candidate '+name,'kind':'pg_table','source_id':self.source,'table':'mp11_ui_source.'+name+'s','pk_column':'id','ts_column':'modified_at','field_mapping':{p['rid']:p['title'] for p in props}}
            result=self.request('POST','/ont/v2/object-types/'+body['rid']+'/datasources',json=mapping)
            synced=self.request('POST','/ont/v2/object-types/'+body['rid']+'/datasources/sync',json={})
            assert synced['ok'] and synced['status']=='succeeded' and synced['run_id']
            self.evidence['mappings'].append({'rid':result['rid']});self.evidence['runs'].append({'run_id':synced['run_id']})
            proof.append({'object':body['rid'],'columns':[x['name'] for x in columns],'run_id':synced['run_id'],'synced':synced['total_synced']})
        self.evidence['checks']['discovery_draft_publish_sync']=proof
        self.evidence['source_id']=self.source

    def mapping_negatives(self):
        import copy
        rid='ont.mp11-candidate.obj.order'
        base={'class_rid':rid,'name':'Rejected candidate mapping','kind':'pg_table','source_id':self.evidence['source_id'],'table':'mp11_ui_source.orders','pk_column':'id','ts_column':'modified_at','field_mapping':{f'ont.mp11-candidate.prop.{k}':k for k in ('id','total','status')}}
        cases={}
        for label in ('missing-primary-key','invalid-time-type','wrong-column-type','missing-non-null'):
            body=copy.deepcopy(base)
            if label=='missing-primary-key':body['pk_column']='absent'
            elif label=='invalid-time-type':body['ts_column']='id'
            elif label=='wrong-column-type':body['field_mapping']['ont.mp11-candidate.prop.total']='status'
            else:body['field_mapping'].pop('ont.mp11-candidate.prop.status')
            self.request('POST','/ont/v2/object-types/'+rid+'/datasources',expected=422,json=body)
            cases[label]=422
        self.evidence['checks']['actual_discovered_mapping_negatives']=cases

    def application_chain(self):
        self.link=f'ont.{self.tenant}.link.customer_orders'; self.action=f'ont.{self.tenant}.act.review'
        self.request('POST','/ont/v2/link-types',json={'rid':self.link,'src':self.types['customer'],'dst':self.types['order'],'cardinality':'1:N','directionality':'directed'})
        link={'rid':f'ont.{self.tenant}.lnk.customer_orders.1','link_type_rid':self.link,'src':f'ont.{self.tenant}.ind.customer.1','dst':f'ont.{self.tenant}.ind.order.1','props':{}}
        if not any(x['rid']==link['rid'] for x in self.request('GET','/ont/v2/link-instances')):self.request('POST','/ont/v2/link-instances',json=link)
        self.request('POST','/ont/v2/action-types',json={'rid':self.action,'on':[self.types['order']],'declarative_edits':[{'op':'set_property','target':'$target','property_rid':self.prop('status'),'value':'approved'}]})
        order=self.request('GET','/ont/v2/object-types/'+self.types['order']);customer=self.request('GET','/ont/v2/object-types/'+self.types['customer'])
        if not any(g['code']=='business' for g in self.request('GET','/apphub/apps/groups')['items']):self.request('POST','/apphub/groups',expected=201,json={'name':'Business','code':'business'})
        code='candidate-'+uuid.uuid4().hex[:8]
        app=self.request('POST','/apphub/apps',expected=201,json={'name':'MP11 Candidate Order Review','code':code,'category':'business','description':'Verified source to human receipt','owner':'writer'})
        self.app_id=app['id'];self.evidence['app']={'id':app['id']}
        self.request('POST','/apphub/modules',expected=201,json={'name':'Order review','code':code,'app_code':code,'description':'','entry_path':''})
        page=self.request('POST','/apphub/pages',expected=201,json={'name':'Order review','code':code,'module_code':code,'layout':'grid'})
        self.page_id=page['id']
        config={'name':'Order review','layout':'grid','widgets':[],'binding':{'object_type':self.types['order'],'model_checksum':order['checksum'],'customer_type':self.types['customer'],'customer_checksum':customer['checksum'],'fields':[self.prop(x) for x in ('id','total','status')],'link_type':self.link,'action_rid':self.action,'object_set':{'filter_expr':'','paging_limit':100}}}
        self.request('GET','/apphub/apps/'+app['id']+'/runtime',expected=409)
        preview=self.request('POST','/apphub/pages/'+page['id']+'/preview',json=config)
        assert len(preview['orders'])>=2 and len(preview['customers'])==1 and len(preview['links'])==1
        self.request('PUT','/apphub/pages/'+page['id'],json=config)
        published=self.request('POST','/apphub/apps/'+app['id']+'/publish')
        short=self.request('POST','/apphub/shortlinks',expected=201,json={'app_id':app['id']})
        usage=self.request('GET','/apphub/bindings/usage',params={'class_rid':self.types['order']})
        assert any(x['app_id']==app['id'] and x['status']=='PUBLISHED' for x in usage['items'])
        for actor in ('readonly','service'):
            self.request('POST','/ont/v2/object-types/wip',actor=actor,expected=403 if actor=='readonly' else 200,json={'payload':order}) if actor=='readonly' else None
        for path in ('/apphub/apps/'+app['id'],'/apphub/shortlinks/'+short['code']):self.request('GET',path,actor='neighbor',expected=404)
        proposed=self.request('POST','/apphub/apps/'+app['id']+'/runtime/execute',json={'action_type':'ontology_propose','page_id':page['id'],'payload':{'target_iid':f'ont.{self.tenant}.ind.order.1','parameters':{}}})
        pid=proposed['data']['proposal_id'];self.proposal_id=pid
        for actor in ('readonly','service','writer_key'):
            self.request('POST','/ont/v2/proposals/'+pid+'/confirm',actor=actor,expected=403,json={})
            self.request('POST','/ont/v2/proposals/'+pid+'/execute',actor=actor,expected=403,headers={'Idempotency-Key':'denied-'+pid},json={})
        confirmed=self.request('POST','/ont/v2/proposals/'+pid+'/confirm',headers={'Idempotency-Key':'confirm-'+pid},json={'confirmed_by':'forged-client','approval_expires_at':'2999-01-01T00:00:00Z'})
        assert confirmed['confirmed_by']!='forged-client' and confirmed['approval_expires_at'] and not confirmed['approval_expires_at'].startswith('2999')
        self.execute_key='candidate-'+pid
        receipt=self.request('POST','/ont/v2/proposals/'+pid+'/execute',headers={'Idempotency-Key':self.execute_key},json={})
        repeated=self.request('POST','/ont/v2/proposals/'+pid+'/execute',headers={'Idempotency-Key':self.execute_key},json={})
        assert receipt==repeated
        record=self.request('GET',f'/ont/v2/individuals/ont.{self.tenant}.ind.order.1')
        assert record['props'][self.prop('status')]=='approved'
        self.evidence['checks']['published_app_human_receipt']={'app_id':app['id'],'page_id':page['id'],'short_code':short['code'],'proposal_id':pid,'receipt':receipt,'approval_expires_at':confirmed['approval_expires_at'],'confirmed_by':confirmed['confirmed_by'],'version':published,'same_key_replay_equal':True}
        manage.save(manage.PRIVATE/'business-state.json',{'app_id':app['id'],'page_id':page['id'],'short_code':short['code'],'proposal_id':pid,'execute_key':self.execute_key,'receipt':receipt})

    async def protocol_checks(self):
        from mcp.client.session import ClientSession
        from mcp.client.streamable_http import streamable_http_client
        proofs={}
        for actor in ('writer','readonly','writer_key'):
            async with httpx.AsyncClient(headers=self.sessions[actor].headers,trust_env=False) as client:
                async with streamable_http_client('http://127.0.0.1:55522/api/v1/mcp/protocol/mcp',http_client=client) as (read,write,_),ClientSession(read,write) as session:
                    await session.initialize()
                    names={x.name for x in (await session.list_tools()).tools}
                    assert 'ont_object_query' in names and 'ont_confirm_proposal' not in names and 'ont_execute_proposal' not in names
                    if actor!='writer':assert 'ont_propose_model_type' not in names
                    query=await session.call_tool('ont_object_query',{'source':self.types['order']})
                    assert not query.isError
                    result=query.structuredContent
                    if not result:result=json.loads(query.content[0].text)
                    assert len(result['rows'])>=2
                    denied=await session.call_tool('ont_confirm_proposal',{'proposal_id':self.proposal_id})
                    assert denied.isError
                    proofs[actor]={'initialize':True,'tools':sorted(names),'query_rows':len(result['rows']),'human_tool_denied':True}
        self.request('DELETE','/mcp/api-keys/'+self.evidence['writer_key_id'],expected=200)
        self.request('GET','/mcp/api-keys',actor='writer_key',expected=401)
        self.evidence['checks']['actual_protocol']=proofs

    def prepare_browser(self):
        import secrets
        # Fresh consumed fixtures are additive. Preserve prior private inputs and
        # their retained issuer accounts/data, including the pre-run legacy set.
        manage.inspect_dependency('keycloak')
        history=manage.PRIVATE/'browser-runs'
        history.mkdir(exist_ok=True)
        previous=history/('retained-'+uuid.uuid4().hex)
        previous.mkdir()
        for name in ('browser-accounts.json','ui-session.json'):
            path=manage.PRIVATE/name
            if path.exists():(previous/name).write_bytes(path.read_bytes())
        run=uuid.uuid4().hex[:12]
        run_dir=history/run
        run_dir.mkdir()
        # Only the owned issuer is mutated; no provider values enter diagnostics.
        admin=httpx.post('http://127.0.0.1:55520/realms/master/protocol/openid-connect/token',data={'grant_type':'password','client_id':'admin-cli','username':'mp11-admin','password':self.inputs.get('admin_password')},trust_env=False,timeout=20)
        if admin.status_code!=200:raise RuntimeError('owned issuer administration unavailable')
        ah={'Authorization':'Bearer '+admin.json()['access_token']}
        endpoint='http://127.0.0.1:55520/admin/realms/codex-mp11'
        profile=httpx.get(endpoint+'/users/profile',headers=ah,trust_env=False)
        if profile.status_code!=200:raise RuntimeError('owned user profile unavailable')
        profile_data=profile.json()
        if not any(x['name']=='tenant_id' for x in profile_data['attributes']):
            profile_data['attributes'].append({'name':'tenant_id','displayName':'Tenant','permissions':{'view':['admin','user'],'edit':['admin']},'multivalued':False})
            updated=httpx.put(endpoint+'/users/profile',headers=ah,json=profile_data,trust_env=False)
            if updated.status_code not in (200,204):raise RuntimeError('owned tenant attribute configuration failed')
        realm_response=httpx.get(endpoint,headers=ah,trust_env=False)
        realm_config=realm_response.json();realm_config['accessTokenLifespan']=3600
        changed=httpx.put(endpoint,headers=ah,json=realm_config,trust_env=False)
        if changed.status_code!=204:raise RuntimeError('owned issuer lifetime config failed')
        self.login()
        relation_tenant='mp11-rel-'+run
        issued={};accounts={}
        for name,tenant,role in [('rel-'+run,relation_tenant,'writer'),('rel-read-'+run,relation_tenant,'reader'),('empty-'+run,'mp11-empty-'+run,'writer')]:
            password=secrets.token_urlsafe(36)
            accounts[name]={'password':password,'tenant':tenant,'role':role}
            manage.save(manage.PRIVATE/'browser-accounts.json',accounts)
            manage.save(run_dir/'browser-accounts.json',accounts)
            response=httpx.post(endpoint+'/users',headers=ah,json={'username':name,'enabled':True,'emailVerified':True,'firstName':name,'lastName':'Candidate','email':name+'@example.invalid','attributes':{'tenant_id':[tenant]},'credentials':[{'type':'password','value':password,'temporary':False}]},trust_env=False)
            if response.status_code!=201:raise RuntimeError('owned browser identity create failed')
            user_id=response.headers['location'].rsplit('/',1)[-1]
            rr=httpx.get(endpoint+'/roles/'+role,headers=ah,trust_env=False)
            if rr.status_code!=200:raise RuntimeError('owned issuer role unavailable')
            mapped=httpx.post(endpoint+'/users/'+user_id+'/role-mappings/realm',headers=ah,json=[rr.json()],trust_env=False)
            if mapped.status_code!=204:raise RuntimeError('owned issuer role map failed')
            login=httpx.post('http://127.0.0.1:55523/api/v1/iam/auth/login',json={'username':name,'password':password},trust_env=False)
            if login.status_code!=200:raise RuntimeError('browser fixture signed login failed HTTP'+str(login.status_code)+' category='+str(login.json().get('detail',''))[:120])
            issued[role if name.startswith('rel-') else 'empty']={'token':login.json()['accessToken'],'tenant':tenant,'subject':login.json()['userId']}
        actor='relationship';self.sessions[actor]=Session(actor,issued['writer']['token'])
        pref='ont.'+relation_tenant
        def obj(name):return pref+'.obj.'+name
        def prop(name):return pref+'.prop.'+name
        for index in range(104):
            name='customer' if index==0 else 'order' if index==1 else f'type{index:03}'
            self.request('POST','/ont/v2/object-types',actor=actor,json={'rid':obj(name),'display_name':name,'primary_key':[prop('id')],'properties':[{'rid':prop('id'),'type_id':'string','format':'string','primary_key':True,'nullable':False,'title':'id'}]})
        paged=pref+'.link.paged_relationship'
        self.request('POST','/ont/v2/link-types',actor=actor,json={'rid':paged,'src':obj('customer'),'dst':obj('order'),'cardinality':'1:N','directionality':'directed'})
        for index in range(1,202):
            for kind,letter in [('customer','c'),('order','o')]:
                self.request('POST','/ont/v2/individuals',actor=actor,json={'rid':pref+f'.ind.{letter}{index:03}','class_rid':obj(kind),'primary_key':f'{letter.upper()}{index:03}','props':{prop('id'):{'type':'string','value':f'{letter.upper()}{index:03}'}}})
            self.request('POST','/ont/v2/link-instances',actor=actor,json={'rid':pref+f'.lnk.paged.{index:03}','link_type_rid':paged,'src':pref+'.ind.c001','dst':pref+f'.ind.o{index:03}','props':{}})
        relation={**issued['writer'],'readToken':issued['reader']['token'],'customer':obj('customer'),'order':obj('order'),'lateSource':obj('type103')}
        from mate_platform.auth.config import load_auth_config
        from mate_platform.auth.verifier import TokenVerifier
        subject=TokenVerifier(load_auth_config()).verify(self.sessions['writer']._token).sub
        # Credential-bearing browser inputs remain ACL-protected and ignored.
        session={'run_id':run,'writer':{'token':self.sessions['writer']._token,'tenant':'mp11-candidate','subject':subject},'relation':relation,'empty':issued['empty'],'api':'http://127.0.0.1:55522/api/v1'}
        manage.save(manage.PRIVATE/'ui-session.json',session)
        manage.save(run_dir/'ui-session.json',session)
        fixture={'run_id':run,'relationship_tenant':relation_tenant,'empty_tenant':issued['empty']['tenant'],'object_types':104,'customers':201,'orders':201,'paged_links':201,'signed_grants':True,'prior_inputs_retained':True}
        self.evidence['checks']['browser_fixtures']=fixture
        manage.save(OUT/('browser-fixtures-'+run+'.json'),fixture)

    def refresh_browser(self):
        path=manage.PRIVATE/'ui-session.json';sessions=json.loads(path.read_text())
        accounts=json.loads((manage.PRIVATE/'browser-accounts.json').read_text())
        from mate_platform.auth.config import load_auth_config
        from mate_platform.auth.verifier import TokenVerifier
        verifier=TokenVerifier(load_auth_config())
        self.login();sessions['writer']['token']=self.sessions['writer']._token
        for username,account in accounts.items():
            response=httpx.post('http://127.0.0.1:55523/api/v1/iam/auth/login',json={'username':username,'password':account['password']},trust_env=False)
            if response.status_code!=200:raise RuntimeError('browser session refresh failed')
            token=response.json()['accessToken'];claims=verifier.verify(token)
            if claims.expires_at-time.time()<1800:raise RuntimeError('browser session lifetime insufficient')
            if username.startswith('empty-'):sessions['empty']['token']=token
            else:
                if claims.tenant_id!=sessions['relation']['tenant']:raise RuntimeError('browser session tenant mismatch')
                sessions['relation']['readToken' if account['role']=='reader' else 'token']=token
        manage.save(path,sessions)

    def websocket_check(self):
        from websockets.sync.client import connect
        from websockets.exceptions import InvalidStatus
        url='ws://127.0.0.1:55522/api/v1/ont/v2/ws/object-changes'
        for headers in ({},{**self.sessions['writer'].headers,'X-Tenant-Id':'mp11-neighbor'}):
            try:
                with connect(url,additional_headers=headers,open_timeout=5):raise RuntimeError('unbound WS accepted')
            except InvalidStatus as exc:
                assert exc.response.status_code==403
        with connect(url,additional_headers=self.sessions['writer'].headers,open_timeout=5) as ws:
            assert json.loads(ws.recv(timeout=5))['type']=='subscribed'
            received=[]
            while True:
                try:received.append(json.loads(ws.recv(timeout=2.7)))
                except TimeoutError:break
            assert received
            # Start after the next polling batch so notification wakeup is measured.
            target='ont.mp11-candidate.ind.order.ws-'+uuid.uuid4().hex[:8]
            self.request('POST','/ont/v2/individuals',json={'rid':target,'class_rid':'ont.mp11-candidate.obj.order','primary_key':target.rsplit('.',1)[-1],'props':{'ont.mp11-candidate.prop.id':{'type':'integer','value':int(time.time())},'ont.mp11-candidate.prop.total':{'type':'integer','value':1},'ont.mp11-candidate.prop.status':{'type':'string','value':'pending'}}})
            proposed=self.request('POST','/ont/v2/action-types/ont.mp11-candidate.act.review/propose',json={'target_iid':target,'parameters':{}})
            pid=proposed['proposal_id']
            self.request('POST','/ont/v2/proposals/'+pid+'/confirm',headers={'Idempotency-Key':'ws-confirm-'+pid},json={})
            begin=time.monotonic()
            receipt=self.request('POST','/ont/v2/proposals/'+pid+'/execute',headers={'Idempotency-Key':'ws-execute-'+pid},json={})
            import psycopg2
            with psycopg2.connect(manage.pg_dsn(manage.active_database())) as conn,conn.cursor() as cur:
                cur.execute('SELECT event_id FROM ont_outbox_event WHERE tenant_id=%s AND proposal_id=%s',('mp11-candidate',pid))
                wanted={row[0] for row in cur.fetchall()}
            actual_ids=sorted(wanted)
            if not wanted:raise RuntimeError('WS proof requires a real changed-object event')
            while wanted:
                event=json.loads(ws.recv(timeout=4));wanted.discard(event.get('event_id'))
            elapsed=time.monotonic()-begin
            self.evidence['checks']['ws_notification']={'signed_header_auth':True,'anonymous_denied':True,'tenant_mismatch_denied':True,'latency_seconds':round(elapsed,3),'actual_event_ids':actual_ids}
            self.persist()
            if elapsed>1.2:raise RuntimeError('actual WS notification missed fast path; polling latency '+str(round(elapsed,3)))

    def consumer_recovery(self):
        import psycopg2
        from websockets.sync.client import connect
        endpoint='ws://127.0.0.1:55522/api/v1/ont/v2/ws/object-changes'
        database=manage.DB;dsn=manage.pg_dsn(database)
        if manage.active_database()!=database:raise RuntimeError('consumer fault requires exact main candidate database')
        terminated=[]
        try:
            with connect(endpoint,additional_headers=self.sessions['writer'].headers) as writer,connect(endpoint,additional_headers=self.sessions['neighbor'].headers) as neighbor:
                assert json.loads(writer.recv(timeout=5))['type']=='subscribed'
                assert json.loads(neighbor.recv(timeout=5))['type']=='subscribed'
                for socket in (writer,neighbor):
                    while True:
                        try:socket.recv(timeout=1.5)
                        except TimeoutError:break
                with psycopg2.connect(dsn) as conn,conn.cursor() as cur:
                    cur.execute("SELECT pid,backend_start,datname FROM pg_stat_activity WHERE datname=%s AND query=%s",(database,'LISTEN ont_changes'))
                    records=cur.fetchall()
                    if not records:raise RuntimeError('no exact owned LISTEN consumer found')
                    for pid,started,datname in records:
                        cur.execute('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid=%s AND backend_start=%s AND datname=%s AND query=%s',(pid,started,datname,'LISTEN ont_changes'))
                        result=cur.fetchone()
                        if result!=(True,):raise RuntimeError('consumer identity changed before termination')
                        terminated.append({'pid':pid,'backend_start':started.isoformat(),'database':datname,'query':'LISTEN ont_changes'})
                target='ont.mp11-candidate.ind.order.consumer-'+uuid.uuid4().hex[:8]
                self.request('POST','/ont/v2/individuals',json={'rid':target,'class_rid':'ont.mp11-candidate.obj.order','primary_key':target.rsplit('.',1)[-1],'props':{'ont.mp11-candidate.prop.id':{'type':'integer','value':int(time.time())},'ont.mp11-candidate.prop.total':{'type':'integer','value':1},'ont.mp11-candidate.prop.status':{'type':'string','value':'pending'}}})
                proposed=self.request('POST','/ont/v2/action-types/ont.mp11-candidate.act.review/propose',json={'target_iid':target,'parameters':{}});pid=proposed['proposal_id']
                self.request('POST','/ont/v2/proposals/'+pid+'/confirm',headers={'Idempotency-Key':'consumer-confirm-'+pid},json={})
                begin=time.monotonic();self.request('POST','/ont/v2/proposals/'+pid+'/execute',headers={'Idempotency-Key':'consumer-execute-'+pid},json={})
                with psycopg2.connect(dsn) as conn,conn.cursor() as cur:
                    cur.execute('SELECT event_id FROM ont_outbox_event WHERE tenant_id=%s AND proposal_id=%s',('mp11-candidate',pid));wanted={row[0] for row in cur.fetchall()}
                assert wanted;ids=sorted(wanted)
                while wanted:
                    event=json.loads(writer.recv(timeout=5));wanted.discard(event.get('event_id'))
                elapsed=time.monotonic()-begin;assert elapsed<4
                neighbor_ids=[]
                while True:
                    try:neighbor_ids.append(json.loads(neighbor.recv(timeout=1.5)).get('event_id'))
                    except TimeoutError:break
                assert not set(ids)&set(neighbor_ids)
                self.evidence['checks']['consumer_polling_recovery']={'terminated_exact_listeners':terminated,'actual_event_ids':ids,'latency_seconds':round(elapsed,3),'neighbor_has_no_writer_event':True,'recovery':'bounded durable outbox polling; explicit API restart required to restore LISTEN'}
        finally:
            if terminated:
                manage.stop('api');manage.start('api')
        self.login();self.websocket_check()
        business=json.loads((manage.PRIVATE/'business-state.json').read_text())
        receipt=self.request('POST','/ont/v2/proposals/'+business['proposal_id']+'/execute',headers={'Idempotency-Key':business['execute_key']},json={})
        assert receipt==business['receipt']
        self.evidence['checks']['consumer_polling_recovery']['original_receipt_replay_equal']=True

    def legacy_audit_regression(self):
        from dataclasses import replace
        from mate_kernel.ontology import ClassRef
        from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository
        import psycopg2
        tenant='mp11-candidate';dsn=manage.pg_dsn(manage.DB)
        origin=PgOntologyRepository(dsn=dsn);suffix=uuid.uuid4().hex[:8]
        action=ClassRef('ont.'+tenant+'.act.audit-'+suffix);fn=ClassRef('ont.'+tenant+'.fn.audit-'+suffix)
        with origin.tenant_scope(tenant):
            sample=origin.get_individual('ont.'+tenant+'.ind.order.2')
            target=replace(sample,rid='ont.'+tenant+'.ind.order.audit-'+suffix,primary_key='audit-'+suffix)
            origin.create_individual(target)
            model=origin.get_object_type(ClassRef('ont.'+tenant+'.obj.order'))
            status=next(p for p in model.properties if p.rid.rid.endswith('.status'))
            template=origin.get_action_type(ClassRef('ont.'+tenant+'.act.review'))
            origin.upsert_action_type(replace(template,rid=action,parameters=(status,),function_ref=fn,declarative_edits=()))
        receipts=[];effects=[];replays=[]
        for index in range(2):
            own=PgOntologyRepository(dsn=dsn)
            own._action_service.register_function(fn.rid,lambda iid,parameters: effects.append(iid) or parameters)
            with own.tenant_scope(tenant):
                proposal=own.propose_action(action,{'status':'audit-'+str(index)},target.rid,'Actual independent repository audit regression')
                own.confirm_proposal(proposal.proposal_id,'verified-local-regression')
                key='audit-'+proposal.proposal_id
                receipt=own.execute_proposal(proposal.proposal_id,'verified-local-regression',key)
                assert own.execute_proposal(proposal.proposal_id,'verified-local-regression',key)==receipt
                receipts.append(receipt);replays.append({'proposal':proposal.proposal_id,'key':key})
        assert len(effects)==2 and len({r['audit_id'] for r in receipts})==2
        with psycopg2.connect(dsn) as conn,conn.cursor() as cur:
            cur.execute('SELECT count(*) FROM ont_action_audit WHERE tenant_id=%s AND audit_id=ANY(%s)',(tenant,[r['audit_id'] for r in receipts]));assert cur.fetchone()[0]==2
        self.evidence['checks']['actual_pg_multiple_action_services']={'audit_ids':[r['audit_id'] for r in receipts],'persisted_audits':2,'function_calls':len(effects),'same_key_replays_equal':True,'scope':'actual PG local deterministic registered function; not external exactly-once proof'}

    def compensation(self):
        number=int(time.time()*1000)
        proposed=self.request('POST','/ont/v2/classes/ont.mp11-candidate.obj.order/propose-instance',json={'props':{'id':number,'total':1,'status':'pending'},'impact_summary':'Reversible isolated acceptance order'})
        pid=proposed['proposal_id'];self.request('POST','/ont/v2/proposals/'+pid+'/confirm',headers={'Idempotency-Key':'comp-confirm-'+pid},json={})
        receipt=self.request('POST','/ont/v2/proposals/'+pid+'/execute',headers={'Idempotency-Key':'comp-execute-'+pid},json={})
        rid=receipt['individual_rid'];self.request('GET','/ont/v2/individuals/'+rid)
        for actor in ('readonly','service'):
            self.request('POST','/ont/v2/proposals/'+pid+'/revert',actor=actor,expected=403,headers={'Idempotency-Key':'deny-revert-'+pid},json={})
        reverted=self.request('POST','/ont/v2/proposals/'+pid+'/revert',headers={'Idempotency-Key':'comp-revert-'+pid},json={})
        assert reverted['equivalence']=='equivalent'
        self.request('GET','/ont/v2/individuals/'+rid,expected=404)
        self.evidence['checks']['signed_compensation']={'proposal_id':pid,'individual_rid':rid,'revert':reverted,'readonly_service_denied':True,'actual_instance_absent':True}

    def source_faults(self):
        import psycopg2,threading
        from psycopg2 import sql
        from psycopg2.extensions import parse_dsn
        database='codex_mp11_candidate_source_20261012'
        dsn=manage.ensure_database(database)
        with psycopg2.connect(dsn) as conn,conn.cursor() as cur:
            cur.execute('CREATE TABLE IF NOT EXISTS public.orders(id integer PRIMARY KEY,total integer NOT NULL,modified_at timestamptz NOT NULL)')
            cur.execute("INSERT INTO public.orders VALUES(1,10,'2026-10-01T00:00:00Z'),(2,20,'2026-10-01T00:00:00Z') ON CONFLICT DO NOTHING")
        cfg=parse_dsn(dsn);config={'host':cfg['host'],'port':int(cfg['port']),'database':cfg['dbname'],'username':cfg['user'],'password':cfg['password'],'schema':'public'}
        sources=self.request('GET','/data/sources')['items'];source=next((x for x in sources if x['name']=='MP11 Isolated Fault Source'),None)
        if source is None:source=self.request('POST','/data/sources',json={'name':'MP11 Isolated Fault Source','type':'postgres','connection_config':config})
        rid='ont.mp11-candidate.obj.faultorder';pr='ont.mp11-candidate.prop.'
        self.request('POST','/ont/v2/object-types',json={'rid':rid,'display_name':'Fault recovery order','primary_key':[pr+'id'],'properties':[{'rid':pr+name,'type_id':'integer','format':'integer','primary_key':name=='id','nullable':False,'title':name} for name in ('id','total')]})
        mapping={'class_rid':rid,'name':'Isolated fault source','source_id':source['id'],'table':'public.orders','pk_column':'id','ts_column':'modified_at','field_mapping':{pr+'id':'id',pr+'total':'total'}}
        self.request('POST','/ont/v2/object-types/'+rid+'/datasources',json=mapping)
        self.request('POST','/ont/v2/object-types/'+rid+'/datasources',expected=422,json={**mapping,'field_mapping':{pr+'id':'missing',pr+'total':'total'}})
        sync='/ont/v2/object-types/'+rid+'/datasources/sync'
        first=self.request('POST',sync,json={});assert first['ok']
        admin=psycopg2.connect(manage.pg_dsn(manage.active_database()));admin.autocommit=True
        try:
            with admin.cursor() as cur:
                cur.execute(sql.SQL('ALTER DATABASE {} ALLOW_CONNECTIONS false').format(sql.Identifier(database)))
                cur.execute('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=%s AND pid<>pg_backend_pid()',(database,))
            failed=self.request('POST',sync,json={})
            assert not failed['ok'] and failed['status']=='failed' and failed['run_id']
            persisted=self.request('GET','/ont/v2/object-types/'+rid+'/datasources/runs/'+failed['run_id'])
            assert persisted['status']=='failed'
        finally:
            with admin.cursor() as cur:cur.execute(sql.SQL('ALTER DATABASE {} ALLOW_CONNECTIONS true').format(sql.Identifier(database)))
            admin.close()
        recovered=self.request('POST',sync,json={});assert recovered['ok']
        # A real source table lock holds the existing sync inside PostgreSQL.
        blocker=psycopg2.connect(dsn)
        with blocker.cursor() as cur:cur.execute('LOCK TABLE public.orders IN ACCESS EXCLUSIVE MODE')
        result={}
        def invoke():
            try:result['value']=self.request('POST',sync,json={})
            except Exception as exc:result['failure_category']=type(exc).__name__
        worker=threading.Thread(target=invoke);worker.start()
        running_id=None
        try:
            for attempt in range(40):
                with psycopg2.connect(manage.pg_dsn(manage.active_database())) as conn,conn.cursor() as cur:
                    cur.execute('SELECT run_history FROM ont_backing_datasource WHERE tenant_id=%s AND class_rid=%s',('mp11-candidate',rid))
                    history=cur.fetchone()[0]
                    running_id=next((r['run_id'] for r in history if r['status']=='running'),None)
                if running_id:break
                time.sleep(.1)
            if not running_id:raise RuntimeError('real blocked sync did not persist running state')
            self.request('POST',sync,expected=409,json={})
            manage.stop('api')
            # Real MCP endpoint is unavailable while its exact owned service is down.
            unavailable=False
            try:httpx.post('http://127.0.0.1:55522/api/v1/mcp/protocol/mcp',headers=self.sessions['writer'].headers,json={'jsonrpc':'2.0','id':1,'method':'initialize'},timeout=2,trust_env=False)
            except (httpx.ConnectError,httpx.ConnectTimeout):unavailable=True
            assert unavailable
        finally:
            blocker.rollback();blocker.close();worker.join(timeout=5)
            manage.start('api')
        self.login()
        interrupted=self.request('GET','/ont/v2/object-types/'+rid+'/datasources/runs/'+running_id)
        assert interrupted['status']=='interrupted'
        retry=self.request('POST',sync,json={});assert retry['ok']
        rows=self.request('GET','/ont/v2/individuals',params={'class_rid':rid})
        assert len(rows)==2
        # Same timestamp with a later primary key must advance the persisted cursor.
        with psycopg2.connect(dsn) as conn,conn.cursor() as cur:cur.execute("INSERT INTO public.orders VALUES(3,30,'2026-10-01T00:00:00Z') ON CONFLICT DO NOTHING")
        incremental=self.request('POST',sync+'?incremental=true',json={});assert incremental['ok']
        rows=self.request('GET','/ont/v2/individuals',params={'class_rid':rid});assert len(rows)==3
        repeat=self.request('POST',sync+'?incremental=true',json={});assert repeat['ok'] and repeat['total_synced']==0
        business=json.loads((manage.PRIVATE/'business-state.json').read_text())
        receipt=self.request('POST','/ont/v2/proposals/'+business['proposal_id']+'/execute',headers={'Idempotency-Key':business['execute_key']},json={})
        assert receipt==business['receipt']
        with psycopg2.connect(manage.pg_dsn(manage.active_database())) as conn,conn.cursor() as cur:
            cur.execute('SELECT count(*) FROM ont_action_audit WHERE tenant_id=%s AND proposal_id=%s',('mp11-candidate',business['proposal_id']))
            assert cur.fetchone()[0]==1
        self.evidence['checks']['source_and_task_recovery']={'source_database':database,'connection_denied_run':failed['run_id'],'recovered_run':recovered['run_id'],'interrupted_run':running_id,'retry_run':retry['run_id'],'wrong_column_denied':True,'concurrent_sync_denied':True,'new_process_rows':3,'same_timestamp_cursor_replay_zero':True,'mcp_endpoint_down_observed':True,'original_receipt_replay_equal':True,'original_audit_count':1}

    def migration_chain(self):
        import subprocess,psycopg2
        saved_business=(manage.PRIVATE/'business-state.json').read_text()
        saved_evidence=json.loads(json.dumps(self.evidence));proof_path=OUT/'migration-chains.json';proofs=json.loads(proof_path.read_text()) if proof_path.exists() else {}
        try:
            for kind in ('fresh','upgrade'):
                if kind in proofs:continue
                database=f'codex_mp11_candidate_{kind}_20261012';dsn=manage.ensure_database(database)
                env=manage.environment();env['MATE_DB_URL']=dsn
                def migrate(revision):
                    result=subprocess.run([str(manage.PYTHON),'-m','alembic','upgrade',revision],cwd=manage.ROOT/'mate-platform-backend',env=env,capture_output=True,text=True,encoding='utf-8',errors='replace')
                    # Alembic normal migration messages contain revision IDs only.
                    lines=[line for line in (result.stdout+result.stderr).splitlines() if 'Running upgrade' in line or 'Context impl' in line]
                    with (OUT/(kind+'-alembic.log')).open('a',encoding='utf-8') as log:log.write('\n'.join(lines)+'\n')
                    if result.returncode:raise RuntimeError(kind+' actual Alembic '+revision+' failed; private details suppressed')
                with psycopg2.connect(dsn) as conn,conn.cursor() as cur:
                    cur.execute("SELECT to_regclass('public.alembic_version')");has_version=cur.fetchone()[0]
                    current=None
                    if has_version:cur.execute('SELECT version_num FROM alembic_version');current=cur.fetchone()[0]
                if kind=='upgrade' and current!='0022_mcp_key_scopes':
                    migrate('0020_mcp_clients')
                    with psycopg2.connect(dsn) as conn,conn.cursor() as cur:
                        cur.execute("INSERT INTO apphub_apps(id,tenant_id,name,code,category,description,version,owner,tags,business_domain) VALUES('mp11-prior-app','mp11-candidate','Prior0020','prior0020','','','1.0.0','writer','','') ON CONFLICT DO NOTHING")
                    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository
                    repo=PgOntologyRepository(dsn=dsn);repo._ensure_schema()
                    with psycopg2.connect(dsn) as conn,conn.cursor() as cur:
                        cur.execute('ALTER TABLE ont_proposal DROP COLUMN IF EXISTS approval_expires_at')
                        cur.execute("INSERT INTO ont_proposal(proposal_id,tenant_id,action_rid,parameters,status,confirmed_at) VALUES('mp11-legacy-undated','mp11-candidate','', '{}'::jsonb,'confirmed',now()) ON CONFLICT DO NOTHING")
                migrate('head')
                with psycopg2.connect(dsn) as conn,conn.cursor() as cur:
                    cur.execute('SELECT version_num FROM alembic_version');revision=cur.fetchone()[0]
                    assert revision=='0022_mcp_key_scopes'
                    if kind=='upgrade':
                        cur.execute("SELECT name,status,versions FROM apphub_apps WHERE id='mp11-prior-app'");assert cur.fetchone()==('Prior0020','DESIGNING','[]')
                manage.stop('api');manage.save(manage.PRIVATE/'active-database.json',{'database':database});manage.start('api')
                self.login();self.key_permissions();self.source_chain();self.application_chain();asyncio.run(self.protocol_checks())
                if kind=='upgrade':self.request('POST','/ont/v2/proposals/mp11-legacy-undated/execute',expected=409,headers={'Idempotency-Key':'legacy-never-execute'},json={})
                proofs[kind]={'database':database,'alembic_revision':revision,'actual_signed_chain':self.evidence['checks']['published_app_human_receipt'],'source_discovery':self.evidence['checks']['discovery_draft_publish_sync'],'legacy_undated_denied':kind=='upgrade'}
                manage.save(OUT/'migration-chains.json',proofs)
        finally:
            manage.stop('api');manage.save(manage.PRIVATE/'active-database.json',{'database':manage.DB});manage.start('api')
            (manage.PRIVATE/'business-state.json').write_text(saved_business,encoding='utf-8')
            self.evidence=saved_evidence
        self.login();self.evidence['checks']['fresh_upgrade_chains']={key:{'database':value['database'],'revision':value['alembic_revision'],'signed_receipt':True} for key,value in proofs.items()}

    def security_checks(self):
        from datetime import datetime,timezone
        from mate_platform.auth.config import load_auth_config
        from mate_platform.auth.verifier import TokenVerifier
        from mate_platform.auth.middleware import _looks_like_service
        from websockets.sync.client import connect
        from websockets.exceptions import ConnectionClosed
        proposed=self.request('POST','/ont/v2/action-types/ont.mp11-candidate.act.review/propose',json={'target_iid':'ont.mp11-candidate.ind.order.1','parameters':{}})
        pid=proposed['proposal_id']
        confirmed=self.request('POST','/ont/v2/proposals/'+pid+'/confirm',headers={'Idempotency-Key':'expiry-'+pid},json={})
        deadline=datetime.fromisoformat(confirmed['approval_expires_at'].replace('Z','+00:00')).timestamp()
        if deadline-time.time()>65:raise RuntimeError('expiry proof requires explicit supported60second candidate policy')
        admin=httpx.post('http://127.0.0.1:55520/realms/master/protocol/openid-connect/token',data={'grant_type':'password','client_id':'admin-cli','username':'mp11-admin','password':self.inputs.get('admin_password')},trust_env=False)
        ah={'Authorization':'Bearer '+admin.json()['access_token']};base='http://127.0.0.1:55520/admin/realms/codex-mp11'
        clients=httpx.get(base+'/clients',headers=ah,params={'clientId':'mp11-web'},trust_env=False)
        original=clients.json()[0];original['attributes']=dict(original.get('attributes',{}));endpoint=base+'/clients/'+original['id']
        unknown={**original,'protocolMappers':[p for p in original['protocolMappers'] if p.get('name')!='username']}
        verifier=TokenVerifier(load_auth_config())
        try:
            changed=httpx.put(endpoint,headers=ah,json=unknown,trust_env=False)
            assert changed.status_code==204
            response=httpx.post('http://127.0.0.1:55523/api/v1/iam/auth/login',json={'username':'writer','password':self.inputs.get('writer_password')},trust_env=False)
            if response.status_code!=200:raise RuntimeError('unknown-identity issuer fixture grant failed')
            token=response.json()['accessToken'];claims=verifier.verify(token)
            assert not claims.preferred_username and _looks_like_service(claims)
            self.sessions['unknown']=Session('unknown',token)
            self.request('POST','/ont/v2/proposals/'+pid+'/confirm',actor='unknown',expected=403,json={})
            short={**original,'attributes':{**original.get('attributes',{}),'access.token.lifespan':'2'}}
            assert httpx.put(endpoint,headers=ah,json=short,trust_env=False).status_code==204
            response=httpx.post('http://127.0.0.1:55523/api/v1/iam/auth/login',json={'username':'writer','password':self.inputs.get('writer_password')},trust_env=False)
            if response.status_code!=200:raise RuntimeError('short-lived signed grant failed')
            short_session=Session('short-lived',response.json()['accessToken']);short_claims=verifier.verify(short_session._token)
            assert short_claims.expires_at-time.time()<=3
        finally:
            restore={**original,'attributes':{**original['attributes'],'access.token.lifespan':original['attributes'].get('access.token.lifespan')}}
            restored=httpx.put(endpoint,headers=ah,json=restore,trust_env=False)
            if restored.status_code!=204:raise RuntimeError('owned issuer client restore failed')
            actual=httpx.get(endpoint,headers=ah,trust_env=False).json()
            if actual.get('attributes',{}).get('access.token.lifespan')!=original['attributes'].get('access.token.lifespan'):raise RuntimeError('owned issuer effective lifetime restore failed')
        with connect('ws://127.0.0.1:55522/api/v1/ont/v2/ws/object-changes',additional_headers=short_session.headers,open_timeout=3) as ws:
            assert json.loads(ws.recv(timeout=3))['type']=='subscribed'
            closed=False
            try:
                while time.time()<short_claims.expires_at+5:ws.recv(timeout=5)
            except ConnectionClosed as exc:
                closed=exc.rcvd is not None and exc.rcvd.code==4401
            assert closed
        codes=[]
        for _ in range(51):
            response=self.client.post('/mcp/tools/ont_object_query',headers=self.sessions['readonly'].headers,json={'arguments':{'source':'ont.mp11-candidate.obj.order'}})
            codes.append(response.status_code)
        assert codes.count(200)==50 and codes[-1]==429
        # Expiration uses real server time, never a changed DB deadline or fake clock.
        while time.time()<=deadline:time.sleep(min(1,deadline-time.time()+.1))
        self.request('POST','/ont/v2/proposals/'+pid+'/execute',expected=409,headers={'Idempotency-Key':'expired-'+pid},json={})
        self.evidence['checks']['actual_security_boundaries']={'unknown_signed_human_metadata_denied':True,'issuer_client_restored':True,'signed_ws_expiry_close':4401,'normal_redis_first50':200,'normal_redis_51st':429,'approval_id':pid,'actual_deadline':confirmed['approval_expires_at'],'expired_execution':409}

    def persist(self):
        OUT.mkdir(parents=True,exist_ok=True)
        manage.save(OUT/'acceptance.json',self.evidence)

def seed_backend_fixture(dsn):
    """Reproduce accepted Task7 prerequisite in the guarded dedicated test DB."""
    # This shared dedicated test DB already contains tables made by package
    # fixtures; fresh/upgrade migration acceptance is separately proven on the
    # exact fresh/upgrade databases. Never stamp over an incompatible schema.
    from sqlalchemy import create_engine
    from mate_app_hub.repositories import sql_models
    engine=create_engine(dsn)
    for cls in vars(sql_models).values():
        if isinstance(cls,type) and getattr(cls,'__tablename__',None):cls.__table__.create(engine,checkfirst=True)
    engine.dispose()
    from enum import Enum
    from dataclasses import is_dataclass,replace,fields
    from mate_kernel.ontology import ClassRef
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository
    def translated(value):
        if isinstance(value,Enum):return value
        if isinstance(value,str):return value.replace('mp11-candidate','mp11-app-ui')
        if is_dataclass(value):return replace(value,**{f.name:translated(getattr(value,f.name)) for f in fields(value) if f.init})
        if isinstance(value,tuple):return tuple(translated(v) for v in value)
        if isinstance(value,list):return [translated(v) for v in value]
        if isinstance(value,dict):return {translated(k):translated(v) for k,v in value.items()}
        return value
    source=PgOntologyRepository(dsn=manage.pg_dsn(manage.DB));target=PgOntologyRepository(dsn=dsn)
    with source.tenant_scope('mp11-candidate'),target.tenant_scope('mp11-app-ui'):
        for kind in ('customer','order'):
            target.upsert_object_type(translated(source.get_object_type(ClassRef('ont.mp11-candidate.obj.'+kind))))
        target.upsert_action_type(translated(source.get_action_type(ClassRef('ont.mp11-candidate.act.review'))))
        target.create_individual(translated(source.get_individual('ont.mp11-candidate.ind.order.2')))


def run_checks(group):
    import subprocess,re,ast
    for path in manage.environment()['PYTHONPATH'].split(os.pathsep):sys.path.insert(0,path)
    env=manage.environment();env.pop('NO_COLOR',None);env['FORCE_COLOR']='0';env['NODE_OPTIONS']='--no-experimental-webstorage'
    secret_values=list(PrivateInputs()._data.values())
    from urllib.parse import urlparse,unquote
    for key in ('MATE_DB_URL','IAM_DATABASE_URL'):
        password=urlparse(env[key]).password
        if password:secret_values.append(unquote(password))
    def clean(value):
        value=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',value)
        for secret in secret_values:
            if isinstance(secret,str) and len(secret)>5:value=value.replace(secret,'[REDACTED]')
        value=re.sub(r'(?:postgres(?:ql)?(?:\+asyncpg)?|redis)://[^\s\"\']+', '[REDACTED_DSN]',value)
        value=re.sub(r"netloc='[^']*'","netloc='[REDACTED_DSN_AUTHORITY]'",value)
        value=re.sub(r'eyJ[A-Za-z0-9_.-]+','[REDACTED_TOKEN]',value)
        return value
    commands=[]
    ws_only=group=='backend-ws'
    cover=group in ('backend-cover','backend-ws')
    if cover:group='backend-rest'
    fixes=group=='backend-fixes';object_only=group=='browser-object';impact_only=group=='browser-impact'
    if impact_only:group='browser'
    if fixes:group='backend-rest'
    if object_only:group='browser'
    resume=group.endswith('-rest')
    group=group.removesuffix('-rest')
    if group=='frontend':
        cwd=manage.ROOT/'metaplatform-frontend/apps/web'
        commands=[('all-web',['pnpm.cmd','exec','vitest','run'],cwd),('web-types',['pnpm.cmd','exec','tsc','--noEmit'],cwd),('web-build',['pnpm.cmd','run','build'],cwd),('shared-login',['pnpm.cmd','exec','vitest','run','--root','../../packages/shared','--environment','jsdom','src/components/SharedLoginPage.test.tsx'],cwd)]
        if resume:commands=commands[1:]
    elif group=='browser':
        from psycopg2.extensions import parse_dsn
        cfg=parse_dsn(manage.pg_dsn(manage.DB))
        env.update(MP11_CANDIDATE='1',PGHOST=cfg['host'],PGPORT=cfg['port'],PGDATABASE=cfg['dbname'],PGUSER=cfg['user'],PGPASSWORD=cfg['password'])
        cwd=manage.ROOT/'metaplatform-frontend/apps/web'
        browser_run=None
        if not object_only and not impact_only:
            session=json.loads((manage.PRIVATE/'ui-session.json').read_text())
            browser_run=session.get('run_id')
            if not isinstance(browser_run,str) or not re.fullmatch(r'[0-9a-f]{12}',browser_run):
                raise RuntimeError('full Browser requires fresh owned fixture preparation')
            fixture_path=OUT/('browser-fixtures-'+browser_run+'.json')
            if not fixture_path.exists():raise RuntimeError('Browser fixture provenance missing')
            if (OUT/('browser-checks-'+browser_run+'.json')).exists():
                raise RuntimeError('Browser fixtures already consumed; run advertised Browser phase for fresh preparation')
        commands=[('actual-browser-impact' if impact_only else 'actual-browser-object' if object_only else 'actual-browser-'+browser_run,['pnpm.cmd','exec','playwright','test','--config',str(manage.ROOT/'scripts/acceptance/mp11/playwright.config.ts'),*(['--project=web','--grep','appear together in model impact'] if impact_only else ['--project=web','ontology-object-creation-flow.spec.ts'] if object_only else [])],cwd)]
    elif group=='backend':
        for name in list(env):
            if name.startswith(('KEYCLOAK_','SERVICE_CLIENT_','TECH_ONT_')) or name in ('INSECURE_SKIP_SIGNATURE','LEGACY_LOGIN_COMPAT','APPHUB_URL','ONTOLOGY_URL','ONT_APPROVAL_TTL_SECONDS'):env.pop(name,None)
        dsn=manage.ensure_database('codex_mp11_candidate_tests_20261012')
        seed_backend_fixture(dsn)
        names={'PG_DSN','ONT_SOURCE_DSN'}
        packages=('mate-kernel','mate-platform','mate-tech-data','mate-app-hub','mate-tech-mcp','mate-tech-ont')
        for package in packages:
            for path in (manage.ROOT/'mate-platform-backend/packages'/package/'tests').rglob('*.py'):
                try:tree=ast.parse(path.read_text(encoding='utf-8'))
                except (UnicodeError,SyntaxError):continue
                for node in ast.walk(tree):
                    if isinstance(node,ast.Call) and isinstance(node.func,ast.Attribute) and node.func.attr in ('get','getenv') and node.args and isinstance(node.args[0],ast.Constant) and isinstance(node.args[0].value,str):
                        name=node.args[0].value
                        if 'DSN' in name or 'DATABASE_URL' in name:names.add(name)
        for name in names:env[name]=dsn
        env['MP11_WS_PG_DSN']=manage.pg_dsn('codex_mp11_ws_20261012')
        env['MP11_WS_PG_REQUIRED']='1'
        # Existing unit fixtures choose their own memory/SQLite stores; PG-specific
        # tests get explicit dedicated targets before module collection.
        for name in ('MATE_DB_URL','DATABASE_URL'):env.pop(name,None)
        cwd=manage.ROOT/'mate-platform-backend'
        for package in packages:
            if resume and package=='mate-kernel' and not fixes:continue
            if fixes and package in ('mate-platform','mate-tech-data'):continue
            commands.append((package,[str(manage.PYTHON),'-m','pytest','-c','pyproject.toml','packages/'+package+'/tests','-q','--tb=short','-o','cache_dir='+str(manage.PRIVATE/'pytest-cache'), '--basetemp='+str(manage.PRIVATE/('pytest-'+package+'-'+uuid.uuid4().hex[:8]))],cwd))
        commands.append(('auth-service',[str(manage.PYTHON),'-m','pytest','-c','pyproject.toml','services/auth-service/tests/test_mp11_login_tenant.py','-q','--tb=short','-o','cache_dir='+str(manage.PRIVATE/'pytest-cache')],cwd))
        if cover:
            commands=[('kernel-uuid-cover',[str(manage.PYTHON),'-m','pytest','-c','pyproject.toml','packages/mate-kernel/tests/test_action_engine.py','packages/mate-kernel/tests/test_mp11_audit_identity.py','-q','--tb=short','-p','no:cacheprovider'],cwd),('apphub-human-cover',[str(manage.PYTHON),'-m','pytest','-c','pyproject.toml','packages/mate-app-hub/tests/test_apphub_publication.py::test_stale_release_approval_cannot_replace_new_running_snapshot','-q','--tb=short','-p','no:cacheprovider'],cwd)]
        if cover:
            commands.append(('ont-ws-cover',[str(manage.PYTHON),'-m','pytest','-c','pyproject.toml','packages/mate-tech-ont/tests/test_ont_g23_functions.py','packages/mate-tech-ont/tests/test_mp11_ws_auth.py','-q','--tb=short','-p','no:cacheprovider'],cwd))
        if ws_only:commands=[c for c in commands if c[0]=='ont-ws-cover']
        manage.save(OUT/'backend-targets.json',{'database':'codex_mp11_candidate_tests_20261012','host':'127.0.0.1','port':55497,'overridden_env_names':sorted(names),'ws_database':'codex_mp11_ws_20261012','removed_ambient':['MATE_DB_URL','DATABASE_URL']})
    else:raise RuntimeError('unknown checks group')
    result_path=OUT/(('browser-checks-'+browser_run if group=='browser' and not object_only and not impact_only else group+'-checks')+'.json')
    results=json.loads(result_path.read_text()) if resume and result_path.exists() else []
    results=[r for r in results if r['name'] not in {c[0] for c in commands}]
    for name,args,cwd in commands:
        started=time.time()
        run=subprocess.run(args,cwd=cwd,env=env,capture_output=True,text=True,encoding='utf-8',errors='replace')
        output=clean(run.stdout+'\n'+run.stderr)
        (OUT/(name+'.log')).write_text(output,encoding='utf-8')
        result={'name':name,'command':args,'cwd':str(cwd),'exit_code':run.returncode,'elapsed_seconds':round(time.time()-started,2),'source_head':manage.command(['git','rev-parse','HEAD'])}
        if group=='browser' and not object_only and not impact_only:result['fixture_run_id']=browser_run
        results.append(result);manage.save(result_path,results)
        print(name,'exit',run.returncode,'seconds',result['elapsed_seconds'],flush=True)
        print('\n'.join(output.strip().splitlines()[-12:]),flush=True)
    return int(any(x['exit_code'] for x in results if x['name'] in {c[0] for c in commands}))

if __name__=='__main__':
    if len(sys.argv)>1 and sys.argv[1] in ('frontend','backend','frontend-rest','backend-rest','backend-fixes','backend-cover','backend-ws','browser','browser-object','browser-impact'):sys.exit(run_checks(sys.argv[1]))
    acceptance=None
    try:
        acceptance=Acceptance();acceptance.login()
        if len(sys.argv)>1 and sys.argv[1]=='prepare-browser':acceptance.prepare_browser()
        elif len(sys.argv)>1 and sys.argv[1]=='refresh-browser':acceptance.refresh_browser()
        elif len(sys.argv)>1 and sys.argv[1]=='ws':acceptance.websocket_check()
        elif len(sys.argv)>1 and sys.argv[1]=='targets':asyncio.run(acceptance.effective_clients())
        elif len(sys.argv)>1 and sys.argv[1]=='mapping-negatives':acceptance.mapping_negatives()
        elif len(sys.argv)>1 and sys.argv[1]=='audit':acceptance.legacy_audit_regression()
        elif len(sys.argv)>1 and sys.argv[1]=='consumer':acceptance.consumer_recovery();acceptance.compensation()
        elif len(sys.argv)>1 and sys.argv[1]=='faults':acceptance.source_faults()
        elif len(sys.argv)>1 and sys.argv[1]=='migrations':acceptance.migration_chain()
        elif len(sys.argv)>1 and sys.argv[1]=='security':acceptance.security_checks()
        elif len(sys.argv)>1:raise RuntimeError('unknown acceptance phase')
        else:acceptance.key_permissions();acceptance.source_chain();acceptance.application_chain();asyncio.run(acceptance.protocol_checks())
        acceptance.persist()
        print('PASS candidate phase:',sys.argv[1] if len(sys.argv)>1 else 'signed-business-chain')
    except Exception as exc:
        if acceptance:
            acceptance.evidence['failure_category']=type(exc).__name__
            if isinstance(exc,RuntimeError):acceptance.evidence['failure']=str(exc)
            acceptance.persist()
        print('Acceptance incomplete:',type(exc).__name__,str(exc) if isinstance(exc,RuntimeError) else 'details suppressed to protect private inputs')
        sys.exit(1)
