import { get, post, put, del } from './client';
import type { ArchApplication, ArchAppCreateRequest, PageResponse } from '@/types';

const STORAGE_KEY = 'mate_arch_apps';

const MOCK: ArchApplication[] = [
  { appId: 'a1', name: '财务报销系统', code: 'FIN-REIMB-APP', description: '报销申请与审批', status: 'active', technologyStack: 'React + Spring Boot', owner: '财务部', capabilityIds: ['c2'], dependencyAppIds: ['a2'] },
  { appId: 'a2', name: '预算管理系统', code: 'FIN-BUDGET-APP', description: '预算编制与控制', status: 'active', technologyStack: 'Vue + Java', owner: '财务部', capabilityIds: ['c3'], dependencyAppIds: [] },
  { appId: 'a3', name: '招聘管理系统', code: 'HR-RECRUIT-APP', description: '招聘全流程', status: 'active', technologyStack: 'React + Node.js', owner: 'HR部', capabilityIds: ['c5'], dependencyAppIds: [] },
];

function load(): ArchApplication[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return MOCK;
  try {
    return [...MOCK, ...(JSON.parse(raw) as ArchApplication[])];
  } catch {
    return MOCK;
  }
}

function save(items: ArchApplication[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.filter((i) => !MOCK.some((m) => m.appId === i.appId))));
}

export async function listApplications(params?: { keyword?: string }): Promise<PageResponse<ArchApplication>> {
  try {
    return await get<PageResponse<ArchApplication>>('/v1/ea/applications', params);
  } catch {
    const items = load();
    const kw = params?.keyword?.toLowerCase() ?? '';
    const filtered = items.filter((a) => !kw || a.name.toLowerCase().includes(kw));
    return { items: filtered, total: filtered.length, page: 1, pageSize: filtered.length, totalPages: 1 };
  }
}

export async function createApplication(req: ArchAppCreateRequest): Promise<ArchApplication> {
  try {
    return await post<ArchApplication>('/v1/ea/applications', req);
  } catch {
    const item: ArchApplication = {
      appId: `a_${Date.now()}`,
      name: req.name,
      code: req.code,
      description: req.description,
      status: (req.status as ArchApplication['status']) || 'active',
      technologyStack: req.technologyStack,
      owner: req.owner,
      capabilityIds: req.capabilityIds || [],
      dependencyAppIds: req.dependencyAppIds || [],
    };
    save([...load().filter((a) => !MOCK.some((m) => m.appId === a.appId)), item]);
    return item;
  }
}

export async function updateApplication(id: string, req: ArchAppCreateRequest): Promise<ArchApplication> {
  try {
    return await put<ArchApplication>(`/v1/ea/applications/${id}`, req);
  } catch {
    const items = load();
    const idx = items.findIndex((a) => a.appId === id);
    if (idx >= 0) {
      const existing = items[idx]!;
      items[idx] = {
        ...existing,
        name: req.name,
        code: req.code,
        description: req.description,
        status: (req.status as ArchApplication['status']) || existing.status,
        technologyStack: req.technologyStack,
        owner: req.owner,
        capabilityIds: req.capabilityIds ?? existing.capabilityIds,
        dependencyAppIds: req.dependencyAppIds ?? existing.dependencyAppIds,
      };
      save(items);
      return items[idx]!;
    }
    throw new Error('应用不存在');
  }
}

export async function deleteApplication(id: string): Promise<void> {
  try {
    await del(`/v1/ea/applications/${id}`);
  } catch {
    save(load().filter((a) => a.appId !== id));
  }
}
