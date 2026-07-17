import { get, post, put, del } from './client';
import type { TechStack, Infrastructure } from '@/types';

const MOCK_STACKS: TechStack[] = [
  { id: 'ts1', name: 'React 19', category: '前端', version: '19.0', description: 'UI 框架', status: 'adopted' },
  { id: 'ts2', name: 'Spring Boot 3.4', category: '后端', version: '3.4', description: 'Java 后端框架', status: 'adopted' },
  { id: 'ts3', name: 'PostgreSQL 17', category: '数据库', version: '17', description: '关系型数据库', status: 'adopted' },
  { id: 'ts4', name: 'Kubernetes 1.32', category: '基础设施', version: '1.32', description: '容器编排', status: 'adopted' },
  { id: 'ts5', name: 'LangGraph 0.2', category: 'AI', version: '0.2', description: 'Agent 编排', status: 'trial' },
];

const MOCK_INFRA: Infrastructure[] = [
  { id: 'inf1', name: '生产 K8s 集群', type: 'Kubernetes', spec: '30 nodes', description: '生产环境集群', status: 'active' },
  { id: 'inf2', name: 'PostgreSQL 主库', type: 'Database', spec: '16C 64G', description: '主数据库', status: 'active' },
  { id: 'inf3', name: 'Redis 缓存集群', type: 'Cache', spec: '3 nodes', description: '缓存服务', status: 'active' },
  { id: 'inf4', name: 'Milvus 向量库', type: 'VectorDB', spec: 'standalone', description: '向量检索', status: 'maintenance' },
];

export async function listTechStacks(): Promise<TechStack[]> {
  try {
    return await get<TechStack[]>('/v1/ea/tech/stacks');
  } catch {
    return MOCK_STACKS;
  }
}

export async function createTechStack(req: Partial<TechStack>): Promise<TechStack> {
  try {
    return await post<TechStack>('/v1/ea/tech/stacks', req);
  } catch {
    return { id: `ts_${Date.now()}`, name: req.name || '', category: req.category || '', status: 'trial', ...req };
  }
}

export async function updateTechStack(id: string, req: Partial<TechStack>): Promise<TechStack> {
  try {
    return await put<TechStack>(`/v1/ea/tech/stacks/${id}`, req);
  } catch {
    return { ...MOCK_STACKS.find((s) => s.id === id)!, ...req };
  }
}

export async function deleteTechStack(id: string): Promise<void> {
  try {
    await del(`/v1/ea/tech/stacks/${id}`);
  } catch {
    // mock
  }
}

export async function listInfrastructure(): Promise<Infrastructure[]> {
  try {
    return await get<Infrastructure[]>('/v1/ea/tech/infra');
  } catch {
    return MOCK_INFRA;
  }
}

export async function createInfrastructure(req: Partial<Infrastructure>): Promise<Infrastructure> {
  try {
    return await post<Infrastructure>('/v1/ea/tech/infra', req);
  } catch {
    return { id: `inf_${Date.now()}`, name: req.name || '', type: req.type || '', status: 'active', ...req };
  }
}

export async function deleteInfrastructure(id: string): Promise<void> {
  try {
    await del(`/v1/ea/tech/infra/${id}`);
  } catch {
    // mock
  }
}
