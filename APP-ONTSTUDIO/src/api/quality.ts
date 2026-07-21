import { get, post } from './client';
import type {
  PageResponse,
  QualityDimension,
  QualityIssue,
  QualityIssueStatus,
  QualityOverview,
  QualityRule,
  QualitySeverity,
} from '@/types';

// ============ 标签与选项（保留前端 UI 使用） ============

const DIMENSION_LABELS: Record<QualityDimension, string> = {
  completeness: '完整性',
  accuracy: '准确性',
  consistency: '一致性',
  timeliness: '及时性',
  uniqueness: '唯一性',
  validity: '有效性',
};

const SEVERITY_LABELS: Record<QualitySeverity, string> = {
  info: '提示',
  warning: '警告',
  critical: '严重',
};

const STATUS_LABELS: Record<QualityIssueStatus, string> = {
  open: '待处理',
  resolved: '已解决',
  ignored: '已忽略',
};

export const QUALITY_DIMENSION_OPTIONS = Object.entries(DIMENSION_LABELS).map(([value, label]) => ({
  value: value as QualityDimension,
  label,
}));

export const QUALITY_SEVERITY_OPTIONS = Object.entries(SEVERITY_LABELS).map(([value, label]) => ({
  value: value as QualitySeverity,
  label,
}));

export const QUALITY_STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({
  value: value as QualityIssueStatus,
  label,
}));

export function getDimensionLabel(d: QualityDimension): string {
  return DIMENSION_LABELS[d] ?? d;
}

export function getSeverityLabel(s: QualitySeverity): string {
  return SEVERITY_LABELS[s] ?? s;
}

export function getStatusLabel(s: QualityIssueStatus): string {
  return STATUS_LABELS[s] ?? s;
}

// ============ V11-01: 后端字段映射 ============
//
// 后端 QualityRule 字段（ruleType/severity/table/column/id）↔ 前端 QualityRule 字段（dimension/severity/conceptId/attributeId/ruleId）
// 后端 severity: LOW/MEDIUM/HIGH/CRITICAL ↔ 前端 severity: info/warning/critical
// 后端 ruleType: not_null/unique/range/enum/pattern/custom_sql ↔ 前端 dimension: completeness/uniqueness/validity/accuracy

const RULE_TYPE_TO_DIMENSION: Record<string, QualityDimension> = {
  not_null: 'completeness',
  unique: 'uniqueness',
  range: 'validity',
  enum: 'validity',
  pattern: 'validity',
  custom_sql: 'accuracy',
};

const SEVERITY_TO_ISSUE: Record<string, QualitySeverity> = {
  LOW: 'info',
  MEDIUM: 'warning',
  HIGH: 'critical',
  CRITICAL: 'critical',
};

interface QualityRuleBackend {
  id: string;
  tenantId?: string;
  name: string;
  table: string;
  column?: string | null;
  ruleType: string;
  params?: Record<string, unknown> | null;
  severity: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

function normalizeRule(raw: QualityRuleBackend): QualityRule {
  const params = (raw.params ?? {}) as Record<string, unknown>;
  const expression =
    (typeof params.expression === 'string' && params.expression) ||
    (typeof params.description === 'string' && params.description) ||
    `${raw.ruleType}(${raw.column || '*'})`;
  const description =
    (typeof params.description === 'string' && params.description) || '';
  return {
    ruleId: raw.id,
    name: raw.name,
    dimension: RULE_TYPE_TO_DIMENSION[raw.ruleType] ?? 'validity',
    description,
    conceptId: raw.table, // V1.1: table 兼容 conceptId
    attributeId: raw.column ?? undefined, // V1.1: column 兼容 attributeId
    expression,
    severity: SEVERITY_TO_ISSUE[raw.severity] ?? 'warning',
    enabled: raw.enabled,
  };
}

interface QualityIssueBackend {
  issueId: string;
  ruleId: string;
  ruleName: string;
  dimension: string;
  severity: string;
  status: string;
  conceptId: string;
  conceptName?: string | null;
  attributeId?: string | null;
  attributeName?: string | null;
  entityId?: string | null;
  entityName?: string | null;
  message: string;
  detectedAt: string;
  resolvedAt?: string | null;
  suggestion?: string | null;
}

function normalizeIssue(raw: QualityIssueBackend): QualityIssue {
  return {
    issueId: raw.issueId,
    ruleId: raw.ruleId,
    ruleName: raw.ruleName,
    dimension: raw.dimension as QualityDimension,
    severity: raw.severity as QualitySeverity,
    status: raw.status as QualityIssueStatus,
    conceptId: raw.conceptId,
    conceptName: raw.conceptName ?? undefined,
    attributeId: raw.attributeId ?? undefined,
    attributeName: raw.attributeName ?? undefined,
    entityId: raw.entityId ?? undefined,
    entityName: raw.entityName ?? undefined,
    message: raw.message,
    detectedAt: raw.detectedAt,
    resolvedAt: raw.resolvedAt ?? undefined,
    suggestion: raw.suggestion ?? undefined,
  };
}

interface QualityScoreCardBackend {
  dimension: string;
  score: number;
  issueCount: number;
  trend: number;
}

interface QualityOverviewBackend {
  overallScore: number;
  totalRules: number;
  enabledRules: number;
  totalIssues: number;
  openIssues: number;
  criticalIssues: number;
  lastRunAt?: string | null;
  scores: QualityScoreCardBackend[];
}

function normalizeOverview(raw: QualityOverviewBackend): QualityOverview {
  return {
    overallScore: raw.overallScore,
    totalRules: raw.totalRules,
    enabledRules: raw.enabledRules,
    totalIssues: raw.totalIssues,
    openIssues: raw.openIssues,
    criticalIssues: raw.criticalIssues,
    lastRunAt: raw.lastRunAt ?? undefined,
    scores: (raw.scores ?? []).map((s) => ({
      dimension: s.dimension as QualityDimension,
      score: s.score,
      issueCount: s.issueCount,
      trend: s.trend,
    })),
  };
}

// ============ API 调用 ============

/**
 * 获取数据质量概览。
 * 后端路径：GET /v1/data/quality/overview
 */
export async function getQualityOverview(): Promise<QualityOverview> {
  const raw = await get<QualityOverviewBackend>('/v1/data/quality/overview');
  return normalizeOverview(raw);
}

/**
 * 获取质量问题列表。
 * 后端路径：GET /v1/data/quality/issues?status=...&dimension=...&severity=...&conceptId=...
 */
export async function getQualityIssues(filter?: {
  status?: QualityIssueStatus;
  dimension?: QualityDimension;
  severity?: QualitySeverity;
  conceptId?: string;
}): Promise<QualityIssue[]> {
  const res = await get<PageResponse<QualityIssueBackend>>(
    '/v1/data/quality/issues',
    filter as Record<string, unknown> | undefined,
  );
  return (res?.items ?? []).map(normalizeIssue);
}

/**
 * 获取质量规则列表。
 * 后端路径：GET /v1/data/quality/rules
 */
export async function getQualityRules(): Promise<QualityRule[]> {
  const res = await get<PageResponse<QualityRuleBackend>>('/v1/data/quality/rules');
  return (res?.items ?? []).map(normalizeRule);
}

/**
 * 触发质量检测任务（同步返回执行结果）。
 * 后端路径：POST /v1/data/quality/run
 */
export async function runQualityCheck(conceptId?: string): Promise<{
  jobId: string;
  startedAt: string;
  status?: string;
  totalRules?: number;
  failedCount?: number;
  issuesGenerated?: number;
  finishedAt?: string;
}> {
  return await post('/v1/data/quality/run', conceptId ? { conceptId } : {});
}

/**
 * 更新问题状态（手动解决/忽略）。
 * 后端路径：POST /v1/data/quality/issues/{id}/status
 */
export async function updateIssueStatus(
  issueId: string,
  status: QualityIssueStatus,
): Promise<QualityIssue> {
  const raw = await post<QualityIssueBackend>(
    `/v1/data/quality/issues/${issueId}/status`,
    { status },
  );
  return normalizeIssue(raw);
}
