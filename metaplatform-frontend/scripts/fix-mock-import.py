import pathlib
files = [
    'apps/web/src/pages/agents/AgentsCollabPage.tsx',
    'apps/web/src/pages/agents/AgentsDetailPage.tsx',
    'apps/web/src/pages/agents/AgentsEvaluationPage.tsx',
    'apps/web/src/pages/agents/AgentsKnowledgePage.tsx',
    'apps/web/src/pages/agents/AgentsListPage.tsx',
    'apps/web/src/pages/agents/AgentsTasksPage.tsx',
]
for f in files:
    p = pathlib.Path(f)
    text = p.read_text(encoding='utf-8-sig', errors='ignore')
    if 'MOCK_AGENTS' in text:
        new = text.replace(chr(10) + 'import { MOCK_AGENTS } from ' + chr(39) + '@/mock' + chr(39) + '; // MOCK', '')
        if new != text:
            p.write_text(new, encoding='utf-8')
            print('FIXED', f)
        else:
            print('NO_CHG', f)
    else:
        print('NOP', f)
