import { get, post, del } from './client';
import type { Deliverable, DeliverableType, PageResponse } from '@/types';

const STORAGE_KEY = 'mate_dash_deliverables';

const MOCK_DELIVERABLES: Deliverable[] = [
  {
    id: 'd1',
    type: 'report',
    title: '2026年Q2财务分析报告',
    source: 'SuperAI',
    description: '基于财务知识库生成的季度分析报告',
    format: 'pdf',
    status: 'ready',
    size: 2048000,
    createdAt: '2026-07-15T10:00:00Z',
    createdBy: '财务助手',
    downloadUrl: '#',
  },
  {
    id: 'd2',
    type: 'task_output',
    title: '月度报销数据汇总结果',
    source: '数字员工-财务助手',
    description: '自动汇总本月报销单据',
    format: 'json',
    status: 'ready',
    size: 512000,
    createdAt: '2026-07-10T09:00:00Z',
    createdBy: '财务助手',
    downloadUrl: '#',
  },
  {
    id: 'd3',
    type: 'schedule_summary',
    title: '客户回访调度总结',
    source: 'SuperAI 调度模式',
    description: '多员工协作调度结果汇总',
    format: 'markdown',
    status: 'ready',
    size: 128000,
    createdAt: '2026-07-12T14:00:00Z',
    createdBy: 'HR助手',
    downloadUrl: '#',
  },
];

function loadFromStorage(): Deliverable[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Deliverable[];
  } catch {
    return [];
  }
}

function saveToStorage(items: Deliverable[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function listDeliverables(params?: { keyword?: string; type?: DeliverableType }): Promise<PageResponse<Deliverable>> {
  try {
    return await get<PageResponse<Deliverable>>('/v1/dash/deliverables', params as Record<string, unknown>);
  } catch {
    const stored = loadFromStorage();
    const items = [...MOCK_DELIVERABLES, ...stored];
    const keyword = params?.keyword?.toLowerCase() ?? '';
    const type = params?.type;
    const filtered = items.filter(
      (d) =>
        (!keyword || d.title.toLowerCase().includes(keyword) || d.description.toLowerCase().includes(keyword)) &&
        (!type || d.type === type)
    );
    return { items: filtered, total: filtered.length, page: 1, pageSize: filtered.length, totalPages: 1 };
  }
}

export async function searchDeliverables(keyword: string): Promise<Deliverable[]> {
  const res = await listDeliverables({ keyword });
  return res.items;
}

export async function downloadDeliverable(id: string, format: string): Promise<{ downloadUrl: string; message: string }> {
  try {
    return await post<{ downloadUrl: string; message: string }>(`/v1/dash/deliverables/${id}/download`, { format });
  } catch {
    return { downloadUrl: '#', message: '下载已准备就绪（本地模拟）' };
  }
}

export async function deleteDeliverable(id: string): Promise<void> {
  try {
    await del<void>(`/v1/dash/deliverables/${id}`);
  } catch {
    const items = loadFromStorage();
    saveToStorage(items.filter((d) => d.id !== id));
  }
}
