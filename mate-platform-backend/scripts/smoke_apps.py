"""Import each FastAPI app, list its actual route paths, and dump to JSON."""
import importlib
import os
import sys

ROOT = r'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend'
sys.path.insert(0, os.path.join(ROOT, 'services', 'auth-service', 'src'))
sys.path.insert(0, os.path.join(ROOT, 'services', 'api-gateway', 'src'))
for p in ['mate-common', 'mate-app-kb', 'mate-tech-agent', 'mate-tech-iam', 'mate-tech-llmgw', 'mate-tech-mcp', 'mate-tech-msg', 'mate-tech-obs', 'mate-tech-ont', 'mate-tech-rag']:
    sys.path.insert(0, os.path.join(ROOT, 'packages', p, 'src'))

TARGETS = [
    ('mate-app-kb',     'mate_app_kb.api.app',     'app'),
    ('mate-tech-agent', 'mate_tech_agent.api.app', 'app'),
    ('mate-tech-iam',   'mate_tech_iam.main',      'app'),
    ('mate-tech-llmgw', 'mate_tech_llmgw.main',    'app'),
    ('mate-tech-mcp',   'mate_tech_mcp.main',      'app'),
    ('mate-tech-msg',   'mate_tech_msg.main',      'app'),
    ('mate-tech-obs',   'mate_tech_obs.main',      'app'),
    ('mate-tech-ont',   'mate_tech_ont.main',      'app'),
    ('mate-tech-rag',   'mate_tech_rag.api.app',   'app'),
    ('api-gateway',     'mate_api_gateway.main',   'app'),
    ('auth-service',    'mate_auth_service.main',  'app'),
]

def walk(app):
    """Walk app.router.routes. FastAPI 0.140+ uses _IncludedRouter.original_router to hold sub-routes."""
    out = []
    for r in app.router.routes:
        cls = type(r).__name__
        if cls == 'APIRoute':
            methods = sorted(getattr(r, 'methods', set()) or set()) or ['']
            out.append({'path': r.path, 'methods': methods})
        elif cls == '_IncludedRouter':
            orig = getattr(r, 'original_router', None)
            if orig is not None:
                for sr in orig.routes:
                    if type(sr).__name__ == 'APIRoute':
                        methods = sorted(getattr(sr, 'methods', set()) or set()) or ['']
                        out.append({'path': sr.path, 'methods': methods})
    return out

results = {}
for svc, mod, attr in TARGETS:
    try:
        m = importlib.import_module(mod)
        app = getattr(m, attr)
        routes = walk(app)
        results[svc] = {"ok": True, "count": len(routes), "routes": routes}
    except Exception as e:
        results[svc] = {"ok": False, "error": f"{type(e).__name__}: {e}"}

for svc, info in results.items():
    if info.get('ok'):
        biz = [r for r in info['routes'] if r['path'] not in ('/openapi.json','/docs','/docs/oauth2-redirect','/redoc')]
        print(f"{svc:20s} OK  total={info['count']:3d}  biz={len(biz):3d}")
        for r in biz:
            ms = ','.join(r['methods'])
            print(f"  {ms:30s} {r['path']}")
    else:
        print(f"{svc:20s} FAIL  {info['error']}")
