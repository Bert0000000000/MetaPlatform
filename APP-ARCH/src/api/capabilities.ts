import { get, post, put, del } from './client';
import type { Capability, CapabilityCreateRequest, PageResponse } from '@/types';

const STORAGE_KEY = 'mate_arch_capabilities';

const MOCK: Capability[] = [
  { capabilityId: 'c1', name: '财务管理', code: 'FIN', description: '企业财务管理能力', level: 1, status: 'active' },
  { capabilityId: 'c2', name: '报销管理', code: 'FIN-REIMB', description: '报销申请与审批', level: 2, parentCapabilityId: 'c1', parentName: '财务管理', status: 'active' },
  { capabilityId: 'c3', name: '预算管理', code: 'FIN-BUDGET', description: '预算编制与控制', level: 2, parentCapabilityId: 'c1', parentName: '财务管理', status: 'active' },
  { capabilityId: 'c4', name: '人力资源管理', code: 'HR', description: 'HR 全流程管理', level: 1, status: 'active' },
  { capabilityId: 'c5', name: '招聘管理', code: 'HR-RECRUIT', description: '招聘流程', level: 2, parentCapabilityId: 'c4', parentName: '人力资源管理', status: 'active' },
  { capabilityId: 'c6', name: '供应链管理', code: 'SCM', description: '供应链全链路', level: 1, status: 'active' },
];

function load(): Capability[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return MOCK;
  try {
    const stored = JSON.parse(raw) as Capability[];
    return [...MOCK, ...stored.filter((s) => !MOCK.some((m) => m.capabilityId === s.capabilityId))];
  } catch {
    return MOCK;
  }
}

function save(items: Capability[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.filter((i) => !MOCK.some((m) => m.capabilityId === i.capabilityId))));
}

export async function listCapabilities(params?: { keyword?: string }): Promise<PageResponse<Capability>> {
  try {
    return await get<PageResponse<Capability>>('/v1/ea/capabilities', params);
  } catch {
    const items = load();
    const kw = params?.keyword?.toLowerCase() ?? '';
    const filtered = items.filter((c) => !kw || c.name.toLowerCase().includes(kw) || c.code.toLowerCase().includes(kw));
    return { items: filtered, total: filtered.length, page: 1, pageSize: filtered.length, totalPages: 1 };
  }
}

export async function getCapabilityTree(): Promise<Capability[]> {
  try {
    return await get<Capability[]>('/v1/ea/capabilities/tree');
  } catch {
    return load();
  }
}

export async function createCapability(req: CapabilityCreateRequest): Promise<Capability> {
  try {
    return await post<Capability>('/v1/ea/capabilities', req);
  } catch {
    const parent = load().find((c) => c.capabilityId === req.parentCapabilityId);
    const item: Capability = {
      capabilityId: `c_${Date.now()}`,
      ...req,
      level: parent ? parent.level + 1 : 1,
      parentName: parent?.name,
      status: (req.status as Capability['status']) || 'active',
    };
    save([...load().filter((c) => !MOCK.some((m) => m.capabilityId === c.capabilityId)), item]);
    return item;
  }
}

export async function updateCapability(id: string, req: CapabilityCreateRequest): Promise<Capability> {
  try {
    return await put<Capability>(`/v1/ea/capabilities/${id}`, req);
  } catch {
    const items = load();
    const idx = items.findIndex((c) => c.capabilityId === id);
    if (idx >= 0) {
      items[idx] = {
        ...items[idx],
        name: req.name,
        code: req.code,
        description: req.description,
        parentCapabilityId: req.parentCapabilityId,
        status: (req.status as Capability['status']) || items[idx]!.status,
      };
      save(items);
      return items[idx]!;
    }
    throw new Error('能力不存在');
  }
}

export async function deleteCapability(id: string): Promise<void> {
  try {
    await del(`/v1/ea/capabilities/${id}`);
  } catch {
    const items = load();
    save(items.filter((c) => c.capabilityId !== id));
  }
}

export async function moveCapability(id: string, newParentId?: string): Promise<void> {
  try {
    await put(`/v1/ea/capabilities/${id}/move`, { newParentId });
  } catch {
    const items = load();
    const item = items.find((c) => c.capabilityId === id);
    if (item) {
      item.parentCapabilityId = newParentId;
      const parent = items.find((c) => c.capabilityId === newParentId);
      item.level = parent ? parent.level + 1 : 1;
      save(items);
    }
  }
}
