import { get, post } from './client';
import type { QualityOverview, QualityIssue, QualityRule, QualitySeverity, QualityDimension, QualityIssueStatus } from '@/types';

const RULES_CACHE_KEY = 'mate_platform_quality_rules';
const ISSUES_CACHE_KEY = 'mate_platform_quality_issues';
const OVERVIEW_CACHE_KEY = 'mate_platform_quality_overview';

function readLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

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

/** 默认质量概览（后端不可用时使用） */
const DEFAULT_OVERVIEW: QualityOverview = {
  overallScore: 82,
  totalRules: 18,
  enabledRules: 15,
  totalIssues: 27,
  openIssues: 12,
  criticalIssues: 3,
  lastRunAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
  scores: [
    { dimension: 'completeness', score: 92, issueCount: 4, trend: 2 },
    { dimension: 'accuracy', score: 85, issueCount: 6, trend: -1 },
    { dimension: 'consistency', score: 78, issueCount: 8, trend: 0 },
    { dimension: 'timeliness', score: 88, issueCount: 3, trend: 5 },
    { dimension: 'uniqueness', score: 95, issueCount: 2, trend: 1 },
    { dimension: 'validity', score: 71, issueCount: 4, trend: -3 },
  ],
};

/** 默认质量规则（后端不可用时使用） */
const DEFAULT_RULES: QualityRule[] = [
  {
    ruleId: 'qr-001',
    name: '客户名称必填',
    dimension: 'completeness',
    description: '客户概念下的所有实体必须填写 name 属性',
    conceptId: 'concept-customer',
    attributeId: 'attr-name',
    expression: 'name IS NOT NULL AND name != ""',
    severity: 'critical',
    enabled: true,
  },
  {
    ruleId: 'qr-002',
    name: '合同金额非负',
    dimension: 'validity',
    description: '合同的 amount 字段必须 >= 0',
    conceptId: 'concept-contract',
    attributeId: 'attr-amount',
    expression: 'amount >= 0',
    severity: 'critical',
    enabled: true,
  },
  {
    ruleId: 'qr-003',
    name: '订单状态枚举校验',
    dimension: 'validity',
    description: '订单状态必须为 草稿/执行中/已完成/已取消 之一',
    conceptId: 'concept-order',
    attributeId: 'attr-status',
    expression: 'status IN ("草稿","执行中","已完成","已取消")',
    severity: 'warning',
    enabled: true,
  },
  {
    ruleId: 'qr-004',
    name: '客户等级一致性',
    dimension: 'consistency',
    description: '客户等级在 CRM 与 ERP 系统中必须一致',
    conceptId: 'concept-customer',
    attributeId: 'attr-level',
    expression: 'crm.level == erp.level',
    severity: 'warning',
    enabled: true,
  },
  {
    ruleId: 'qr-005',
    name: '订单金额与合同一致性',
    dimension: 'consistency',
    description: '订单 totalAmount 不能超过关联合同的 amount',
    conceptId: 'concept-order',
    expression: 'order.totalAmount <= contract.amount',
    severity: 'critical',
    enabled: true,
  },
  {
    ruleId: 'qr-006',
    name: '客户编码唯一',
    dimension: 'uniqueness',
    description: '客户 customerId 必须全局唯一',
    conceptId: 'concept-customer',
    attributeId: 'attr-customer-id',
    expression: 'COUNT(customerId) == COUNT(DISTINCT customerId)',
    severity: 'critical',
    enabled: true,
  },
  {
    ruleId: 'qr-007',
    name: '回款日期不早于合同签订日',
    dimension: 'timeliness',
    description: '回款的 payDate 必须 >= 合同 signDate',
    conceptId: 'concept-payment',
    expression: 'payment.payDate >= contract.signDate',
    severity: 'warning',
    enabled: false,
  },
];

/** 默认质量问题（后端不可用时使用） */
function buildDefaultIssues(): QualityIssue[] {
  const now = Date.now();
  return [
    {
      issueId: 'qi-001',
      ruleId: 'qr-002',
      ruleName: '合同金额非负',
      dimension: 'validity',
      severity: 'critical',
      status: 'open',
      conceptId: 'concept-contract',
      conceptName: '合同',
      attributeName: 'amount',
      entityId: 'inst-ct-001',
      entityName: '2026年度技术服务合同',
      message: 'amount = -5000，违反非负约束',
      detectedAt: new Date(now - 1000 * 60 * 60 * 2).toISOString(),
      suggestion: '请核查金额录入是否有误，或与业务方确认是否为退款场景',
    },
    {
      issueId: 'qi-002',
      ruleId: 'qr-005',
      ruleName: '订单金额与合同一致性',
      dimension: 'consistency',
      severity: 'critical',
      status: 'open',
      conceptId: 'concept-order',
      conceptName: '订单',
      entityId: 'inst-o-001',
      entityName: 'PO-20260718-001',
      message: '订单 totalAmount=35000，但关联合同 amount=120000（应为父合同分摊值），需复核分摊规则',
      detectedAt: new Date(now - 1000 * 60 * 90).toISOString(),
      suggestion: '检查订单与合同的分摊逻辑，或调整 rule-005 表达式以支持分摊场景',
    },
    {
      issueId: 'qi-003',
      ruleId: 'qr-003',
      ruleName: '订单状态枚举校验',
      dimension: 'validity',
      severity: 'warning',
      status: 'open',
      conceptId: 'concept-order',
      conceptName: '订单',
      attributeName: 'status',
      entityId: 'inst-o-002',
      entityName: 'PO-20260718-002',
      message: 'status = "已完成 "（含尾部空格），不在枚举范围内',
      detectedAt: new Date(now - 1000 * 60 * 60 * 5).toISOString(),
      suggestion: '数据清洗时去除前后空格，建议在映射配置中增加 trim 转换',
    },
    {
      issueId: 'qi-004',
      ruleId: 'qr-001',
      ruleName: '客户名称必填',
      dimension: 'completeness',
      severity: 'critical',
      status: 'open',
      conceptId: 'concept-customer',
      conceptName: '客户',
      attributeName: 'name',
      entityId: 'inst-c-003',
      entityName: '(未命名客户)',
      message: 'name 为空',
      detectedAt: new Date(now - 1000 * 60 * 60 * 8).toISOString(),
      suggestion: '检查上游数据源是否缺失该字段，或设置默认值 "未知客户"',
    },
    {
      issueId: 'qi-005',
      ruleId: 'qr-004',
      ruleName: '客户等级一致性',
      dimension: 'consistency',
      severity: 'warning',
      status: 'open',
      conceptId: 'concept-customer',
      conceptName: '客户',
      attributeName: 'level',
      entityId: 'inst-c-002',
      entityName: '上海远方贸易',
      message: 'CRM.level=B，ERP.level=A，存在不一致',
      detectedAt: new Date(now - 1000 * 60 * 60 * 24).toISOString(),
      suggestion: '与业务方确认客户等级权威数据源，建议以 CRM 为准',
    },
    {
      issueId: 'qi-006',
      ruleId: 'qr-006',
      ruleName: '客户编码唯一',
      dimension: 'uniqueness',
      severity: 'critical',
      status: 'resolved',
      conceptId: 'concept-customer',
      conceptName: '客户',
      attributeName: 'customerId',
      message: '发现 2 条 customerId 重复记录，已合并去重',
      detectedAt: new Date(now - 1000 * 60 * 60 * 30).toISOString(),
      resolvedAt: new Date(now - 1000 * 60 * 60 * 12).toISOString(),
      suggestion: '已开启唯一性约束，后续重复记录将被拦截',
    },
    {
      issueId: 'qi-007',
      ruleId: 'qr-007',
      ruleName: '回款日期不早于合同签订日',
      dimension: 'timeliness',
      severity: 'warning',
      status: 'ignored',
      conceptId: 'concept-payment',
      conceptName: '回款',
      message: '检测到 1 条回款日期早于合同签订日，业务确认为预付款场景，已忽略',
      detectedAt: new Date(now - 1000 * 60 * 60 * 48).toISOString(),
      resolvedAt: new Date(now - 1000 * 60 * 60 * 40).toISOString(),
      suggestion: '考虑在规则表达式中增加 isPrepaid 标记豁免',
    },
  ];
}

/**
 * 获取数据质量概览。
 * 后端路径：GET /v1/data/quality/overview（若未实现则降级）。
 */
export async function getQualityOverview(): Promise<QualityOverview> {
  try {
    const overview = await get<QualityOverview>('/v1/data/quality/overview');
    if (overview) {
      writeLocal(OVERVIEW_CACHE_KEY, overview);
      return overview;
    }
    throw new Error('Empty overview');
  } catch {
    const cached = readLocal<QualityOverview>(OVERVIEW_CACHE_KEY);
    return cached ?? DEFAULT_OVERVIEW;
  }
}

/**
 * 获取质量问题列表。
 * 后端路径：GET /v1/data/quality/issues?status=...&dimension=...&severity=...
 */
export async function getQualityIssues(filter?: {
  status?: QualityIssueStatus;
  dimension?: QualityDimension;
  severity?: QualitySeverity;
  conceptId?: string;
}): Promise<QualityIssue[]> {
  try {
    const issues = await get<QualityIssue[]>('/v1/data/quality/issues', filter as Record<string, unknown> | undefined);
    if (issues && Array.isArray(issues)) {
      writeLocal(ISSUES_CACHE_KEY, issues);
      return issues;
    }
    throw new Error('Empty issues');
  } catch {
    const cached = readLocal<QualityIssue[]>(ISSUES_CACHE_KEY);
    const base = cached ?? buildDefaultIssues();
    if (!filter) return base;
    return base.filter((i) => {
      if (filter.status && i.status !== filter.status) return false;
      if (filter.dimension && i.dimension !== filter.dimension) return false;
      if (filter.severity && i.severity !== filter.severity) return false;
      if (filter.conceptId && i.conceptId !== filter.conceptId) return false;
      return true;
    });
  }
}

/**
 * 获取质量规则列表。
 * 后端路径：GET /v1/data/quality/rules
 */
export async function getQualityRules(): Promise<QualityRule[]> {
  try {
    const rules = await get<QualityRule[]>('/v1/data/quality/rules');
    if (rules && Array.isArray(rules)) {
      writeLocal(RULES_CACHE_KEY, rules);
      return rules;
    }
    throw new Error('Empty rules');
  } catch {
    const cached = readLocal<QualityRule[]>(RULES_CACHE_KEY);
    return cached ?? DEFAULT_RULES;
  }
}

/**
 * 触发质量检测任务（异步）。
 * 后端路径：POST /v1/data/quality/run
 */
export async function runQualityCheck(conceptId?: string): Promise<{ jobId: string; startedAt: string }> {
  try {
    return await post<{ jobId: string; startedAt: string }>('/v1/data/quality/run', conceptId ? { conceptId } : {});
  } catch {
    // Best-effort: 模拟任务已启动
    return { jobId: `local-${Date.now()}`, startedAt: new Date().toISOString() };
  }
}

/**
 * 更新问题状态（手动解决/忽略）。
 * 后端路径：POST /v1/data/quality/issues/{id}/status
 */
export async function updateIssueStatus(
  issueId: string,
  status: QualityIssueStatus,
): Promise<QualityIssue> {
  try {
    return await post<QualityIssue>(`/v1/data/quality/issues/${issueId}/status`, { status });
  } catch {
    // Best-effort: 同步更新本地缓存
    const cached = readLocal<QualityIssue[]>(ISSUES_CACHE_KEY) ?? buildDefaultIssues();
    const updated = cached.map((i) =>
      i.issueId === issueId
        ? { ...i, status, resolvedAt: status === 'resolved' ? new Date().toISOString() : i.resolvedAt }
        : i,
    );
    writeLocal(ISSUES_CACHE_KEY, updated);
    const found = updated.find((i) => i.issueId === issueId);
    if (!found) throw new Error(`Issue ${issueId} not found`);
    return found;
  }
}
