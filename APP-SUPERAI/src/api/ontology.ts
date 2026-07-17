import { get, post } from './client';
import type { OntologyConcept, GraphData, GraphNode, GraphEdge } from '@/types';

const MOCK_CONCEPTS: OntologyConcept[] = [
  {
    id: 'concept-customer',
    name: '客户',
    definition: '客户是企业服务的对象，包含基本信息、联系方式和交易记录。',
    attributes: [
      { name: 'customerName', type: 'string', required: true, description: '客户名称' },
      { name: 'contactPhone', type: 'string', required: false, description: '联系电话' },
      { name: 'customerLevel', type: 'enum', required: true, description: '客户等级（A/B/C）' },
      { name: 'industry', type: 'string', required: false, description: '所属行业' },
    ],
    instances: [
      { id: 'inst-1', name: '上海科技有限公司', values: { customerName: '上海科技有限公司', customerLevel: 'A', industry: '科技' } },
      { id: 'inst-2', name: '北京制造集团', values: { customerName: '北京制造集团', customerLevel: 'B', industry: '制造' } },
    ],
    relatedConcepts: ['合同', '订单', '联系人'],
  },
  {
    id: 'concept-contract',
    name: '合同',
    definition: '合同是与客户签订的业务协议，包含金额、期限和条款。',
    attributes: [
      { name: 'contractNo', type: 'string', required: true, description: '合同编号' },
      { name: 'amount', type: 'number', required: true, description: '合同金额' },
      { name: 'startDate', type: 'date', required: true, description: '开始日期' },
      { name: 'endDate', type: 'date', required: true, description: '结束日期' },
      { name: 'status', type: 'enum', required: true, description: '状态' },
    ],
    instances: [
      { id: 'inst-3', name: '2026年度技术服务合同', values: { contractNo: 'HT-2026-001', amount: 500000, status: 'active' } },
    ],
    relatedConcepts: ['客户', '订单'],
  },
  {
    id: 'concept-order',
    name: '订单',
    definition: '订单是客户产生的交易记录，关联合同和产品。',
    attributes: [
      { name: 'orderNo', type: 'string', required: true, description: '订单编号' },
      { name: 'amount', type: 'number', required: true, description: '订单金额' },
      { name: 'orderDate', type: 'date', required: true, description: '下单日期' },
      { name: 'status', type: 'enum', required: true, description: '订单状态' },
    ],
    instances: [
      { id: 'inst-4', name: '订单 #20260701', values: { orderNo: 'ORD-20260701', amount: 50000, status: 'completed' } },
      { id: 'inst-5', name: '订单 #20260702', values: { orderNo: 'ORD-20260702', amount: 120000, status: 'pending' } },
    ],
    relatedConcepts: ['客户', '合同', '产品'],
  },
  {
    id: 'concept-product',
    name: '产品',
    definition: '产品是企业销售的商品或服务。',
    attributes: [
      { name: 'productName', type: 'string', required: true, description: '产品名称' },
      { name: 'price', type: 'number', required: true, description: '单价' },
      { name: 'category', type: 'string', required: false, description: '产品分类' },
    ],
    instances: [
      { id: 'inst-6', name: 'Mate Platform 企业版', values: { productName: 'Mate Platform 企业版', price: 200000, category: '软件' } },
    ],
    relatedConcepts: ['订单'],
  },
  {
    id: 'concept-employee',
    name: '员工',
    definition: '员工是企业内部人员，负责业务操作和审批。',
    attributes: [
      { name: 'employeeName', type: 'string', required: true, description: '员工姓名' },
      { name: 'department', type: 'string', required: true, description: '所属部门' },
      { name: 'position', type: 'string', required: false, description: '职位' },
    ],
    instances: [
      { id: 'inst-7', name: '张三', values: { employeeName: '张三', department: '销售部', position: '销售经理' } },
    ],
    relatedConcepts: ['部门', '订单'],
  },
];

const MOCK_GRAPH: GraphData = {
  nodes: [
    { id: 'concept-customer', label: '客户', type: 'concept' },
    { id: 'concept-contract', label: '合同', type: 'concept' },
    { id: 'concept-order', label: '订单', type: 'concept' },
    { id: 'concept-product', label: '产品', type: 'concept' },
    { id: 'concept-employee', label: '员工', type: 'concept' },
    { id: 'inst-1', label: '上海科技有限公司', type: 'entity' },
    { id: 'inst-2', label: '北京制造集团', type: 'entity' },
    { id: 'inst-3', label: '2026年度技术服务合同', type: 'entity' },
    { id: 'inst-4', label: '订单 #20260701', type: 'entity' },
    { id: 'inst-6', label: 'Mate Platform 企业版', type: 'entity' },
  ],
  edges: [
    { id: 'e1', source: 'concept-customer', target: 'concept-contract', label: '签订' },
    { id: 'e2', source: 'concept-customer', target: 'concept-order', label: '下单' },
    { id: 'e3', source: 'concept-contract', target: 'concept-order', label: '关联' },
    { id: 'e4', source: 'concept-order', target: 'concept-product', label: '包含' },
    { id: 'e5', source: 'concept-employee', target: 'concept-order', label: '处理' },
    { id: 'e6', source: 'inst-1', target: 'concept-customer', label: '实例' },
    { id: 'e7', source: 'inst-2', target: 'concept-customer', label: '实例' },
    { id: 'e8', source: 'inst-3', target: 'concept-contract', label: '实例' },
    { id: 'e9', source: 'inst-4', target: 'concept-order', label: '实例' },
    { id: 'e10', source: 'inst-6', target: 'concept-product', label: '实例' },
  ],
};

export async function queryConcepts(query: string): Promise<OntologyConcept[]> {
  try {
    return await get<OntologyConcept[]>('/v1/ont/concepts/search', { q: query });
  } catch {
    const lower = query.toLowerCase();
    return MOCK_CONCEPTS.filter(
      (c) => !query || c.name.toLowerCase().includes(lower) || c.definition.toLowerCase().includes(lower),
    );
  }
}

export async function queryGraph(query: string, depth: number): Promise<GraphData> {
  try {
    return await post<GraphData>('/v1/ont/graph/query', { query, depth });
  } catch {
    return mockQueryGraph(query, depth);
  }
}

export async function semanticQuery(query: string): Promise<GraphData> {
  try {
    return await post<GraphData>('/v1/ont/semantic-query', { query });
  } catch {
    return mockQueryGraph(query, 2);
  }
}

export async function getConceptDetail(conceptId: string): Promise<OntologyConcept> {
  try {
    return await get<OntologyConcept>(`/v1/ont/concepts/${conceptId}`);
  } catch {
    const concept = MOCK_CONCEPTS.find((c) => c.id === conceptId);
    if (!concept) throw new Error('概念不存在');
    return concept;
  }
}

function mockQueryGraph(query: string, depth: number): GraphData {
  const lower = query.toLowerCase();

  const matchedConcepts = MOCK_CONCEPTS.filter(
    (c) => !query || c.name.toLowerCase().includes(lower) || c.definition.toLowerCase().includes(lower),
  );

  if (matchedConcepts.length === 0) {
    return MOCK_GRAPH;
  }

  const conceptIds = new Set(matchedConcepts.map((c) => c.id));
  const relatedIds = new Set<string>();
  matchedConcepts.forEach((c) => c.relatedConcepts.forEach((r) => relatedIds.add(r)));

  const allRelevantIds = new Set([...conceptIds, ...relatedIds]);

  const nodes: GraphNode[] = MOCK_GRAPH.nodes.filter(
    (n) => allRelevantIds.has(n.id) || n.type === 'entity',
  );

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: GraphEdge[] = MOCK_GRAPH.edges.filter(
    (e) => nodeIds.has(e.source) && nodeIds.has(e.target),
  );

  if (depth <= 1) {
    const conceptNodes = nodes.filter((n) => n.type === 'concept');
    const conceptNodeIds = new Set(conceptNodes.map((n) => n.id));
    return {
      nodes: conceptNodes,
      edges: edges.filter((e) => conceptNodeIds.has(e.source) && conceptNodeIds.has(e.target)),
    };
  }

  return { nodes, edges };
}
