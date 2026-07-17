import { get, post, put, del } from './client';
import type { DataDomain, DataEntity, DataFlow } from '@/types';

const MOCK_DOMAINS: DataDomain[] = [
  { id: 'dd1', name: '财务域', code: 'FIN', description: '财务相关数据' },
  { id: 'dd2', name: '人力域', code: 'HR', description: '人力资源数据' },
  { id: 'dd3', name: '客户域', code: 'CUST', description: '客户相关数据' },
];

const MOCK_ENTITIES: DataEntity[] = [
  { id: 'de1', name: '报销单', code: 'REIMB_ORDER', domainId: 'dd1', description: '报销申请单', fields: [
    { name: 'id', type: 'String', required: true, description: '单号' },
    { name: 'amount', type: 'Decimal', required: true, description: '金额' },
    { name: 'applicant', type: 'String', required: true, description: '申请人' },
  ] },
  { id: 'de2', name: '员工', code: 'EMPLOYEE', domainId: 'dd2', description: '员工信息', fields: [
    { name: 'id', type: 'String', required: true },
    { name: 'name', type: 'String', required: true },
    { name: 'department', type: 'String', required: false },
  ] },
];

const MOCK_FLOWS: DataFlow[] = [
  { id: 'df1', name: '报销->付款', sourceEntityId: 'de1', targetEntityId: 'de1', description: '报销单触发付款' },
];

export async function listDomains(): Promise<DataDomain[]> {
  try {
    return await get<DataDomain[]>('/v1/ea/data/domains');
  } catch {
    return MOCK_DOMAINS;
  }
}

export async function createDomain(req: Partial<DataDomain>): Promise<DataDomain> {
  try {
    return await post<DataDomain>('/v1/ea/data/domains', req);
  } catch {
    return { id: `dd_${Date.now()}`, name: req.name || '', code: req.code || '', ...req };
  }
}

export async function deleteDomain(id: string): Promise<void> {
  try {
    await del(`/v1/ea/data/domains/${id}`);
  } catch {
    // mock
  }
}

export async function listEntities(domainId?: string): Promise<DataEntity[]> {
  try {
    return await get<DataEntity[]>('/v1/ea/data/entities', { domainId });
  } catch {
    return domainId ? MOCK_ENTITIES.filter((e) => e.domainId === domainId) : MOCK_ENTITIES;
  }
}

export async function createEntity(req: Partial<DataEntity>): Promise<DataEntity> {
  try {
    return await post<DataEntity>('/v1/ea/data/entities', req);
  } catch {
    return { id: `de_${Date.now()}`, name: req.name || '', code: req.code || '', fields: req.fields || [], ...req };
  }
}

export async function updateEntity(id: string, req: Partial<DataEntity>): Promise<DataEntity> {
  try {
    return await put<DataEntity>(`/v1/ea/data/entities/${id}`, req);
  } catch {
    return { ...MOCK_ENTITIES.find((e) => e.id === id)!, ...req };
  }
}

export async function deleteEntity(id: string): Promise<void> {
  try {
    await del(`/v1/ea/data/entities/${id}`);
  } catch {
    // mock
  }
}

export async function listFlows(): Promise<DataFlow[]> {
  try {
    return await get<DataFlow[]>('/v1/ea/data/flows');
  } catch {
    return MOCK_FLOWS;
  }
}

export async function createFlow(req: Partial<DataFlow>): Promise<DataFlow> {
  try {
    return await post<DataFlow>('/v1/ea/data/flows', req);
  } catch {
    return { id: `df_${Date.now()}`, name: req.name || '', sourceEntityId: req.sourceEntityId || '', targetEntityId: req.targetEntityId || '', ...req };
  }
}
