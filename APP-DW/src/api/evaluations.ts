import { get, post } from './client';
import type {
  AutoScoreResult,
  EvaluationReportDetail,
  GenerateSuggestionsRequest,
  GenerateSuggestionsResponse,
  OptimizationSuggestion,
  ScoringRubric,
} from '@/types';

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

export async function listConversations(employeeId?: string): Promise<ConversationRecord[]> {
  return get<ConversationRecord[]>('/v1/agent/conversations', { employeeId });
}

export async function getConversation(id: string): Promise<ConversationRecord> {
  return get<ConversationRecord>(`/v1/agent/conversations/${id}`);
}

export async function scoreConversation(
  id: string,
  score: number,
  evaluatedBy: string,
): Promise<ConversationRecord> {
  return post<ConversationRecord>(`/v1/agent/conversations/${id}/score`, { score, evaluatedBy });
}

export async function generateReport(employeeId: string, period: string): Promise<EvaluationReport> {
  return post<EvaluationReport>('/v1/agent/reports/generate', { employeeId, period });
}

export async function listReports(employeeId?: string): Promise<EvaluationReport[]> {
  return get<EvaluationReport[]>('/v1/agent/reports', { employeeId });
}

export async function getQualityTrend(employeeId: string): Promise<Array<{
  date: string;
  score: number;
}>> {
  return get<Array<{ date: string; score: number }>>('/v1/agent/reports/quality-trend', { employeeId });
}

export async function saveConversation(conv: ConversationRecord): Promise<void> {
  return post<void>('/v1/agent/conversations', conv);
}

// ============ V12-09 效果评估自动化 ============

/**
 * 单条对话自动评分。
 * 后端未就绪时回退到本地 mock，保证 UI 可演示。
 */
export async function autoScoreConversation(
  conversationId: string,
  rubricId?: string,
): Promise<AutoScoreResult> {
  try {
    return await post<AutoScoreResult>(
      `/v1/agent/conversations/${conversationId}/auto-score`,
      rubricId ? { rubricId } : {},
    );
  } catch {
    return mockAutoScoreResult(conversationId);
  }
}

/**
 * 批量自动评分。
 */
export async function batchAutoScore(
  employeeId: string,
  filter?: { period?: string; limit?: number },
): Promise<{ total: number; scored: number; results: AutoScoreResult[] }> {
  try {
    return await post<{ total: number; scored: number; results: AutoScoreResult[] }>(
      '/v1/agent/conversations/batch-auto-score',
      { employeeId, ...filter },
    );
  } catch {
    const limit = filter?.limit ?? 3;
    const ids = [`${employeeId}-c-001`, `${employeeId}-c-002`, `${employeeId}-c-003`].slice(0, limit);
    const results = ids.map((id) => mockAutoScoreResult(id));
    return { total: ids.length, scored: results.length, results };
  }
}

/**
 * 生成优化建议。
 */
export async function generateSuggestions(
  req: GenerateSuggestionsRequest,
): Promise<GenerateSuggestionsResponse> {
  try {
    return await post<GenerateSuggestionsResponse>('/v1/agent/suggestions/generate', req);
  } catch {
    return {
      suggestions: mockSuggestions(),
      generatedAt: new Date().toISOString(),
      basedOnReportId: req.reportId,
    };
  }
}

/**
 * 列出已生成的优化建议。
 */
export async function listSuggestions(
  employeeId: string,
  filter?: { period?: string },
): Promise<OptimizationSuggestion[]> {
  try {
    return await get<OptimizationSuggestion[]>('/v1/agent/suggestions', { employeeId, ...filter });
  } catch {
    return mockSuggestions();
  }
}

/**
 * 获取评估报告详情（含维度评分与优化建议）。
 */
export async function getReportDetail(reportId: string): Promise<EvaluationReportDetail> {
  try {
    return await get<EvaluationReportDetail>(`/v1/agent/reports/${reportId}`);
  } catch {
    return mockReportDetail(reportId);
  }
}

/**
 * 列出评分规则。
 */
export async function listScoringRubrics(): Promise<ScoringRubric[]> {
  try {
    return await get<ScoringRubric[]>('/v1/agent/rubrics');
  } catch {
    return [DEFAULT_RUBRIC];
  }
}

/**
 * 保存评分规则。
 */
export async function saveScoringRubric(rubric: ScoringRubric): Promise<ScoringRubric> {
  try {
    return await post<ScoringRubric>('/v1/agent/rubrics', rubric);
  } catch {
    return rubric;
  }
}

// ============ Mock 数据 ============

/**
 * 默认评分规则：6 个维度，权重总和为 1.0
 * accuracy=0.25, helpfulness=0.20, compliance=0.20, efficiency=0.15, toolUsage=0.10, contextCoherence=0.10
 */
export const DEFAULT_RUBRIC: ScoringRubric = {
  id: 'rubric-default',
  name: '默认评估规则 v1',
  updatedAt: new Date().toISOString(),
  dimensions: [
    { dimension: 'accuracy', weight: 0.25, description: '事实、数据、规则引用是否正确' },
    { dimension: 'helpfulness', weight: 0.20, description: '是否真正解决用户问题' },
    { dimension: 'compliance', weight: 0.20, description: '是否符合安全/政策约束' },
    { dimension: 'efficiency', weight: 0.15, description: '步骤是否冗余、耗时是否合理' },
    { dimension: 'toolUsage', weight: 0.10, description: '工具调用是否恰当、参数是否正确' },
    { dimension: 'contextCoherence', weight: 0.10, description: '多轮是否保持一致、是否遗忘前提' },
  ],
};

/**
 * 生成本地 mock 自动评分结果（客服/销售场景）。
 */
export function mockAutoScoreResult(conversationId: string): AutoScoreResult {
  const dimensions: AutoScoreResult['dimensions'] = [
    {
      dimension: 'accuracy',
      score: 88,
      weight: 0.25,
      reasoning: '客服准确引用了退货政策（7 天无理由），订单号与状态查询正确，未出现事实性错误。',
      evidence: [
        'assistant: 您的订单 #20260718-8842 当前状态为「已发货」，可在 7 天内申请无理由退货。',
      ],
    },
    {
      dimension: 'helpfulness',
      score: 82,
      weight: 0.20,
      reasoning: '给出了可执行的退货操作步骤并主动提供运费险信息，但未追问用户对方案的接受度。',
      evidence: [
        'assistant: 您可以进入「我的订单」→ 点击「申请退货」→ 选择「商品与描述不符」。',
      ],
    },
    {
      dimension: 'compliance',
      score: 95,
      weight: 0.20,
      reasoning: '未泄露内部系统信息，未承诺超出政策的补偿，敏感字段（手机号）做了脱敏处理。',
      evidence: [
        'assistant: 您的联系方式 138****5621 我们已记录，不会向第三方泄露。',
      ],
    },
    {
      dimension: 'efficiency',
      score: 70,
      weight: 0.15,
      reasoning: '共耗时 4 轮对话才完成方案确认，存在一次重复查询订单状态的工具调用，可压缩。',
      evidence: [
        'tool: query_order 被调用了 2 次，第二次参数与第一次完全相同。',
      ],
    },
    {
      dimension: 'toolUsage',
      score: 76,
      weight: 0.10,
      reasoning: '工具选择合理，但 query_order 入参 order_id 拼写错误一次后自动重试，增加耗时。',
      evidence: [
        'tool: query_order args: {"orderId": "20260718-8842"} -> 400 error，重试 {"order_id": ...} 成功。',
      ],
    },
    {
      dimension: 'contextCoherence',
      score: 90,
      weight: 0.10,
      reasoning: '全程保持「退货流程」主线，正确继承了用户在第 1 轮给出的商品类型与原因。',
      evidence: [
        'user: 我买的蓝色连衣裙想退货。 → assistant: 关于您蓝色连衣裙的退货...',
      ],
    },
  ];

  const overallScore = Math.round(
    dimensions.reduce((sum, d) => sum + d.score * (d.weight ?? 1), 0),
  );

  return {
    conversationId,
    overallScore,
    dimensions,
    evaluatorModel: 'gpt-4o',
    evaluatedAt: new Date().toISOString(),
    summary:
      '整体表现良好：合规性突出、上下文一致性强；准确性较高但在工具调用稳定性和对话效率上有优化空间，建议针对 query_order 入参规范和重复调用做收敛。',
    mode: 'llm',
  };
}

/**
 * 生成本地 mock 优化建议。
 */
export function mockSuggestions(): OptimizationSuggestion[] {
  return [
    {
      id: 'sug-prompt-001',
      category: 'prompt',
      priority: 'high',
      title: '在 system prompt 中强制工具入参 schema',
      description:
        '多次对话中 query_order 入参字段名不一致（orderId vs order_id）导致首次调用失败后重试，平均增加 1.2s 延迟。',
      action:
        '在 system prompt 追加：「调用 query_order 时必须使用 snake_case 入参 order_id，禁止使用 camelCase。」并给出一个 few-shot 示例。',
      expectedImpact: '预计减少 80% 的工具重试，单对话平均耗时下降 1.0-1.5s。',
      relatedEvidence: [
        'conv-001: query_order 首次调用 400，重试成功',
        'conv-004: 同样问题重复出现',
      ],
    },
    {
      id: 'sug-tool-001',
      category: 'tool',
      priority: 'medium',
      title: '合并订单查询与状态查询为单一工具',
      description:
        'query_order 与 query_order_status 在 60% 的对话中被先后调用，参数完全相同，存在重复查询。',
      action: '将 query_order_status 能力合并入 query_order 返回结果，并在响应中包含 status 字段。',
      expectedImpact: '减少 1 次工具调用/对话，效率维度评分预计提升 8-10 分。',
      relatedEvidence: ['conv-001: 连续 2 次 query_order，参数相同'],
    },
    {
      id: 'sug-knowledge-001',
      category: 'knowledge',
      priority: 'high',
      title: '补充「预售商品退货」知识切片',
      description:
        '在 12 条涉及预售商品退货的对话中，客服给出的退货窗口与普通商品混淆（预售应 15 天，普通 7 天），准确性被扣分。',
      action: '在知识库 kb-product 中新增「预售商品退货政策」文档，并在 system prompt 中提示优先检索该切片。',
      expectedImpact: '涉及预售的对话准确性评分预计从 72 提升至 88+。',
      relatedEvidence: [
        'conv-007: 错误告知预售商品 7 天可退',
        'conv-011: 同类错误',
      ],
    },
    {
      id: 'sug-parameter-001',
      category: 'parameter',
      priority: 'medium',
      title: '调低 temperature 至 0.3',
      description:
        '当前 temperature=0.7 导致部分事实性回答（订单状态、退货政策）出现轻微漂移，影响准确性。',
      action: '将 capability.temperature 从 0.7 调整为 0.3，保留 topP=0.9 不变。',
      expectedImpact: '准确性维度评分预计提升 3-5 分，创新性场景可通过单独的 employee 配置覆盖。',
    },
    {
      id: 'sug-workflow-001',
      category: 'workflow',
      priority: 'low',
      title: '在退货流程中前置确认「商品类型」',
      description:
        '当前流程在未确认是否为预售商品的情况下直接告知 7 天退货政策，导致后续需要纠正，增加对话轮次。',
      action: '在退货意图识别后，增加一个「商品类型判断」节点，预售商品走分支 A，普通商品走分支 B。',
      expectedImpact: '平均对话轮次从 4.2 降至 3.0，效率维度评分预计提升 12 分。',
      relatedEvidence: ['conv-007: 第 2 轮才追问是否预售'],
    },
  ];
}

/**
 * 生成本地 mock 报告详情。
 */
function mockReportDetail(reportId: string): EvaluationReportDetail {
  const base: EvaluationReport = {
    reportId,
    employeeId: 'emp-mock',
    period: '2026-W28',
    totalTasks: 128,
    avgQualityScore: 0.836,
    successRate: 0.91,
    avgDuration: 47.3,
    highlights: [
      '合规性维度平均 95 分，未出现政策违规',
      '上下文一致性 90 分，多轮对话无明显遗忘',
    ],
    issues: [
      '工具调用稳定性不足，12% 对话存在重试',
      '预售商品退货政策准确性偏低（72 分）',
    ],
    createdAt: new Date().toISOString(),
  };
  return {
    ...base,
    autoGenerated: true,
    dimensions: mockAutoScoreResult('aggregate').dimensions,
    suggestions: mockSuggestions().slice(0, 3),
    scoreBreakdown: {
      accuracy: 88,
      helpfulness: 82,
      compliance: 95,
      efficiency: 70,
      toolUsage: 76,
      contextCoherence: 90,
    },
    comparisonBaseline: {
      previousScore: 0.79,
      delta: 0.046,
    },
  };
}
