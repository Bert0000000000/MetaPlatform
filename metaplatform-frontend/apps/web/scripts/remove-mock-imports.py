import pathlib

files = [
    'apps/web/src/pages/agents/AgentsCollabPage.tsx',
    'apps/web/src/pages/agents/AgentsDetailPage.tsx',
    'apps/web/src/pages/agents/AgentsEvaluationPage.tsx',
    'apps/web/src/pages/agents/AgentsKnowledgePage.tsx',
    'apps/web/src/pages/agents/AgentsListPage.tsx',
    'apps/web/src/pages/agents/AgentsTasksPage.tsx',
    'apps/web/src/pages/ontology/OntologyGraphPage.tsx',
    'apps/web/src/pages/ontology/OntologyModelingPage.tsx',
    'apps/web/src/api/ontology-bigdata.ts',
]

mock_import_agents = "import { MOCK_AGENTS } from '@/mock'; // MOCK\n"
mock_import_ontology = "import { MOCK_ONTOLOGY_ENTITIES } from '@/mock'; // MOCK\n"
mock_import_data = "import { MOCK_BIGDATA_SOURCES, MOCK_CDC_TASKS, MOCK_ETL_TASKS, MOCK_SCHEDULER_TASKS, MOCK_METRICS } from '../mock/ontology-bigdata';\n"
hidden_span_old = '<span style={{ display: ' + "'" + 'none' + "'" + ' }}>{MOCK_ONTOLOGY_ENTITIES.length}</span>\n'

for f in files:
    p = pathlib.Path(f)
    if not p.exists():
        print('MISS', f)
        continue
    t = p.read_text(encoding='utf-8-sig')
    before = t
    t = t.replace(mock_import_data, '// MOCK_* removed; real API only\n')
    t = t.replace(mock_import_agents, '')
    t = t.replace(mock_import_ontology, '')
    t = t.replace(hidden_span_old, '')
    if t != before:
        p.write_text(t, encoding='utf-8')
        print('OK', f)
    else:
        print('SKIP', f)
