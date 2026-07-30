import pathlib
p = pathlib.Path('apps/web/src/pages/ontology/actions/executionHistory.ts')
content = '''/**
 * Action ?????? seed data.
 * ???? OntologyActionPage ??. ?????? /api/v1/superai/actions/executions ??.
 */
export interface SeedExecution {
  trigger: string;
  time: string;
  input: string;
  output: string;
  duration: string;
  status: 'success' | 'failed';
}

export const SEED_EXECUTION_HISTORY: readonly SeedExecution[] = [
  { trigger: 'API ??', time: '07-23 14:32:08', input: '{user_id: 12345}', output: '{success: true}', duration: '234ms', status: 'success' },
  { trigger: 'API ??', time: '07-23 14:30:15', input: '{user_id: 12344}', output: '{success: true}', duration: '189ms', status: 'success' },
  { trigger: '????', time: '07-23 14:28:42', input: '{user_id: 12343}', output: '{error: ...}', duration: '1.2s', status: 'failed' },
  { trigger: '????', time: '07-23 14:25:00', input: 'batch_id: 8921', output: '{success: true}', duration: '5.4s', status: 'success' },
];
'''
p.write_text(content, encoding='utf-8')
print('OK', p)
