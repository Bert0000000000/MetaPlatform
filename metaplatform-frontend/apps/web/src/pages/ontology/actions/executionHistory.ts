/**
 * Action 编排执行历史 seed data.
 * 临时从原 OntologyActionPage 抽出。后端就绪后由 /api/v1/superai/actions/executions 替换。
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
  { trigger: 'API 调用', time: '07-23 14:32:08', input: '{user_id: 12345}', output: '{success: true}', duration: '234ms', status: 'success' },
  { trigger: 'API 调用', time: '07-23 14:30:15', input: '{user_id: 12344}', output: '{success: true}', duration: '189ms', status: 'success' },
  { trigger: '定时触发', time: '07-23 14:28:42', input: '{user_id: 12343}', output: '{error: ...}', duration: '1.2s', status: 'failed' },
  { trigger: '定时调度', time: '07-23 14:25:00', input: 'batch_id: 8921', output: '{success: true}', duration: '5.4s', status: 'success' },
];
