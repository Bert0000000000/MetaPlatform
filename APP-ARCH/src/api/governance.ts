import { get, post, put, del } from './client';
import type { Principle, ReviewItem, TechDebt, ReviewComment } from '@/types';

const MOCK_PRINCIPLES: Principle[] = [
  { id: 'p1', name: '本体驱动原则', code: 'ONT-DRIVEN', description: '所有数据语义通过 Ontology 引擎定义', category: '架构', priority: 'high', standards: ['所有实体必须在 Ontology 注册', '数据访问通过本体引擎'] },
  { id: 'p2', name: 'AI 贯穿原则', code: 'AI-UBIQUITOUS', description: 'AI 作为贯穿全栈的能力底座', category: '架构', priority: 'high', standards: ['LLM 调用通过 TECH-LLMGW', 'RAG 检索通过 TECH-RAG'] },
  { id: 'p3', name: '事件溯源原则', code: 'EVENT-SOURCING', description: '关键业务事件使用 Outbox 模式', category: '数据', priority: 'medium', standards: ['Kafka 发布使用 Outbox', '消费支持 DLQ'] },
];

const MOCK_REVIEWS: ReviewItem[] = [
  { id: 'rv1', title: '报销系统微服务拆分评审', type: 'architecture', status: 'pending', applicant: '张三', description: '将报销系统拆分为3个微服务', comments: [], createdAt: '2026-07-15T00:00:00Z' },
  { id: 'rv2', title: 'RAG 引擎架构变更', type: 'change', status: 'approved', applicant: '李四', reviewer: '架构组', description: '升级 Milvus 向量化策略', comments: [{ id: 'c1', author: '架构组', content: '方案合理，批准', type: 'approve', createdAt: '2026-07-14T00:00:00Z' }], createdAt: '2026-07-10T00:00:00Z', reviewedAt: '2026-07-14T00:00:00Z' },
];

const MOCK_DEBT: TechDebt[] = [
  { id: 'td1', name: '旧版报销模块技术债', description: '遗留单体代码', category: 'code', severity: 'high', status: 'in_progress', owner: 'IT部', dueDate: '2026-09-01', complianceScore: 65 },
  { id: 'td2', name: 'MySQL 5.7 升级', description: '数据库版本过旧', category: 'infrastructure', severity: 'medium', status: 'open', owner: '运维组', complianceScore: 80 },
  { id: 'td3', name: '缺少 API 限流', description: '网关未配置限流策略', category: 'architecture', severity: 'high', status: 'open', complianceScore: 50 },
];

export async function listPrinciples(): Promise<Principle[]> {
  try {
    return await get<Principle[]>('/v1/ea/governance/principles');
  } catch {
    return MOCK_PRINCIPLES;
  }
}

export async function createPrinciple(req: Partial<Principle>): Promise<Principle> {
  try {
    return await post<Principle>('/v1/ea/governance/principles', req);
  } catch {
    return { id: `p_${Date.now()}`, name: req.name || '', code: req.code || '', category: req.category || '', priority: 'medium', standards: req.standards || [], ...req };
  }
}

export async function updatePrinciple(id: string, req: Partial<Principle>): Promise<Principle> {
  try {
    return await put<Principle>(`/v1/ea/governance/principles/${id}`, req);
  } catch {
    return { ...MOCK_PRINCIPLES.find((p) => p.id === id)!, ...req };
  }
}

export async function deletePrinciple(id: string): Promise<void> {
  try {
    await del(`/v1/ea/governance/principles/${id}`);
  } catch {
    // mock
  }
}

export async function listReviews(): Promise<ReviewItem[]> {
  try {
    return await get<ReviewItem[]>('/v1/ea/governance/reviews');
  } catch {
    return MOCK_REVIEWS;
  }
}

export async function createReview(req: Partial<ReviewItem>): Promise<ReviewItem> {
  try {
    return await post<ReviewItem>('/v1/ea/governance/reviews', req);
  } catch {
    return { id: `rv_${Date.now()}`, title: req.title || '', type: req.type || 'architecture', status: 'pending', applicant: req.applicant || '', description: req.description, comments: [], createdAt: new Date().toISOString() };
  }
}

export async function submitReviewAction(id: string, action: 'approve' | 'reject', comment: string): Promise<void> {
  try {
    await post(`/v1/ea/governance/reviews/${id}/${action}`, { comment });
  } catch {
    const review = MOCK_REVIEWS.find((r) => r.id === id);
    if (review) {
      review.status = action === 'approve' ? 'approved' : 'rejected';
      review.reviewedAt = new Date().toISOString();
      review.reviewer = '当前用户';
      review.comments.push({ id: `c_${Date.now()}`, author: '当前用户', content: comment, type: action, createdAt: new Date().toISOString() } as ReviewComment);
    }
  }
}

export async function listTechDebt(): Promise<TechDebt[]> {
  try {
    return await get<TechDebt[]>('/v1/ea/governance/tech-debt');
  } catch {
    return MOCK_DEBT;
  }
}

export async function createTechDebt(req: Partial<TechDebt>): Promise<TechDebt> {
  try {
    return await post<TechDebt>('/v1/ea/governance/tech-debt', req);
  } catch {
    return { id: `td_${Date.now()}`, name: req.name || '', category: req.category || 'code', severity: req.severity || 'medium', status: 'open', ...req };
  }
}

export async function updateTechDebt(id: string, req: Partial<TechDebt>): Promise<TechDebt> {
  try {
    return await put<TechDebt>(`/v1/ea/governance/tech-debt/${id}`, req);
  } catch {
    return { ...MOCK_DEBT.find((t) => t.id === id)!, ...req };
  }
}

export async function deleteTechDebt(id: string): Promise<void> {
  try {
    await del(`/v1/ea/governance/tech-debt/${id}`);
  } catch {
    // mock
  }
}

export async function runComplianceCheck(id: string): Promise<{ score: number; issues: string[] }> {
  try {
    return await get<{ score: number; issues: string[] }>(`/v1/ea/governance/tech-debt/${id}/compliance`);
  } catch {
    const debt = MOCK_DEBT.find((t) => t.id === id);
    const score = debt?.complianceScore ?? 75;
    const issues: string[] = [];
    if (score < 70) issues.push('合规分数低于阈值 70');
    if (debt?.severity === 'critical') issues.push('严重级别技术债务');
    return { score, issues };
  }
}
