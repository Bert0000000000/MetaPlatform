"""Source candidate composition; only existing repositories, auth and limiter."""
from __future__ import annotations
import os, sys
from contextlib import asynccontextmanager
from urllib.parse import urlparse
import manage


def validate():
    env=manage.environment()
    os.environ.update(env)
    assert os.environ['INSECURE_SKIP_SIGNATURE']=='false'
    assert os.environ['LEGACY_LOGIN_COMPAT']=='false'
    redis=urlparse(os.environ['REDIS_URL'])
    if (redis.hostname,redis.port,redis.path)!=('127.0.0.1',55521,'/0'): raise RuntimeError('unsafe Redis target')
    for path in env['PYTHONPATH'].split(os.pathsep):
        if path not in sys.path:sys.path.insert(0,path)


def api():
    from fastapi import FastAPI
    from mate_tech_db.base import init_engine
    engine=init_engine(os.environ['MATE_DB_URL'])
    from mate_app_hub.repositories import sql_models as apps
    from mate_tech_data.repositories import sql_models as data
    from mate_tech_mcp.repositories import sql_models as mcp_models
    # Fresh local schemas use the same ORM definitions; upgrade acceptance uses
    # actual Alembic in verify.py, never schema patching on shared databases.
    for module in (apps,data,mcp_models):
        for cls in vars(module).values():
            if isinstance(cls,type) and getattr(cls,'__tablename__',None):cls.__table__.create(engine,checkfirst=True)
    from mate_tech_mcp.security.api_keys import McpApiKeyStore,set_api_key_runtime,mcp_api_key_verifier
    set_api_key_runtime(McpApiKeyStore())
    from mate_tech_mcp.server import create_server
    from mate_tech_mcp.tools.ontology_proxy import build_ontology_proxy_tools
    from mate_tech_mcp.protocol.streamable import build_streamable_http_app
    from mate_tech_mcp.tools.rate_limit import ToolRateLimiter,RateLimitConfig
    server=create_server('codex-mp11-candidate')
    for tool in build_ontology_proxy_tools():
        if str(tool._client.base_url).rstrip('/') != 'http://127.0.0.1:55522':
            raise RuntimeError('unsafe effective MCP ontology target')
        server.register_tool(tool)
    protocol=build_streamable_http_app(server)
    limiter=ToolRateLimiter(config=RateLimitConfig(limit=50,window_sec=60))
    effective=limiter._redis.connection_pool.connection_kwargs
    if effective.get('host')!='127.0.0.1' or effective.get('port')!=55521:raise RuntimeError('unsafe effective limiter target')
    @asynccontextmanager
    async def lifespan(app):
        await limiter._redis.ping()
        async with protocol.mate_server.session_manager.run():yield
        await limiter.close()
        hub=getattr(app.state,'notify_hub',None)
        if hub:hub.stop()
    app=FastAPI(title='MetaPlatform 1.1 candidate',lifespan=lifespan)
    from mate_platform.auth import install_auth
    install_auth(app,api_key_verifier=mcp_api_key_verifier)
    from mate_app_hub.api import router as apps_router
    from mate_tech_data.api.app import router as data_router
    from mate_tech_ont.v2_kernel.api import router as ont_router
    from mate_tech_ont.v2_kernel.agent_metrics import router as metrics_router
    from mate_tech_mcp.api.management_routes import router as keys_router
    from mate_tech_mcp.api.origin_routes import router as tools_router
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository
    app.state.kernel_repo=PgOntologyRepository(dsn=os.environ['MATE_DB_URL'])
    app.state.kernel_repo._ensure_schema()
    app.state.mcp_server=server;app.state.rate_limiter=limiter
    from mate_platform.messaging.outbox import InMemoryOutboxWriter
    app.state.outbox_writer=InMemoryOutboxWriter()
    for router in (apps_router,data_router,ont_router,metrics_router,keys_router,tools_router):app.include_router(router)
    app.mount('/api/v1/mcp/protocol',protocol)
    return app


if __name__=='__main__':
    validate()
    import uvicorn
    role=sys.argv[1]
    if role=='auth':
        from mate_auth_service.main import app
    elif role=='api':app=api()
    else:raise RuntimeError('invalid role')
    uvicorn.run(app,host='127.0.0.1',port=manage.PORTS[role],access_log=False,log_level='warning')
