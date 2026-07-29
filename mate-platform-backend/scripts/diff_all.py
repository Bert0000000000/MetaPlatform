import importlib
import os
import sys

import yaml

ROOT = r'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend'
TARGETS = [
    ('mate-app-kb',     'mate_app_kb.api.app',     'app', 'app-kb.yaml'),
    ('mate-tech-llmgw', 'mate_tech_llmgw.main',    'app', 'llmgw.yaml'),
    ('mate-tech-mcp',   'mate_tech_mcp.main',      'app', 'mcp.yaml'),
    ('mate-tech-obs',   'mate_tech_obs.main',      'app', 'obs.yaml'),
    ('mate-tech-rag',   'mate_tech_rag.api.app',   'app', 'rag.yaml'),
]
sys.path.insert(0, os.path.join(ROOT, 'services', 'auth-service', 'src'))
sys.path.insert(0, os.path.join(ROOT, 'services', 'api-gateway', 'src'))
for p in ['mate-app-kb','mate-tech-llmgw','mate-tech-mcp','mate-tech-obs','mate-tech-rag']:
    sys.path.insert(0, os.path.join(ROOT, 'packages', p, 'src'))

def actual_routes(app):
    s = set()
    for r in app.router.routes:
        if type(r).__name__ == 'APIRoute':
            s.add((r.path, ','.join(sorted(r.methods))))
        elif type(r).__name__ == '_IncludedRouter':
            for sr in r.original_router.routes:
                if type(sr).__name__ == 'APIRoute':
                    s.add((sr.path, ','.join(sorted(sr.methods))))
    return s

def yaml_routes(yaml_path):
    s = set()
    yd = yaml.safe_load(open(yaml_path, encoding='utf8'))
    for p, item in yd.get('paths', {}).items():
        for m_ in item:
            if m_.lower() in ('get','post','put','delete','patch','options','head'):
                s.add((p, m_.upper()))
    return s

for svc, mod, attr, yname in TARGETS:
    try:
        m = importlib.import_module(mod); app = getattr(m, attr)
        a = actual_routes(app)
        yp = os.path.join(ROOT, 'packages', f'mate-tech-{svc.replace("mate-tech-", "")}' if svc.startswith('mate-tech') else svc, 'openapi', yname)
        if svc == 'mate-app-kb':
            yp = os.path.join(ROOT, 'packages', 'mate-app-kb', 'openapi', 'app-kb.yaml')
        y = yaml_routes(yp)
        miss = a - y
        extra = y - a
        print(f'\\n=== {svc} ===')
        print(f'  actual={len(a)} yaml={len(y)} miss={len(miss)} extra={len(extra)}')
        for x in sorted(miss): print('  MISS', x[1], x[0])
        for x in sorted(extra): print('  EXTRA', x[1], x[0])
    except Exception as e:
        print(f'\\n=== {svc} FAIL {type(e).__name__}: {e} ===')
