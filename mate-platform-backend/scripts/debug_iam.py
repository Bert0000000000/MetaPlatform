import importlib
import os
import sys

ROOT = r'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend'
sys.path.insert(0, os.path.join(ROOT, 'packages', 'mate-tech-iam', 'src'))
m = importlib.import_module('mate_tech_iam.main')
app = m.app
for i, r in enumerate(app.routes):
    cls = type(r).__name__
    if cls == '_IncludedRouter':
        sub = getattr(r, 'app', None)
        print(f"  [{i}] _IncludedRouter prefix={getattr(r, 'prefix', '')!r} sub_cls={type(sub).__name__} sub_routes_count={len(getattr(sub, 'routes', []))}")
        if sub is not None:
            for j, sr in enumerate(sub.routes[:3]):
                print(f"     sub[{j}] {type(sr).__name__} path={getattr(sr, 'path', None)} methods={getattr(sr, 'methods', None)}")
    else:
        print(f"  [{i}] {cls} path={getattr(r, 'path', None)}")
