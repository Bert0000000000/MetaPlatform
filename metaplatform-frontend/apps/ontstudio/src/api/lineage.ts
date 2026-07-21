import { get, post } from './client';
import type { DataLineage, LineageImpactResult } from '@/types';

/**
 * 获取血缘图。
 * 后端路径：GET /v1/data/lineage?scope=xxx
 */
export async function getLineage(scope = 'all'): Promise<DataLineage> {
  const data = await get<DataLineage>('/v1/data/lineage', { scope });
  return data;
}

/**
 * 获取以指定节点为根的子树血缘。
 * 后端路径：GET /v1/data/lineage/{nodeId}
 */
export async function getLineageByNode(nodeId: string): Promise<DataLineage> {
  const data = await get<DataLineage>(`/v1/data/lineage/${nodeId}`);
  return data;
}

/**
 * 影响分析：修改某节点后受影响的上下游节点。
 * 后端路径：POST /v1/data/lineage/impact  body: { nodeId }
 */
export async function analyzeImpact(nodeId: string): Promise<LineageImpactResult> {
  return await post<LineageImpactResult>('/v1/data/lineage/impact', { nodeId });
}
