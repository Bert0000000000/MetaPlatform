// AI Agent 回归指标 API 封装（ONT-AGENT-METRICS-01，只读）。
// 后端：mate_tech_ont/v2_kernel/agent_metrics.py（FastAPI response_model 直接返回，
// 无 data 信封；apiClient baseURL=/api/v1，v2 kernel 前缀 /ont/v2）。
//
// 判定口径（与后端 docstring ⑤ 对齐，GovernancePage 展示层直接复用）：
//   accepted = executed + reverted（曾被用户采纳落地）；
//   acceptance_rate = accepted / (accepted + rejected)，分母 0 → null（不编造）；
//   pending / confirmed（在途）与 withdrawn（自撤）不入分母；
//   rejection_reasons = null 表示后端无原因字段（维度缺失），[] 表示窗口内无驳回。

import { apiClient } from '@/api/client';

const v2 = (path: string) => `/ont/v2${path}`;

/** 驳回原因分布桶（后端开始记录 reason 字段后才会非 null 且非空）。 */
export interface AgentRejectionReason {
  reason: string;
  count: number;
}

/** 按提议方（created_by，缺失落 "(unattributed)"）聚合行。 */
export interface AgentActorSummary {
  actor: string;
  proposed: number;
  executed: number;
  /** accepted / (accepted + rejected)；分母 0 → null。 */
  acceptance_rate: number | null;
}

/**
 * GET /agent-metrics/summary 响应。
 * by_status 键：pending / confirmed / rejected / executed / withdrawn / reverted
 * （六合法值恒初始化为 0；未知历史值原样保留），读取用 `by_status[key] ?? 0`。
 */
export interface AgentMetricsSummary {
  total: number;
  by_status: Record<string, number>;
  acceptance_rate: number | null;
  rejection_reasons: AgentRejectionReason[] | null;
  by_actor: AgentActorSummary[];
  window_days: number;
}

/** GET /agent-metrics/trend 响应行（UTC 日历日连续零填充；days=N 最多 N+1 桶）。 */
export interface AgentMetricsTrendPoint {
  /** YYYY-MM-DD（UTC）。 */
  date: string;
  proposed: number;
  executed: number;
  rejected: number;
}

/** Agent proposal 回归汇总（默认窗口 30 天，后端收敛到 [1, 365]）。 */
export async function getAgentMetricsSummary(days = 30): Promise<AgentMetricsSummary> {
  const resp = await apiClient.get(v2('/agent-metrics/summary'), { params: { days } });
  return resp.data as AgentMetricsSummary;
}

/** Agent proposal 按天趋势：{date, proposed, executed, rejected}。 */
export async function getAgentMetricsTrend(days = 30): Promise<AgentMetricsTrendPoint[]> {
  const resp = await apiClient.get(v2('/agent-metrics/trend'), { params: { days } });
  return resp.data as AgentMetricsTrendPoint[];
}
