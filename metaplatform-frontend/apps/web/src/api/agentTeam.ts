import { get, post } from './client';
import type { Evidence } from './superai/types';

/**
 * Agent 产品层 —— 超级大脑 + 数字员工。
 *
 * 契约：mate-platform-backend/contracts/openapi/services/agent-team.yaml
 * 服务：mate-tech-agent-team（/api/v1/agent-team/*）
 *
 * 本页只做**读**：提交一句话、看任务图与各员工状态、翻证据与交付物、点一次
 * 人工确认。不写任何前端本地拼装——没拿到就是没拿到。
 *
 * 证据的类型直接用 SuperAI 那一套 `Evidence`（见 `api/superai/types`）：
 * agent-team 产出的是**同一种形状**的条目，前端因此只认一套字段、只用一个
 * 渲染组件。
 */

export interface SubTask {
  task_id: string;
  profile_id: string;
  instruction: string;
  depends_on: string[];
}

/** 一件可寻址的产出物（元数据）。正文走 `GET /artifacts/{id}` 另取。 */
export interface Artifact {
  artifact_id: string;
  run_id: string;
  task_id: string;
  profile_id: string;
  /** 产出物种类（当前只有 report）。 */
  kind: string;
  title: string;
  content_type: string;
  /** 正文的字节数。 */
  size: number;
  created_at: string;
}

export interface ArtifactContent extends Artifact {
  content: string;
}

export interface SubTaskResult {
  task_id: string;
  team_task_id: string;
  profile_id: string;
  status: 'ok' | 'error' | 'rejected';
  output: string;
  tool_calls: Array<Record<string, unknown>>;
  llm_calls: number;
  source: string;
  error: string;
  /** 可判定的失败类别（越权待授权 / 硬拒 / 重试用尽）。 */
  error_code: string;
  /** 越权时的人审提案。 */
  proposal: Record<string, unknown>;
  /** 真正发起的运行时调用次数（含重试）。 */
  attempts: number;
  /** 该员工工具调用结果映射出的结构化证据。 */
  evidence: Evidence[];
  /** 该员工产出的可寻址交付物（元数据）。 */
  artifacts: Artifact[];
}

export type RunStatus =
  | 'planning'
  | 'running'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

export interface RunState {
  run_id: string;
  tenant_id: string;
  goal: string;
  status: RunStatus;
  subtasks: SubTask[];
  results: Record<string, SubTaskResult>;
  summary: string;
  hitl_reason: string;
  error: string;
  /** 本轮实际生效的运行级超时（秒；0 = 不设超时）。 */
  timeout_seconds: number;
  /** 本轮截止的绝对时刻（epoch 秒；0 = 无截止）。 */
  deadline_at: number;
}

/**
 * 一轮运行的接口是**同步**的：`POST /runs` 要等拆解 + 并行派活跑完才回话
 * （实测约 60s，员工多/工具多时更长），远超客户端默认的 30s。给这几个
 * 长跑端点单独放宽，不动全局默认值。
 */
const RUN_TIMEOUT_MS = 300_000;

export async function startRun(goal: string, maxParallel = 3): Promise<RunState> {
  return post<RunState>('/agent-team/runs', { goal, max_parallel: maxParallel }, RUN_TIMEOUT_MS);
}

export async function getRun(runId: string): Promise<RunState> {
  return get<RunState>(`/agent-team/runs/${runId}`);
}

export async function approveRun(runId: string, approved = true): Promise<RunState> {
  return post<RunState>(`/agent-team/runs/${runId}/approve`, { approved }, RUN_TIMEOUT_MS);
}

export async function cancelRun(runId: string): Promise<RunState> {
  // 取消会**等图在节点边界停下**再回话（1.5 任务 1），同样不是瞬时返回。
  return post<RunState>(`/agent-team/runs/${runId}/cancel`, {}, RUN_TIMEOUT_MS);
}

/** 一轮运行的全部产出物（元数据；正文按 id 另取）。 */
export async function listRunArtifacts(runId: string): Promise<Artifact[]> {
  const page = await get<{ items: Artifact[] }>(`/agent-team/runs/${runId}/artifacts`);
  return page.items ?? [];
}

/** 按 id 取回产出物正文——"可寻址、可取回"的取回那半边。 */
export async function getArtifact(artifactId: string): Promise<ArtifactContent> {
  return get<ArtifactContent>(`/agent-team/artifacts/${artifactId}`);
}
