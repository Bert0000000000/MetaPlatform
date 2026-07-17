import { get, post, put, del } from './client';
import type { ValueStream, PageResponse } from '@/types';

const STORAGE_KEY = 'mate_arch_valuestreams';

const MOCK: ValueStream[] = [
  {
    id: 'vs1', name: '采购到付款', description: 'P2P 全流程', status: 'active',
    stages: [
      { id: 's1', name: '采购申请', order: 1, capabilityIds: ['c2'], description: '提交采购需求' },
      { id: 's2', name: '审批', order: 2, capabilityIds: ['c2'], description: '审批采购申请' },
      { id: 's3', name: '付款', order: 3, capabilityIds: ['c3'], description: '执行付款' },
    ],
  },
  {
    id: 'vs2', name: '订单到收款', description: 'O2C 全流程', status: 'active',
    stages: [
      { id: 's4', name: '订单录入', order: 1, capabilityIds: [], description: '创建订单' },
      { id: 's5', name: '发货', order: 2, capabilityIds: [], description: '仓库发货' },
      { id: 's6', name: '收款', order: 3, capabilityIds: ['c3'], description: '确认收款' },
    ],
  },
];

function load(): ValueStream[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return MOCK;
  try {
    return [...MOCK, ...(JSON.parse(raw) as ValueStream[])];
  } catch {
    return MOCK;
  }
}

function save(items: ValueStream[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.filter((i) => !MOCK.some((m) => m.id === i.id))));
}

export async function listValueStreams(): Promise<PageResponse<ValueStream>> {
  try {
    return await get<PageResponse<ValueStream>>('/v1/ea/value-streams');
  } catch {
    const items = load();
    return { items, total: items.length, page: 1, pageSize: items.length, totalPages: 1 };
  }
}

export async function createValueStream(req: Partial<ValueStream>): Promise<ValueStream> {
  try {
    return await post<ValueStream>('/v1/ea/value-streams', req);
  } catch {
    const item: ValueStream = { id: `vs_${Date.now()}`, name: req.name || '', description: req.description, status: 'draft', stages: req.stages || [] };
    save([...load(), item]);
    return item;
  }
}

export async function updateValueStream(id: string, req: Partial<ValueStream>): Promise<ValueStream> {
  try {
    return await put<ValueStream>(`/v1/ea/value-streams/${id}`, req);
  } catch {
    const items = load();
    const idx = items.findIndex((v) => v.id === id);
    if (idx >= 0) { items[idx] = { ...items[idx], ...req }; save(items); return items[idx]; }
    throw new Error('价值流不存在');
  }
}

export async function deleteValueStream(id: string): Promise<void> {
  try {
    await del(`/v1/ea/value-streams/${id}`);
  } catch {
    save(load().filter((v) => v.id !== id));
  }
}
