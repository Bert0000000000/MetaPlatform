import pathlib, re, json, collections
root = pathlib.Path('metaplatform-frontend/apps/web/src')
files = [p for p in root.rglob('*') if p.suffix in {'.ts', '.tsx'}]

by_dir = collections.Counter()
for p in files:
    rel = p.relative_to(root)
    top = rel.parts[0] if len(rel.parts) > 1 else '(root)'
    by_dir[top] += 1

sizes = []
for p in files:
    sizes.append((p.relative_to(root).as_posix(), sum(1 for _ in p.open(encoding='utf-8', errors='ignore'))))
sizes.sort(key=lambda x: -x[1])

hook_usage = collections.Counter()
for p in files:
    text = p.read_text(encoding='utf-8', errors='ignore')
    for m in re.findall(r'\buse[A-Z][A-Za-z]+\(', text):
        hook_usage[m] += 1

state_usage = collections.Counter()
for p in files:
    text = p.read_text(encoding='utf-8', errors='ignore')
    state_usage['useState'] += len(re.findall(r'\buseState\(', text))
    state_usage['useReducer'] += len(re.findall(r'\buseReducer\(', text))
    state_usage['useRef'] += len(re.findall(r'\buseRef\(', text))
    state_usage['useContext'] += len(re.findall(r'\buseContext\(', text))
    state_usage['useEffect'] += len(re.findall(r'\buseEffect\(', text))
    state_usage['useMemo'] += len(re.findall(r'\buseMemo\(', text))
    state_usage['useCallback'] += len(re.findall(r'\buseCallback\(', text))

route_count = 0
for p in files:
    text = p.read_text(encoding='utf-8', errors='ignore')
    route_count += len(re.findall(r'<Route\s', text))

antd_imports = collections.Counter()
for p in files:
    text = p.read_text(encoding='utf-8', errors='ignore')
    for m in re.findall(r"from 'antd'", text):
        antd_imports[m] += 1
antd_message_use = 0
for p in files:
    text = p.read_text(encoding='utf-8', errors='ignore')
    antd_message_use += len(re.findall(r'\bmessage\.(info|warning|error|success)\(', text))

window_uses = 0
for p in files:
    text = p.read_text(encoding='utf-8', errors='ignore')
    window_uses += len(re.findall(r'window\.(location|alert|confirm)', text))

heavy_state_pages = []
for p in files:
    text = p.read_text(encoding='utf-8', errors='ignore')
    n = len(re.findall(r'\buseState\(', text))
    if n >= 10:
        heavy_state_pages.append((p.relative_to(root).as_posix(), n))
heavy_state_pages.sort(key=lambda x: -x[1])

app_useapp = 0
for p in files:
    text = p.read_text(encoding='utf-8', errors='ignore')
    app_useapp += len(re.findall(r'App\.useApp\(\)', text))

mock_files = list(root.rglob('*mock*'))

result = {
    'files_total': sum(by_dir.values()),
    'files_by_dir': dict(by_dir.most_common()),
    'largest_files': sizes[:20],
    'hook_usage_top': hook_usage.most_common(20),
    'state_usage': dict(state_usage),
    'routes_in_App': route_count,
    'antd_files': sum(antd_imports.values()),
    'antd_message_calls': antd_message_use,
    'App_useapp_calls': app_useapp,
    'window_uses': window_uses,
    'heavy_state_pages': heavy_state_pages,
    'mock_files': [m.relative_to(root).as_posix() for m in mock_files],
}
print(json.dumps(result, ensure_ascii=False, indent=2))
