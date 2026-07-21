import { get, post } from './client';
import type {
  AutoScoreResult,
  DimensionScore,
  EvaluationReportDetail,
  GenerateSuggestionsRequest,
  GenerateSuggestionsResponse,
  OptimizationSuggestion,
  ScoringRubric,
} from '@/types';

/**
 * V11-04: 所有评估相关 API 已后端化，路径统一挂在 /v1/agent/evaluations/* 下。
 * 后端为 TECH-AGENT app/evaluation 模块（service + api/v1/evaluation.py）。
 * 已彻底移除 mock 兜底（mockAutoScoreResult / mockSuggestions / mockReportDetail / DEFAULT_RUBRIC）。
 *
 * V11-06: 新增 aggregateReport，承载多员工协作结果聚合。
 * APP-DW ResultAggregator 不再走 collaborations/aggregate 兜底（该端点此前在后端不存在）。
 */

export interface ConversationRecord {
  conversationId: string;
  employeeId: string;
  taskId: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'tool';
    content: string;
    toolCall?: { name: string; args: Record<string, unknown>; result?: unknown };
    timestamp: string;
  }>;
  qualityScore?: number;
  evaluatedBy?: string;
  evaluatedAt?: string;
  createdAt: string;
}

export interface EvaluationReport {
  reportId: string;
  employeeId: string;
  period: string;
  totalTasks: number;
  avgQualityScore: number;
  successRate: number;
  avgDuration: number;
  highlights: string[];
  issues: string[];
  createdAt: string;
}

const BASE = '/v1/agent/evaluations';

export async function listConversations(employeeId?: string): Promise<ConversationRecord[]> {
  return get<ConversationRecord[]>(`${BASE}/conversations`, { employeeId });
}

export async function getConversation(id: string): Promise<ConversationRecord> {
  return get<ConversationRecord>(`${BASE}/conversations/${id}`);
}

export async function scoreConversation(
  id: string,
  score: number,
  evaluatedBy: string,
): Promise<ConversationRecord> {
  // 后端返回 AutoScoreResult（含 dimensions），但旧调用方期望 ConversationRecord。
  // 这里返回后端原始 payload，调用方按需读取字段。
  return post<ConversationRecord>(`${BASE}/conversations/${id}/score`, { score, evaluatedBy });
}

export async function generateReport(employeeId: string, period: string): Promise<EvaluationReport> {
  return post<EvaluationReport>(`${BASE}/reports/generate`, { employeeId, period });
}

export async function listReports(employeeId?: string): Promise<EvaluationReport[]> {
  return get<EvaluationReport[]>(`${BASE}/reports`, { employeeId });
}

export async function getQualityTrend(employeeId: string): Promise<Array<{
  date: string;
  score: number;
}>> {
  return get<Array<{ date: string; score: number }>>(`${BASE}/reports/quality-trend`, { employeeId });
}

export async function saveConversation(conv: ConversationRecord): Promise<void> {
  return post<void>(`${BASE}/conversations`, conv);
}

// ============ V12-09 效果评估自动化（V11-04 已后端化） ============

/**
 * 单条对话自动评分。
 */
export async function autoScoreConversation(
  conversationId: string,
  rubricId?: string,
): Promise<AutoScoreResult> {
  return post<AutoScoreResult>(
    `${BASE}/conversations/${conversationId}/auto-score`,
    rubricId ? { rubricId } : {},
  );
}

/**
 * 批量自动评分。
 */
export async function batchAutoScore(
  employeeId: string,
  filter?: { period?: string; limit?: number },
): Promise<{ total: number; scored: number; results: AutoScoreResult[] }> {
  return post<{ total: number; scored: number; results: AutoScoreResult[] }>(
    `${BASE}/conversations/batch-auto-score`,
    { employeeId, ...filter },
  );
}

/**
 * 生成优化建议。
 */
export async function generateSuggestions(
  req: GenerateSuggestionsRequest,
): Promise<GenerateSuggestionsResponse> {
  return post<GenerateSuggestionsResponse>(`${BASE}/suggestions/generate`, req);
}

/**
 * 列出已生成的优化建议。
 */
export async function listSuggestions(
  employeeId: string,
  filter?: { period?: string },
): Promise<OptimizationSuggestion[]> {
  return get<OptimizationSuggestion[]>(`${BASE}/suggestions`, { employeeId, ...filter });
}

/**
 * 获取评估报告详情（含维度评分与优化建议）。
 */
export async function getReportDetail(reportId: string): Promise<EvaluationReportDetail> {
  return get<EvaluationReportDetail>(`${BASE}/reports/${reportId}`);
}

/**
 * 列出评分规则。
 */
export async function listScoringRubrics(): Promise<ScoringRubric[]> {
  return get<ScoringRubric[]>(`${BASE}/rubrics`);
}

/**
 * 保存评分规则。
 */
export async function saveScoringRubric(rubric: ScoringRubric): Promise<ScoringRubric> {
  return post<ScoringRubric>(`${BASE}/rubrics`, rubric);
}

// ============ V11-06 多员工协作报告聚合 ============

export interface AggregateReportRequest {
  /** 关联的协作任务 ID（可选，用于回填报告上下文） */
  collaborationId?: string;
  /** 参与协作的员工 ID 列表，至少 1 个 */
  employeeIds: string[];
  /** 周期标识，如 '2026-W28'（可选） */
  period?: string;
}

export interface AggregateReportResponse {
  collaborationId?: string;
  employeeIds: string[];
  totalEmployees: number;
  totalConversations: number;
  avgQualityScore: number;
  successRate: number;
  dimensions: DimensionScore[];
  highlights: string[];
  issues: string[];
  /** Markdown 渲染的聚合报告，供 ResultAggregator 直接展示 */
  report: string;
  generatedAt: string;
}

/**
 * 多员工协作报告聚合（V11-06）。
 *
 * 后端：POST /api/v1/agent/evaluations/aggregate-report
 * 入参为协作任务下的员工 ID 列表，返回跨员工的维度聚合 + Markdown 报告。
 */
export async function aggregateReport(
  req: AggregateReportRequest,
): Promise<AggregateReportResponse> {
  return post<AggregateReportResponse>(`${BASE}/aggregate-report`, req);
}
