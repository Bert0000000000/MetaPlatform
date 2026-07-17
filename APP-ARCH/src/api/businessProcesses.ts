import { get, post, put, del } from './client';
import type { BusinessProcess, PageResponse } from '@/types';

const STORAGE_KEY = 'mate_arch_processes';

const MOCK: BusinessProcess[] = [
  { id: 'bp1', name: '报销审批流程', code: 'REIMB-APPROVAL', description: '员工报销审批', capabilityIds: ['c2'], status: 'active', steps: ['提交报销', '主管审批', '财务审核', '出纳付款'], createdAt: '2026-07-01T00:00:00Z' },
  { id: 'bp2', name: '招聘流程', code: 'RECRUIT-FLOW', description: '候选人招聘全流程', capabilityIds: ['c5'], status: 'active', steps: ['简历筛选', '初面', '复面', 'Offer'], createdAt: '2026-07-02T00:00:00Z' },
];

function load(): BusinessProcess[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return MOCK;
  try {
    return [...MOCK, ...(JSON.parse(raw) as BusinessProcess[])];
  } catch {
    return MOCK;
  }
}

function save(items: BusinessProcess[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.filter((i) => !MOCK.some((m) => m.id === i.id))));
}

export async function listProcesses(): Promise<PageResponse<BusinessProcess>> {
  try {
    return await get<PageResponse<BusinessProcess>>('/v1/ea/processes');
  } catch {
    const items = load();
    return { items, total: items.length, page: 1, pageSize: items.length, totalPages: 1 };
  }
}

export async function createProcess(req: Partial<BusinessProcess>): Promise<BusinessProcess> {
  try {
    return await post<BusinessProcess>('/v1/ea/processes', req);
  } catch {
    const item: BusinessProcess = { id: `bp_${Date.now()}`, name: req.name || '', code: req.code || '', description: req.description, capabilityIds: req.capabilityIds || [], status: 'draft', steps: req.steps || [] };
    save([...load(), item]);
    return item;
  }
}

export async function updateProcess(id: string, req: Partial<BusinessProcess>): Promise<BusinessProcess> {
  try {
    return await put<BusinessProcess>(`/v1/ea/processes/${id}`, req);
  } catch {
    const items = load();
    const idx = items.findIndex((b) => b.id === id);
    if (idx >= 0) { items[idx] = { ...items[idx], ...req }; save(items); return items[idx]; }
    throw new Error('流程不存在');
  }
}

export async function deleteProcess(id: string): Promise<void> {
  try {
    await del(`/v1/ea/processes/${id}`);
  } catch {
    save(load().filter((b) => b.id !== id));
  }
}
