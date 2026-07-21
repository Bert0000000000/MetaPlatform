import { get, post, put, del } from './client';
import type {
  DecisionTable,
  DecisionTablePayload,
  DecisionTableExecutionResult,
  HitPolicy,
} from '@/types';

export const HIT_POLICY_OPTIONS: Array<{ label: string; value: HitPolicy; description: string }> = [
  { label: '首次命中', value: 'first', description: '从上到下匹配第一条命中规则，返回其输出' },
  { label: '全部命中', value: 'all', description: '返回所有命中规则的输出（顺序敏感）' },
  { label: '优先级', value: 'priority', description: '按 priority 升序返回所有命中规则输出' },
  { label: '唯一命中', value: 'unique', description: '仅当恰好命中一条规则时返回，否则报错' },
  { label: '聚合', value: 'collect', description: '收集所有命中规则的输出列表' },
];

/**
 * V11-03: APP-ONTSTUDIO 决策表 API 后端化。
 *
 * 后端在 TECH-RULE 的 DecisionTableController 实现完整 CRUD + execute：
 *   - GET    /v1/rule/decision-tables              分页列表（已聚合 rows）
 *   - GET    /v1/rule/decision-tables/:id          详情（已聚合 rows）
 *   - POST   /v1/rule/decision-tables              创建
 *   - PUT    /v1/rule/decision-tables/:id          更新
 *   - DELETE /v1/rule/decision-tables/:id          删除
 *   - POST   /v1/rule/decision-tables/:id/execute  执行
 *
 * 后端响应字段说明：
 *   - columns: 合并后的 inputColumns + outputColumns（每列含 columnType: INPUT/OUTPUT）
 *   - rows: 内联行数据（含 inputValues/outputValues map）
 *   - enabled: 由 status 派生（status !== 'ARCHIVED'）
 *   - conceptId: V1.1 阶段暂用 rulesetId 兼容，V1.2 阶段会通过 Ontology 关联表填充
 *
 * 前端 DecisionTable 类型期望字段：
 *   - columns[].operator / rows[].cells / rows[].priority / rows[].description
 *
 * 由于后端 V1.1 schema 暂未独立存储 operator/cells/priority/description，
 * 此处通过 `normalizeTable` 做兼容映射，等 V1.2 后端补齐后再去掉。
 */

/** 后端原始响应（部分关键字段，便于类型推导）。 */
interface DecisionTableBackend {
  id: string;
  code: string;
  name: string;
  description?: string;
  rulesetId?: string;
  conceptId?: string;
  hitPolicy: string;
  columns?: Array<{
    id: string;
    name: string;
    field: string;
    columnType: 'INPUT' | 'OUTPUT' | string;
    dataType?: string;
    expression?: string;
  }>;
  inputColumns?: DecisionTableBackend['columns'];
  outputColumns?: DecisionTableBackend['columns'];
  rows?: Array<{
    id: string;
    rowOrder?: number;
    inputValues?: Record<string, unknown>;
    outputValues?: Record<string, unknown>;
    enabled?: boolean;
  }>;
  status?: string;
  enabled?: boolean;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

function normalizeHitPolicy(raw: string | undefined): HitPolicy {
  if (!raw) return 'first';
  const lower = raw.toLowerCase();
  if (lower === 'first' || lower === 'all' || lower === 'priority' || lower === 'unique' || lower === 'collect') {
    return lower as HitPolicy;
  }
  return 'first';
}

function normalizeTable(raw: DecisionTableBackend): DecisionTable {
  const inputCols = raw.inputColumns ?? [];
  const outputCols = raw.outputColumns ?? [];
  const allCols = raw.columns ?? [...inputCols, ...outputCols];

  const columns = allCols.map((c) => ({
    id: c.id,
    name: c.name,
    field: c.field,
    columnType: (c.columnType?.toLowerCase() === 'output' ? 'output' : 'input') as 'input' | 'output',
    operator: 'eq' as const,
  }));

  const rows = (raw.rows ?? []).map((r) => {
    const cells: Record<string, { value: string; isEmpty?: boolean }> = {};
    const inputVals = r.inputValues ?? {};
    const outputVals = r.outputValues ?? {};
    for (const col of allCols) {
      const source = col.columnType?.toLowerCase() === 'output' ? outputVals : inputVals;
      const v = source[col.field];
      if (v === undefined || v === null || v === '') {
        cells[col.id] = { value: '-', isEmpty: true };
      } else {
        cells[col.id] = { value: typeof v === 'string' ? v : String(v) };
      }
    }
    return {
      id: r.id,
      cells,
      enabled: r.enabled ?? true,
      priority: r.rowOrder ?? 0,
      description: '',
    };
  });

  return {
    id: raw.id,
    code: raw.code,
    name: raw.name,
    description: raw.description ?? '',
    conceptId: raw.conceptId ?? raw.rulesetId,
    hitPolicy: normalizeHitPolicy(raw.hitPolicy),
    columns,
    rows,
    enabled: raw.enabled ?? (raw.status !== 'ARCHIVED'),
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? '',
  };
}

/** 后端执行结果原始响应。 */
interface DecisionTableExecutionBackend {
  matchedRows?: Array<{
    id: string;
    inputValues?: Record<string, unknown>;
    outputValues?: Record<string, unknown>;
    enabled?: boolean;
    rowOrder?: number;
  }>;
  outputs?: Record<string, unknown>[];
  executionTimeMs?: number;
}

function normalizeExecution(raw: DecisionTableExecutionBackend, table?: DecisionTable): DecisionTableExecutionResult {
  const columns = table?.columns ?? [];
  const matchedRows = (raw.matchedRows ?? []).map((r) => {
    const cells: Record<string, { value: string; isEmpty?: boolean }> = {};
    for (const col of columns) {
      const source = col.columnType === 'output' ? r.outputValues : r.inputValues;
      const v = source?.[col.field];
      if (v === undefined || v === null || v === '') {
        cells[col.id] = { value: '-', isEmpty: true };
      } else {
        cells[col.id] = { value: typeof v === 'string' ? v : String(v) };
      }
    }
    return {
      id: r.id,
      cells,
      enabled: r.enabled ?? true,
      priority: r.rowOrder ?? 0,
      description: '',
    };
  });
  return {
    matchedRows,
    outputs: raw.outputs ?? [],
  };
}

/**
 * 列出决策表（可选按 conceptId 过滤）。
 * 后端路径：GET /v1/rule/decision-tables
 */
export async function listDecisionTables(conceptId?: string): Promise<DecisionTable[]> {
  const res = await get<{ items: DecisionTableBackend[] } | DecisionTableBackend[]>('/v1/rule/decision-tables');
  const list = Array.isArray(res) ? res : (res?.items ?? []);
  const normalized = list.map(normalizeTable);
  if (!conceptId) return normalized;
  return normalized.filter((t) => t.conceptId === conceptId);
}

/**
 * 获取单个决策表。
 * 后端路径：GET /v1/rule/decision-tables/:id
 */
export async function getDecisionTable(id: string): Promise<DecisionTable> {
  const raw = await get<DecisionTableBackend>(`/v1/rule/decision-tables/${id}`);
  return normalizeTable(raw);
}

/**
 * 创建决策表。
 * 后端路径：POST /v1/rule/decision-tables
 */
export async function createDecisionTable(payload: DecisionTablePayload): Promise<DecisionTable> {
  // 前端 payload 字段 -> 后端 CreateDecisionTableRequest 字段映射
  const body = {
    name: payload.name,
    code: payload.code,
    description: payload.description,
    rulesetId: payload.conceptId,
    hitPolicy: payload.hitPolicy.toUpperCase(),
    inputColumns: payload.columns
      .filter((c) => c.columnType === 'input')
      .map((c) => ({
        id: c.id,
        name: c.name,
        field: c.field,
        dataType: 'string',
        expression: c.operator ?? 'eq',
        columnType: 'INPUT',
      })),
    outputColumns: payload.columns
      .filter((c) => c.columnType === 'output')
      .map((c) => ({
        id: c.id,
        name: c.name,
        field: c.field,
        dataType: 'string',
        expression: c.defaultValue ?? '',
        columnType: 'OUTPUT',
      })),
  };
  const raw = await post<DecisionTableBackend>('/v1/rule/decision-tables', body);
  return normalizeTable(raw);
}

/**
 * 更新决策表。
 * 后端路径：PUT /v1/rule/decision-tables/:id
 *
 * 注意：后端 update 接口当前不支持整表替换 columns/rows，仅更新元信息。
 * 完整列/行变更应通过 addColumn/updateColumn/addRow/updateRow 等子端点。
 * 此处仅更新基础字段，rows/columns 后续走子端点。
 */
export async function updateDecisionTable(
  id: string,
  payload: DecisionTablePayload,
): Promise<DecisionTable> {
  const body = {
    name: payload.name,
    description: payload.description,
    hitPolicy: payload.hitPolicy.toUpperCase(),
    status: payload.enabled ? 'PUBLISHED' : 'ARCHIVED',
    inputColumns: payload.columns
      .filter((c) => c.columnType === 'input')
      .map((c) => ({
        id: c.id,
        name: c.name,
        field: c.field,
        dataType: 'string',
        expression: c.operator ?? 'eq',
        columnType: 'INPUT',
      })),
    outputColumns: payload.columns
      .filter((c) => c.columnType === 'output')
      .map((c) => ({
        id: c.id,
        name: c.name,
        field: c.field,
        dataType: 'string',
        expression: c.defaultValue ?? '',
        columnType: 'OUTPUT',
      })),
  };
  const raw = await put<DecisionTableBackend>(`/v1/rule/decision-tables/${id}`, body);
  return normalizeTable(raw);
}

/**
 * 删除决策表。
 * 后端路径：DELETE /v1/rule/decision-tables/:id
 */
export async function deleteDecisionTable(id: string): Promise<void> {
  await del<void>(`/v1/rule/decision-tables/${id}`);
}

/**
 * 执行决策表。
 * 后端路径：POST /v1/rule/decision-tables/:id/execute
 */
export async function executeDecisionTable(
  id: string,
  input: Record<string, unknown>,
): Promise<DecisionTableExecutionResult> {
  const raw = await post<DecisionTableExecutionBackend>(
    `/v1/rule/decision-tables/${id}/execute`,
    { inputData: input },
  );

  // 为了在 normalizeExecution 中把 outputs 的字段回填到 matchedRows 的 cells，
  // 先查一次决策表元信息（columns），用于回填字段映射。
  let table: DecisionTable | undefined;
  try {
    table = await getDecisionTable(id);
  } catch {
    table = undefined;
  }

  return normalizeExecution(raw, table);
}
