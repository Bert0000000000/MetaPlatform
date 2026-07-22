import { get, post } from './client';
import type { OntologyConcept, GraphData, GraphNode, GraphEdge } from '@/types';

/**
 * Ontology 探索 API（V12-01 REQ-030~037）。
 * 直接对接 TECH-ONT 后端，不做任何 mock 兜底。
 *
 * 后端端点：
 *   GET  /v1/ont/concepts/search?keyword=&attribute=&tag=    REQ-030
 *   GET  /v1/ont/concepts/{conceptId}/detail                  REQ-031
 *   POST /v1/ont/graph/query                                  REQ-032 / REQ-034
 *   GET  /v1/ont/graph/expand?nodeId=&depth=                  REQ-035
 */

/** 后端 GraphNodeDto 形状（与 GraphNode 略有差异，需做映射）。 */
interface GraphNodeDto {
  id: string;
  label: string;
  type?: string;
  properties?: Record<string, unknown>;
}

/** 后端 GraphEdgeDto 形状。 */
interface GraphEdgeDto {
  id: string;
  source: string;
  target: string;
  type?: string;
  label?: string;
  properties?: Record<string, unknown>;
}

interface GraphQueryResponse {
  nodes: GraphNodeDto[];
  edges: GraphEdgeDto[];
}

interface GraphQueryRequest {
  startNodeId?: string;
  query?: string;
  depth?: number;
  relationType?: string;
  nodeTypes?: string[];
  properties?: Record<string, unknown>;
  tags?: string[];
}

/** 将后端 GraphNodeDto/GraphEdgeDto 映射为前端 GraphData。 */
function toGraphData(resp: GraphQueryResponse | null | undefined): GraphData {
  if (!resp) {
    return { nodes: [], edges: [] };
  }
  const nodes: GraphNode[] = (resp.nodes || []).map((n) => ({
    id: n.id,
    label: n.label,
    type: (n.type as GraphNode['type']) || 'entity',
    properties: n.properties,
  }));
  const edges: GraphEdge[] = (resp.edges || []).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label || e.type || 'RELATED_TO',
  }));
  return { nodes, edges };
}

/**
 * 概念搜索（REQ-030）。
 * 支持按关键字、属性、标签过滤。
 */
export async function searchConcepts(
  keyword?: string,
  attribute?: string,
  tag?: string,
): Promise<OntologyConcept[]> {
  const params: Record<string, string> = {};
  if (keyword) params.keyword = keyword;
  if (attribute) params.attribute = attribute;
  if (tag) params.tag = tag;
  return get<OntologyConcept[]>('/v1/ont/concepts/search', params);
}

/**
 * 兼容旧调用：等价于 searchConcepts(keyword)。
 * ExplorePanel 仍用 queryConcepts 这个名字，保留导出避免大改。
 */
export async function queryConcepts(query: string): Promise<OntologyConcept[]> {
  const trimmed = (query || '').trim();
  return searchConcepts(trimmed || undefined);
}

/**
 * 概念详情（REQ-031）。返回完整属性、实例、关联概念。
 */
export async function getConceptDetail(conceptId: string): Promise<OntologyConcept> {
  return get<OntologyConcept>(`/v1/ont/concepts/${conceptId}/detail`);
}

/**
 * 语义查询知识图谱（REQ-032 / REQ-034）。
 * 以自然语言/关键字作为起点扩展子图。
 */
export async function semanticQuery(query: string): Promise<GraphData> {
  const body: GraphQueryRequest = { query, depth: 2 };
  const resp = await post<GraphQueryResponse>('/v1/ont/graph/query', body);
  return toGraphData(resp);
}

/**
 * 带深度参数的图谱查询（用于 ExplorePanel 高级模式）。
 */
export async function queryGraph(query: string, depth: number): Promise<GraphData> {
  const body: GraphQueryRequest = { query, depth };
  const resp = await post<GraphQueryResponse>('/v1/ont/graph/query', body);
  return toGraphData(resp);
}

/**
 * 图谱筛选（REQ-034）：按节点类型、属性、标签过滤。
 */
export async function filterGraph(
  query: string,
  options: {
    depth?: number;
    nodeTypes?: string[];
    properties?: Record<string, unknown>;
    tags?: string[];
    relationType?: string;
  } = {},
): Promise<GraphData> {
  const body: GraphQueryRequest = {
    query,
    depth: options.depth ?? 2,
    nodeTypes: options.nodeTypes,
    properties: options.properties,
    tags: options.tags,
    relationType: options.relationType,
  };
  const resp = await post<GraphQueryResponse>('/v1/ont/graph/query', body);
  return toGraphData(resp);
}

/**
 * 节点展开（REQ-035）：返回某节点的 N 跳邻居子图。
 * 用于 KnowledgeGraph 点击节点时增量加载子节点。
 */
export async function expandGraphNode(nodeId: string, depth = 1): Promise<GraphData> {
  const params: Record<string, string | number> = { nodeId, depth };
  const resp = await get<GraphQueryResponse>('/v1/ont/graph/expand', params);
  return toGraphData(resp);
}
