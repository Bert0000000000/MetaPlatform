import { get, post } from './client';

/**
 * Agent 产品层 1.0 —— 超级大脑 + 数字员工。
 *
 * 契约：mate-platform-backend/contracts/openapi/services/agent-team.yaml
 * 服务：mate-tech-agent-team（/api/v1/agent-team/*）
 *
 * 本页只做**读**：提交一句话、看任务图与各员工状态、点一次人工确认。不写任何
 * 前端本地拼装——没拿到就是没拿到。
 */

export interface SubTask {
  task_id: string;
  profile_id: string;
  instruction: string;
  depends_on: string[];
}

export interface SubTaskResult {
  task_id: string;
  profile_id: string;
  status: 'ok' | 'error' | 'rejected';
  output: string;
  tool_calls: Array<Record<string, unknown>>;
  llm_calls: number;
  source: string;
  error: string;
}

export interface RunState {
  run_id: string;
  tenant_id: string;
  goal: string;
  status: 'planning' | 'running' | 'awaiting_approval' | 'completed' | 'failed';
  subtasks: SubTask[];
  results: Record<string, SubTaskResult>;
  summary: string;
  hitl_reason: string;
  error: string;
}

export async function startRun(goal: string, maxParallel = 3): Promise<RunState> {
  return post<RunState>('/agent-team/runs', { goal, max_parallel: maxParallel });
}

export async function getRun(runId: string): Promise<RunState> {
  return get<RunState>(`/agent-team/runs/${runId}`);
}

export async function approveRun(runId: string, approved = true): Promise<RunState> {
  return post<RunState>(`/agent-team/runs/${runId}/approve`, { approved });
}
