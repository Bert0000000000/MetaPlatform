import { get, post } from './client';
import type { OntologyConcept, GraphData, PageResponse } from '@/types';

const CONCEPTS_CACHE_KEY = 'mate_platform_ontology_concepts';
const GRAPH_CACHE_KEY = 'mate_platform_ontology_graph_';

function readLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota errors */
  }
}

/** Default concept sample used when backend is unavailable. */
const DEFAULT_CONCEPTS: OntologyConcept[] = [
  {
    id: 'concept-customer',
    name: '客户',
    definition: '与企业发生交易关系的组织或个人，是销售流程的核心对象。',
    attributes: [
      { name: 'customerId', type: 'string', required: true, description: '客户唯一标识' },
      { name: 'name', type: 'string', required: true, description: '客户名称' },
      { name: 'industry', type: 'string', required: false, description: '所属行业' },
      { name: 'level', type: 'enum', required: false, description: '客户等级（A/B/C）' },
    ],
    instances: [
      { id: 'inst-c-001', name: '北京华夏科技有限公司', values: { industry: '科技', level: 'A' } },
      { id: 'inst-c-002', name: '上海远方贸易', values: { industry: '贸易', level: 'B' } },
    ],
    relatedConcepts: ['concept-contract', 'concept-order'],
  },
  {
    id: 'concept-contract',
    name: '合同',
    definition: '记录客户与企业之间签订的正式协议，关联订单与回款。',
    attributes: [
      { name: 'contractId', type: 'string', required: true, description: '合同编号' },
      { name: 'customerId', type: 'ref', required: true, description: '客户ID' },
      { name: 'amount', type: 'number', required: true, description: '合同金额' },
      { name: 'signDate', type: 'date', required: true, description: '签订日期' },
      { name: 'expireDate', type: 'date', required: false, description: '到期日期' },
    ],
    instances: [
      { id: 'inst-ct-001', name: '2026年度技术服务合同', values: { customerId: 'inst-c-001', amount: 120000, signDate: '2026-01-15' } },
    ],
    relatedConcepts: ['concept-customer', 'concept-order', 'concept-payment'],
  },
  {
    id: 'concept-order',
    name: '订单',
    definition: '客户下达的具体采购订单，关联合同与产品。',
    attributes: [
      { name: 'orderId', type: 'string', required: true, description: '订单编号' },
      { name: 'customerId', type: 'ref', required: true, description: '客户ID' },
      { name: 'contractId', type: 'ref', required: false, description: '关联合同' },
      { name: 'totalAmount', type: 'number', required: true, description: '订单总金额' },
      { name: 'status', type: 'enum', required: true, description: '订单状态' },
    ],
    instances: [
      { id: 'inst-o-001', name: 'PO-20260718-001', values: { customerId: 'inst-c-001', contractId: 'inst-ct-001', totalAmount: 35000, status: '执行中' } },
      { id: 'inst-o-002', name: 'PO-20260718-002', values: { customerId: 'inst-c-002', contractId: '', totalAmount: 8800, status: '已完成' } },
    ],
    relatedConcepts: ['concept-customer', 'concept-contract', 'concept-product'],
  },
  {
    id: 'concept-product',
    name: '产品',
    definition: '企业对外销售的商品或服务，是订单的明细对象。',
    attributes: [
      { name: 'productId', type: 'string', required: true, description: '产品编号' },
      { name: 'name', type: 'string', required: true, description: '产品名称' },
      { name: 'category', type: 'string', required: false, description: '产品分类' },
      { name: 'price', type: 'number', required: true, description: '标准单价' },
    ],
    instances: [
      { id: 'inst-p-001', name: 'Mate Platform 企业版', values: { category: '软件', price: 98000 } },
      { id: 'inst-p-002', name: 'Ontology 咨询服务', values: { category: '服务', price: 1500 } },
    ],
    relatedConcepts: ['concept-order'],
  },
  {
    id: 'concept-payment',
    name: '回款',
    definition: '客户对合同/订单的付款记录，关联财务核算。',
    attributes: [
      { name: 'paymentId', type: 'string', required: true, description: '回款编号' },
      { name: 'contractId', type: 'ref', required: true, description: '关联合同' },
      { name: 'amount', type: 'number', required: true, description: '回款金额' },
      { name: 'payDate', type: 'date', required: true, description: '回款日期' },
    ],
    instances: [
      { id: 'inst-pay-001', name: '首付款 30%', values: { contractId: 'inst-ct-001', amount: 36000, payDate: '2026-01-20' } },
    ],
    relatedConcepts: ['concept-contract'],
  },
];

/** Build a default graph centered on a query keyword. */
function buildDefaultGraph(query: string): GraphData {
  const keyword = query.trim();
  const nodes = DEFAULT_CONCEPTS.map((c) => ({
    id: c.id,
    label: c.name,
    type: 'concept' as const,
  }));
  // Add a few entity instances
  const entityNodes = [
    { id: 'inst-c-001', label: '北京华夏科技', type: 'entity' as const },
    { id: 'inst-c-002', label: '上海远方贸易', type: 'entity' as const },
    { id: 'inst-ct-001', label: '2026年度技术服务合同', type: 'entity' as const },
    { id: 'inst-o-001', label: 'PO-20260718-001', type: 'entity' as const },
  ];
  const edges = [
    { id: 'e-ct-c', source: 'concept-contract', target: 'concept-customer', label: '签订方' },
    { id: 'e-o-c', source: 'concept-order', target: 'concept-customer', label: '下单方' },
    { id: 'e-o-ct', source: 'concept-order', target: 'concept-contract', label: '关联合同' },
    { id: 'e-o-p', source: 'concept-order', target: 'concept-product', label: '包含产品' },
    { id: 'e-pay-ct', source: 'concept-payment', target: 'concept-contract', label: '回款对应' },
    { id: 'e-c-inst1', source: 'concept-customer', target: 'inst-c-001', label: '实例' },
    { id: 'e-c-inst2', source: 'concept-customer', target: 'inst-c-002', label: '实例' },
    { id: 'e-ct-inst1', source: 'concept-contract', target: 'inst-ct-001', label: '实例' },
    { id: 'e-o-inst1', source: 'concept-order', target: 'inst-o-001', label: '实例' },
  ];

  // If keyword mentions a specific concept, filter to its sub-graph
  const lower = keyword.toLowerCase();
  if (lower && DEFAULT_CONCEPTS.some((c) => lower.includes(c.name.toLowerCase()) || lower.includes(c.id))) {
    const matched = DEFAULT_CONCEPTS.filter(
      (c) => lower.includes(c.name.toLowerCase()) || lower.includes(c.id),
    );
    const matchedIds = new Set(matched.flatMap((c) => [c.id, ...c.relatedConcepts]));
    return {
      nodes: [...nodes, ...entityNodes].filter((n) => matchedIds.has(n.id) || n.type === 'entity'),
      edges: edges.filter((e) => matchedIds.has(e.source) && matchedIds.has(e.target)),
    };
  }

  return { nodes: [...nodes, ...entityNodes], edges };
}

/**
 * 查询概念列表（带关键词过滤）。
 * 后端 ConceptController 提供 GET /v1/ont/concepts（返回 PageResponse），
 * 失败时降级到 localStorage 缓存或 DEFAULT_CONCEPTS。
 */
export async function queryConcepts(query: string): Promise<OntologyConcept[]> {
  const keyword = (query || '').trim().toLowerCase();
  try {
    const page = await get<PageResponse<OntologyConcept>>('/v1/ont/concepts');
    const items = page?.items ?? [];
    const filtered = keyword
      ? items.filter(
          (c) =>
            c.name.toLowerCase().includes(keyword) ||
            c.definition.toLowerCase().includes(keyword) ||
            c.id.toLowerCase().includes(keyword),
        )
      : items;
    const result = filtered.length > 0 ? filtered : items;
    writeLocal(CONCEPTS_CACHE_KEY, result);
    return result;
  } catch {
    const cached = readLocal<OntologyConcept[]>(CONCEPTS_CACHE_KEY);
    const base = cached ?? DEFAULT_CONCEPTS;
    return keyword
      ? base.filter(
          (c) =>
            c.name.toLowerCase().includes(keyword) ||
            c.definition.toLowerCase().includes(keyword) ||
            c.id.toLowerCase().includes(keyword),
        )
      : base;
  }
}

/**
 * 查询知识图谱（语义查询）。
 * 后端 GraphController 提供 POST /v1/ont/graph/query（接受 GraphQueryRequest）。
 * 失败时降级到 localStorage 缓存或 buildDefaultGraph(query)。
 */
export async function semanticQuery(query: string): Promise<GraphData> {
  const cacheKey = GRAPH_CACHE_KEY + query.slice(0, 32);
  try {
    const graph = await post<GraphData>('/v1/ont/graph/query', { query, depth: 2 });
    if (graph && graph.nodes) {
      writeLocal(cacheKey, graph);
      return graph;
    }
    throw new Error('Empty graph response');
  } catch {
    const cached = readLocal<GraphData>(cacheKey);
    if (cached) return cached;
    const fallback = buildDefaultGraph(query);
    writeLocal(cacheKey, fallback);
    return fallback;
  }
}

/** 带深度参数的图谱查询（用于 ExplorePanel 高级模式）。 */
export async function queryGraph(query: string, depth: number): Promise<GraphData> {
  const cacheKey = `${GRAPH_CACHE_KEY}d${depth}_${query.slice(0, 32)}`;
  try {
    const graph = await post<GraphData>('/v1/ont/graph/query', { query, depth });
    if (graph && graph.nodes) {
      writeLocal(cacheKey, graph);
      return graph;
    }
    throw new Error('Empty graph response');
  } catch {
    const cached = readLocal<GraphData>(cacheKey);
    if (cached) return cached;
    const fallback = buildDefaultGraph(query);
    writeLocal(cacheKey, fallback);
    return fallback;
  }
}

/**
 * 获取概念详情。
 * 后端 ConceptController 提供 GET /v1/ont/concepts/{conceptId}。
 * 失败时降级到 DEFAULT_CONCEPTS。
 */
export async function getConceptDetail(conceptId: string): Promise<OntologyConcept> {
  try {
    return await get<OntologyConcept>(`/v1/ont/concepts/${conceptId}`);
  } catch {
    const cached = readLocal<OntologyConcept[]>(CONCEPTS_CACHE_KEY) ?? DEFAULT_CONCEPTS;
    const found = cached.find((c) => c.id === conceptId);
    if (found) return found;
    return DEFAULT_CONCEPTS[0];
  }
}
