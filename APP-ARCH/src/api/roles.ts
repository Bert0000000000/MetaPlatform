import { get, post, put, del } from './client';
import type { OrgUnit, ArchRole } from '@/types';

const MOCK_ORG: OrgUnit[] = [
  { id: 'o1', name: '总公司', level: 1, head: 'CEO', description: '集团总部' },
  { id: 'o2', name: '财务部', parentId: 'o1', parentName: '总公司', level: 2, head: 'CFO', description: '财务管理' },
  { id: 'o3', name: 'HR部', parentId: 'o1', parentName: '总公司', level: 2, head: 'CHO', description: '人力资源管理' },
  { id: 'o4', name: 'IT部', parentId: 'o1', parentName: '总公司', level: 2, head: 'CIO', description: '信息技术' },
];

const MOCK_ROLES: ArchRole[] = [
  { id: 'r1', name: '财务主管', code: 'FIN-MGR', orgUnitId: 'o2', orgUnitName: '财务部', permissions: ['approve', 'view'], userCount: 2 },
  { id: 'r2', name: 'HR专员', code: 'HR-STAFF', orgUnitId: 'o3', orgUnitName: 'HR部', permissions: ['view', 'edit'], userCount: 5 },
  { id: 'r3', name: '系统管理员', code: 'SYS-ADMIN', orgUnitId: 'o4', orgUnitName: 'IT部', permissions: ['admin'], userCount: 1 },
];

export async function getOrgTree(): Promise<OrgUnit[]> {
  try {
    return await get<OrgUnit[]>('/v1/ea/orgs/tree');
  } catch {
    return MOCK_ORG;
  }
}

export async function createOrgUnit(req: Partial<OrgUnit>): Promise<OrgUnit> {
  try {
    return await post<OrgUnit>('/v1/ea/orgs', req);
  } catch {
    const parent = MOCK_ORG.find((o) => o.id === req.parentId);
    return { id: `o_${Date.now()}`, name: req.name || '', level: parent ? parent.level + 1 : 1, parentName: parent?.name, ...req };
  }
}

export async function updateOrgUnit(id: string, req: Partial<OrgUnit>): Promise<OrgUnit> {
  try {
    return await put<OrgUnit>(`/v1/ea/orgs/${id}`, req);
  } catch {
    return { ...MOCK_ORG.find((o) => o.id === id)!, ...req };
  }
}

export async function deleteOrgUnit(id: string): Promise<void> {
  try {
    await del(`/v1/ea/orgs/${id}`);
  } catch {
    // mock
  }
}

export async function listRoles(orgUnitId?: string): Promise<ArchRole[]> {
  try {
    return await get<ArchRole[]>('/v1/ea/roles', { orgUnitId });
  } catch {
    return orgUnitId ? MOCK_ROLES.filter((r) => r.orgUnitId === orgUnitId) : MOCK_ROLES;
  }
}

export async function createRole(req: Partial<ArchRole>): Promise<ArchRole> {
  try {
    return await post<ArchRole>('/v1/ea/roles', req);
  } catch {
    return { id: `r_${Date.now()}`, name: req.name || '', code: req.code || '', permissions: req.permissions || [], userCount: 0, ...req };
  }
}

export async function updateRole(id: string, req: Partial<ArchRole>): Promise<ArchRole> {
  try {
    return await put<ArchRole>(`/v1/ea/roles/${id}`, req);
  } catch {
    return { ...MOCK_ROLES.find((r) => r.id === id)!, ...req };
  }
}

export async function deleteRole(id: string): Promise<void> {
  try {
    await del(`/v1/ea/roles/${id}`);
  } catch {
    // mock
  }
}
