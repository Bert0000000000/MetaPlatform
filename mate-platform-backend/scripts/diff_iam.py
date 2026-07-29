import importlib
import os
import sys

import yaml

ROOT = r'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend'
sys.path.insert(0, os.path.join(ROOT, 'packages', 'mate-tech-iam', 'src'))
m = importlib.import_module('mate_tech_iam.main'); app = m.app
actual = set()
for r in app.router.routes:
    if type(r).__name__ == 'APIRoute':
        actual.add((r.path, ','.join(sorted(r.methods))))
    elif type(r).__name__ == '_IncludedRouter':
        for sr in r.original_router.routes:
            if type(sr).__name__ == 'APIRoute':
                actual.add((sr.path, ','.join(sorted(sr.methods))))
yd = yaml.safe_load(open(os.path.join(ROOT, 'packages', 'mate-tech-iam', 'openapi', 'iam.yaml'), encoding='utf8'))
yaml_paths = set()
for p, item in yd.get('paths', {}).items():
    for m_ in item:
        if m_.lower() in ('get','post','put','delete','patch','options','head'):
            yaml_paths.add((p, m_.upper()))
print('actual:', len(actual), 'yaml:', len(yaml_paths))
print('=== missing in yaml ===')
for x in sorted(actual - yaml_paths):
    print(' ', x[1], x[0])
print('=== extra in yaml (not in actual) ===')
for x in sorted(yaml_paths - actual):
    print(' ', x[1], x[0])
