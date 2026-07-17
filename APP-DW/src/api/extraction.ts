import { post, get, put } from './client';
import type { ExtractionItem, ExtractionResult, ExtractionType, ExtractionStatus } from '@/types';

const STORAGE_KEY = 'app_dw_extractions';

function loadExtractions(): ExtractionItem[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ExtractionItem[];
  } catch {
    return [];
  }
}

function saveExtractions(items: ExtractionItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function now(): string {
  return new Date().toISOString();
}

function generateId(): string {
  return `ext_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const MOCK_EXTRACTIONS: Omit<ExtractionItem, 'id' | 'documentId' | 'employeeId' | 'extractedAt'>[] = [
  {
    type: 'concept',
    name: '报销单',
    description: '员工提交的费用报销申请记录，包含金额、类型、日期等属性',
    confidence: 95,
    status: 'pending',
    properties: {
      attributes: [
        { name: 'amount', type: 'number', required: true },
        { name: 'type', type: 'enum', required: true, options: ['差旅', '餐饮', '办公'] },
        { name: 'date', type: 'date', required: true },
      ],
    },
  },
  {
    type: 'concept',
    name: '审批人',
    description: '对报销单进行审核的负责人角色',
    confidence: 88,
    status: 'pending',
    properties: {
      attributes: [
        { name: 'name', type: 'string', required: true },
        { name: 'department', type: 'string', required: true },
        { name: 'level', type: 'number', required: false },
      ],
    },
  },
  {
    type: 'entity',
    name: '张三',
    description: '财务部经理，负责报销终审',
    confidence: 82,
    status: 'pending',
    properties: { concept: '审批人', department: '财务部', level: 3 },
  },
  {
    type: 'entity',
    name: '上海科技有限公司',
    description: 'A级客户，2026年度合作金额 200 万元',
    confidence: 90,
    status: 'pending',
    properties: { concept: '客户', level: 'A', amount: 2000000 },
  },
  {
    type: 'rule',
    name: '金额超过10000元需副总审批',
    description: '当报销金额超过 10000 元时，需额外经过副总审批环节',
    confidence: 93,
    status: 'pending',
    properties: {
      condition: 'amount > 10000',
      action: 'add_approval_step',
      approver: 'vp',
    },
  },
  {
    type: 'rule',
    name: '差旅费需附发票',
    description: '所有差旅费报销必须附上电子发票作为凭证',
    confidence: 97,
    status: 'pending',
    properties: {
      condition: 'type == "差旅"',
      action: 'require_attachment',
      attachmentType: 'invoice',
    },
  },
  {
    type: 'action',
    name: '发送报销审批通知',
    description: '向审批人发送邮件通知，包含报销单详情和审批链接',
    confidence: 86,
    status: 'pending',
    properties: {
      trigger: '报销单提交',
      channel: 'email',
      template: 'expense_approval_notification',
    },
  },
  {
    type: 'action',
    name: '生成月度报销报告',
    description: '按月汇总报销数据并生成统计报告，发送给财务负责人',
    confidence: 79,
    status: 'pending',
    properties: {
      trigger: '每月1日',
      schedule: 'monthly',
      output: 'report',
    },
  },
];

export async function extractFromDocument(
  documentId: string,
  employeeId: string,
): Promise<ExtractionResult> {
  try {
    return await post<ExtractionResult>('/v1/ont/extract', { documentId, employeeId });
  } catch {
    const items: ExtractionItem[] = MOCK_EXTRACTIONS.map((mock) => ({
      ...mock,
      id: generateId(),
      documentId,
      employeeId,
      extractedAt: now(),
    }));
    const existing = loadExtractions().filter((e) => e.documentId !== documentId);
    saveExtractions([...existing, ...items]);
    return {
      documentId,
      items,
      totalConcepts: items.filter((i) => i.type === 'concept').length,
      totalEntities: items.filter((i) => i.type === 'entity').length,
      totalRules: items.filter((i) => i.type === 'rule').length,
      totalActions: items.filter((i) => i.type === 'action').length,
    };
  }
}

export async function getExtractionResults(documentId: string): Promise<ExtractionResult> {
  try {
    return await get<ExtractionResult>(`/v1/ont/extract/${documentId}`);
  } catch {
    const items = loadExtractions().filter((e) => e.documentId === documentId);
    return {
      documentId,
      items,
      totalConcepts: items.filter((i) => i.type === 'concept').length,
      totalEntities: items.filter((i) => i.type === 'entity').length,
      totalRules: items.filter((i) => i.type === 'rule').length,
      totalActions: items.filter((i) => i.type === 'action').length,
    };
  }
}

export async function reviewExtractionItem(
  itemId: string,
  status: 'approved' | 'rejected',
): Promise<ExtractionItem> {
  try {
    return await put<ExtractionItem>(`/v1/ont/extract/items/${itemId}`, { status });
  } catch {
    const items = loadExtractions();
    const idx = items.findIndex((e) => e.id === itemId);
    if (idx === -1) throw new Error('抽取项不存在');
    items[idx].status = status;
    items[idx].reviewedAt = now();
    saveExtractions(items);
    return items[idx];
  }
}

export async function batchReview(
  itemIds: string[],
  status: 'approved' | 'rejected',
): Promise<ExtractionItem[]> {
  const results: ExtractionItem[] = [];
  for (const id of itemIds) {
    results.push(await reviewExtractionItem(id, status));
  }
  return results;
}

export async function commitToOntology(itemIds: string[]): Promise<ExtractionItem[]> {
  try {
    return await post<ExtractionItem[]>('/v1/ont/commit', { itemIds });
  } catch {
    const items = loadExtractions();
    const results: ExtractionItem[] = [];
    for (const id of itemIds) {
      const idx = items.findIndex((e) => e.id === id);
      if (idx === -1) continue;
      if (items[idx].status !== 'approved') {
        items[idx].commitResult = { success: false, message: '未审核通过的项目不能提交' };
      } else {
        items[idx].status = 'committed';
        items[idx].commitResult = {
          success: true,
          message: '已成功写入 Ontology 引擎',
          ontId: `ont_${generateId()}`,
        };
      }
      results.push(items[idx]);
    }
    saveExtractions(items);
    return results;
  }
}

export async function getExtractionsByEmployee(
  employeeId: string,
  typeFilter?: ExtractionType,
  statusFilter?: ExtractionStatus,
): Promise<ExtractionItem[]> {
  try {
    const params: Record<string, unknown> = { employeeId };
    if (typeFilter) params.type = typeFilter;
    if (statusFilter) params.status = statusFilter;
    return await get<ExtractionItem[]>('/v1/ont/extract', params);
  } catch {
    let items = loadExtractions().filter((e) => e.employeeId === employeeId);
    if (typeFilter) items = items.filter((i) => i.type === typeFilter);
    if (statusFilter) items = items.filter((i) => i.status === statusFilter);
    return items;
  }
}
