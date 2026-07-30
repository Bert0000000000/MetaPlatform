import pathlib
p = pathlib.Path('apps/web/src/pages/agents/AgentsListPage.tsx')
text = p.read_text(encoding='utf-8-sig', errors='ignore')
if 'MOCK_AGENTS' in text:
    new = text.replace('{MOCK_AGENTS.length + 6}', '{6}')
    p.write_text(new, encoding='utf-8')
    print('FIXED')
