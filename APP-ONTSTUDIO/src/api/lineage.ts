import { get, post } from './client';
import type { DataLineage, LineageImpactResult } from '@/types';

const LINEAGE_CACHE_KEY = 'mate_platform_lineage_';

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
    /* ignore */
  }
}

/**
 * 默认血缘图：展示一个完整的"数据源 → 映射 → 概念/实体 → 关系 → Action"链路。
 */
function buildDefaultLineage(scope: string): DataLineage {
  const nodes = [
    // 数据源层
    { id: 'ds-crm', label: 'CRM 数据库', type: 'datasource' as const, metadata: { sourceType: 'mysql', status: 'active' } },
    { id: 'ds-erp', label: 'ERP 数据库', type: 'datasource' as const, metadata: { sourceType: 'postgresql', status: 'active' } },
    { id: 'ds-api', label: '外部客户 API', type: 'datasource' as const, metadata: { sourceType: 'api', status: 'active' } },

    // 表层
    { id: 'tbl-crm-cust', label: 'crm.customer', type: 'table' as const, parentId: 'ds-crm' },
    { id: 'tbl-crm-cont', label: 'crm.contract', type: 'table' as const, parentId: 'ds-crm' },
    { id: 'tbl-erp-order', label: 'erp.sales_order', type: 'table' as const, parentId: 'ds-erp' },
    { id: 'tbl-erp-pay', label: 'erp.payment', type: 'table' as const, parentId: 'ds-erp' },

    // 字段层
    { id: 'fld-cust-id', label: 'customer_id', type: 'field' as const, parentId: 'tbl-crm-cust' },
    { id: 'fld-cust-name', label: 'name', type: 'field' as const, parentId: 'tbl-crm-cust' },
    { id: 'fld-cust-level', label: 'level', type: 'field' as const, parentId: 'tbl-crm-cust' },
    { id: 'fld-cont-amount', label: 'amount', type: 'field' as const, parentId: 'tbl-crm-cont' },
    { id: 'fld-order-amt', label: 'total_amount', type: 'field' as const, parentId: 'tbl-erp-order' },

    // 映射层
    {
      id: 'map-cust',
      label: '客户映射',
      type: 'mapping' as const,
      metadata: { schedule: '0 */5 * * *', status: 'active' },
    },
    {
      id: 'map-cont',
      label: '合同映射',
      type: 'mapping' as const,
      metadata: { schedule: '0 */10 * * *', status: 'active' },
    },
    {
      id: 'map-order',
      label: '订单映射',
      type: 'mapping' as const,
      metadata: { schedule: '0 */5 * * *', status: 'active' },
    },

    // 概念层
    { id: 'concept-customer', label: '客户', type: 'concept' as const },
    { id: 'concept-contract', label: '合同', type: 'concept' as const },
    { id: 'concept-order', label: '订单', type: 'concept' as const },
    { id: 'concept-payment', label: '回款', type: 'concept' as const },

    // 属性层
    { id: 'attr-cust-id', label: 'customerId', type: 'attribute' as const, parentId: 'concept-customer' },
    { id: 'attr-cust-name', label: 'name', type: 'attribute' as const, parentId: 'concept-customer' },
    { id: 'attr-cust-level', label: 'level', type: 'attribute' as const, parentId: 'concept-customer' },
    { id: 'attr-cont-amt', label: 'amount', type: 'attribute' as const, parentId: 'concept-contract' },
    { id: 'attr-order-amt', label: 'totalAmount', type: 'attribute' as const, parentId: 'concept-order' },

    // 实体层
    { id: 'ent-c-001', label: '北京华夏科技', type: 'entity' as const },
    { id: 'ent-ct-001', label: '2026年度技术服务合同', type: 'entity' as const },
    { id: 'ent-o-001', label: 'PO-20260718-001', type: 'entity' as const },

    // 关系层
    { id: 'rel-ct-c', label: '签订方', type: 'relation' as const },
    { id: 'rel-o-ct', label: '关联合同', type: 'relation' as const },

    // Action 层
    { id: 'action-renew-remind', label: '续签提醒 Action', type: 'action' as const },
    { id: 'action-overdue-report', label: '逾期回款报表 Action', type: 'action' as const },

    // 输出层
    { id: 'out-email', label: '邮件通知', type: 'output' as const },
    { id: 'out-report', label: '财务周报', type: 'output' as const },
  ];

  const edges = [
    // 数据源 → 表
    { id: 'e1', source: 'ds-crm', target: 'tbl-crm-cust', kind: 'flow' as const },
    { id: 'e2', source: 'ds-crm', target: 'tbl-crm-cont', kind: 'flow' as const },
    { id: 'e3', source: 'ds-erp', target: 'tbl-erp-order', kind: 'flow' as const },
    { id: 'e4', source: 'ds-erp', target: 'tbl-erp-pay', kind: 'flow' as const },

    // 表 → 字段
    { id: 'e5', source: 'tbl-crm-cust', target: 'fld-cust-id', kind: 'flow' as const },
    { id: 'e6', source: 'tbl-crm-cust', target: 'fld-cust-name', kind: 'flow' as const },
    { id: 'e7', source: 'tbl-crm-cust', target: 'fld-cust-level', kind: 'flow' as const },
    { id: 'e8', source: 'tbl-crm-cont', target: 'fld-cont-amount', kind: 'flow' as const },
    { id: 'e9', source: 'tbl-erp-order', target: 'fld-order-amt', kind: 'flow' as const },

    // 字段 → 映射（含转换）
    {
      id: 'e10',
      source: 'fld-cust-id',
      target: 'map-cust',
      kind: 'mapping' as const,
      label: '直接映射',
    },
    {
      id: 'e11',
      source: 'fld-cust-name',
      target: 'map-cust',
      kind: 'mapping' as const,
      label: 'trim + uppercase',
    },
    {
      id: 'e12',
      source: 'fld-cust-level',
      target: 'map-cust',
      kind: 'mapping' as const,
      label: 'A/B/C → 优/良/一般',
    },
    { id: 'e13', source: 'fld-cont-amount', target: 'map-cont', kind: 'mapping' as const, label: '数值校验' },
    { id: 'e14', source: 'fld-order-amt', target: 'map-order', kind: 'mapping' as const, label: '汇总求和' },

    // 映射 → 概念属性
    { id: 'e15', source: 'map-cust', target: 'attr-cust-id', kind: 'flow' as const },
    { id: 'e16', source: 'map-cust', target: 'attr-cust-name', kind: 'flow' as const },
    { id: 'e17', source: 'map-cust', target: 'attr-cust-level', kind: 'flow' as const },
    { id: 'e18', source: 'map-cont', target: 'attr-cont-amt', kind: 'flow' as const },
    { id: 'e19', source: 'map-order', target: 'attr-order-amt', kind: 'flow' as const },

    // 属性 → 实体
    { id: 'e20', source: 'attr-cust-id', target: 'ent-c-001', kind: 'reference' as const },
    { id: 'e21', source: 'attr-cont-amt', target: 'ent-ct-001', kind: 'reference' as const },
    { id: 'e22', source: 'attr-order-amt', target: 'ent-o-001', kind: 'reference' as const },

    // 实体 → 关系
    { id: 'e23', source: 'ent-ct-001', target: 'rel-ct-c', kind: 'reference' as const },
    { id: 'e24', source: 'ent-c-001', target: 'rel-ct-c', kind: 'reference' as const },
    { id: 'e25', source: 'ent-o-001', target: 'rel-o-ct', kind: 'reference' as const },
    { id: 'e26', source: 'ent-ct-001', target: 'rel-o-ct', kind: 'reference' as const },

    // 关系/概念 → Action
    {
      id: 'e27',
      source: 'concept-contract',
      target: 'action-renew-remind',
      kind: 'trigger' as const,
      label: '合同到期前 30 天触发',
    },
    {
      id: 'e28',
      source: 'concept-payment',
      target: 'action-overdue-report',
      kind: 'trigger' as const,
      label: '回款逾期 7 天触发',
    },

    // Action → 输出
    { id: 'e29', source: 'action-renew-remind', target: 'out-email', kind: 'flow' as const },
    { id: 'e30', source: 'action-overdue-report', target: 'out-report', kind: 'flow' as const },
  ];

  // 按 scope 过滤
  const lower = scope.toLowerCase();
  if (!lower || lower === 'all' || lower === 'full') {
    return { nodes, edges, rootId: 'ds-crm' };
  }

  // 查找匹配节点
  const matched = nodes.filter(
    (n) =>
      n.label.toLowerCase().includes(lower) ||
      n.id.toLowerCase().includes(lower) ||
      n.metadata?.conceptId?.toLowerCase().includes(lower),
  );

  if (matched.length === 0) {
    return { nodes, edges, rootId: 'ds-crm' };
  }

  // BFS：找出所有上下游关联节点
  const matchedIds = new Set(matched.map((n) => n.id));
  const related = new Set<string>(matchedIds);
  let frontier = [...matchedIds];
  let upstream = true;

  // 反向遍历（找上游）
  while (upstream) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const edge of edges) {
        if (edge.target === id && !related.has(edge.source)) {
          related.add(edge.source);
          next.push(edge.source);
        }
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }

  // 正向遍历（找下游）
  frontier = [...matchedIds];
  while (true) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const edge of edges) {
        if (edge.source === id && !related.has(edge.target)) {
          related.add(edge.target);
          next.push(edge.target);
        }
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }

  const filteredNodes = nodes.filter((n) => related.has(n.id));
  const filteredEdges = edges.filter((e) => related.has(e.source) && related.has(e.target));

  return {
    nodes: filteredNodes,
    edges: filteredEdges,
    rootId: matched[0]?.id,
  };
}

/**
 * 获取血缘图。
 * 后端路径：GET /v1/data/lineage?scope=xxx
 */
export async function getLineage(scope = 'all'): Promise<DataLineage> {
  const cacheKey = LINEAGE_CACHE_KEY + scope;
  try {
    const lineage = await get<DataLineage>('/v1/data/lineage', { scope });
    if (lineage && lineage.nodes) {
      writeLocal(cacheKey, lineage);
      return lineage;
    }
    throw new Error('Empty lineage');
  } catch {
    const cached = readLocal<DataLineage>(cacheKey);
    if (cached) return cached;
    const fallback = buildDefaultLineage(scope);
    writeLocal(cacheKey, fallback);
    return fallback;
  }
}

/**
 * 获取以指定节点为根的子树血缘。
 * 后端路径：GET /v1/data/lineage/{nodeId}
 */
export async function getLineageByNode(nodeId: string): Promise<DataLineage> {
  const cacheKey = LINEAGE_CACHE_KEY + 'node_' + nodeId;
  try {
    const lineage = await get<DataLineage>(`/v1/data/lineage/${nodeId}`);
    if (lineage && lineage.nodes) {
      writeLocal(cacheKey, lineage);
      return lineage;
    }
    throw new Error('Empty lineage');
  } catch {
    const cached = readLocal<DataLineage>(cacheKey);
    if (cached) return cached;
    // 用 buildDefaultLineage 拿到全图，然后过滤
    const full = buildDefaultLineage(nodeId);
    writeLocal(cacheKey, full);
    return full;
  }
}

/**
 * 影响分析：修改某节点后受影响的上下游节点。
 * 后端路径：POST /v1/data/lineage/impact  body: { nodeId }
 */
export async function analyzeImpact(nodeId: string): Promise<LineageImpactResult> {
  try {
    return await post<LineageImpactResult>('/v1/data/lineage/impact', { nodeId });
  } catch {
    // Best-effort: 基于本地缓存计算
    const cached = readLocal<DataLineage>(LINEAGE_CACHE_KEY + 'all');
    const lineage = cached ?? buildDefaultLineage('all');
    const impacted = new Set<string>([nodeId]);

    // 下游
    let frontier = [nodeId];
    while (true) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const edge of lineage.edges) {
          if (edge.source === id && !impacted.has(edge.target)) {
            impacted.add(edge.target);
            next.push(edge.target);
          }
        }
      }
      if (next.length === 0) break;
      frontier = next;
    }
    const downstreamCount = impacted.size - 1;

    // 上游
    const upstreamSet = new Set<string>();
    frontier = [nodeId];
    while (true) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const edge of lineage.edges) {
          if (edge.target === id && !upstreamSet.has(edge.source) && !impacted.has(edge.source)) {
            upstreamSet.add(edge.source);
            next.push(edge.source);
          }
        }
      }
      if (next.length === 0) break;
      frontier = next;
    }

    return {
      impactedNodes: Array.from(impacted),
      upstreamCount: upstreamSet.size,
      downstreamCount,
      impactPath: [nodeId, ...Array.from(upstreamSet).slice(0, 3)],
    };
  }
}
