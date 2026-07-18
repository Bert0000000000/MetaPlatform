import { get, post, put, del } from './client';
import type {
  DecisionTable,
  DecisionTablePayload,
  DecisionTableExecutionResult,
  HitPolicy,
} from '@/types';

const CACHE_KEY = 'mate_platform_decision_tables';

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

export const HIT_POLICY_OPTIONS: Array<{ label: string; value: HitPolicy; description: string }> = [
  { label: '首次命中', value: 'first', description: '从上到下匹配第一条命中规则，返回其输出' },
  { label: '全部命中', value: 'all', description: '返回所有命中规则的输出（顺序敏感）' },
  { label: '优先级', value: 'priority', description: '按 priority 升序返回所有命中规则输出' },
  { label: '唯一命中', value: 'unique', description: '仅当恰好命中一条规则时返回，否则报错' },
  { label: '聚合', value: 'collect', description: '收集所有命中规则的输出列表' },
];

/** 默认决策表 1：订单折扣决策表 */
const DEFAULT_TABLE_ORDER_DISCOUNT: DecisionTable = {
  id: 'dt-001',
  code: 'ORDER_DISCOUNT',
  name: '订单折扣决策表',
  description: '依据订单金额与客户等级计算折扣率',
  conceptId: 'concept-order',
  hitPolicy: 'first',
  columns: [
    { id: 'col-amount', name: '订单金额', field: 'amount', columnType: 'input', operator: 'gte' },
    { id: 'col-cust-level', name: '客户等级', field: 'customerLevel', columnType: 'input', operator: 'eq' },
    { id: 'col-vip', name: '是否VIP', field: 'isVip', columnType: 'input', operator: 'eq' },
    { id: 'col-discount', name: '折扣率', field: 'discountRate', columnType: 'output' },
    { id: 'col-gift', name: '赠品', field: 'gift', columnType: 'output', defaultValue: '无' },
  ],
  rows: [
    {
      id: 'row-1',
      enabled: true,
      priority: 10,
      description: 'VIP 大单 8 折 + 礼品',
      cells: {
        'col-amount': { value: '10000' },
        'col-cust-level': { value: '-', isEmpty: true },
        'col-vip': { value: 'true' },
        'col-discount': { value: '0.8' },
        'col-gift': { value: '高档礼品' },
      },
    },
    {
      id: 'row-2',
      enabled: true,
      priority: 20,
      description: 'A 级客户中额订单 9 折',
      cells: {
        'col-amount': { value: '5000' },
        'col-cust-level': { value: 'A' },
        'col-vip': { value: '-', isEmpty: true },
        'col-discount': { value: '0.9' },
        'col-gift': { value: '标准礼品' },
      },
    },
    {
      id: 'row-3',
      enabled: true,
      priority: 30,
      description: 'B 级客户 95 折',
      cells: {
        'col-amount': { value: '3000' },
        'col-cust-level': { value: 'B' },
        'col-vip': { value: '-', isEmpty: true },
        'col-discount': { value: '0.95' },
        'col-gift': { value: '-' , isEmpty: true },
      },
    },
    {
      id: 'row-4',
      enabled: true,
      priority: 40,
      description: '默认无折扣',
      cells: {
        'col-amount': { value: '-', isEmpty: true },
        'col-cust-level': { value: '-', isEmpty: true },
        'col-vip': { value: '-', isEmpty: true },
        'col-discount': { value: '1.0' },
        'col-gift': { value: '-' , isEmpty: true },
      },
    },
  ],
  enabled: true,
  createdAt: '2026-07-10T08:30:00.000Z',
  updatedAt: '2026-07-15T10:20:00.000Z',
};

/** 默认决策表 2：客户分级决策表 */
const DEFAULT_TABLE_CUSTOMER_LEVEL: DecisionTable = {
  id: 'dt-002',
  code: 'CUSTOMER_LEVEL',
  name: '客户分级决策表',
  description: '根据年消费总额与活跃度划分客户等级',
  conceptId: 'concept-customer',
  hitPolicy: 'priority',
  columns: [
    { id: 'col-year-amount', name: '年消费额', field: 'yearAmount', columnType: 'input', operator: 'gte' },
    { id: 'col-active-days', name: '活跃天数', field: 'activeDays', columnType: 'input', operator: 'gte' },
    { id: 'col-complaint', name: '投诉次数', field: 'complaintCount', columnType: 'input', operator: 'lte' },
    { id: 'col-level', name: '客户等级', field: 'level', columnType: 'output' },
    { id: 'col-discount-level', name: '折扣档位', field: 'discountLevel', columnType: 'output' },
  ],
  rows: [
    {
      id: 'row-1',
      enabled: true,
      priority: 1,
      description: '钻石客户：年消费 50w+，活跃 300+，投诉 ≤ 2',
      cells: {
        'col-year-amount': { value: '500000' },
        'col-active-days': { value: '300' },
        'col-complaint': { value: '2' },
        'col-level': { value: 'S' },
        'col-discount-level': { value: 'VIP1' },
      },
    },
    {
      id: 'row-2',
      enabled: true,
      priority: 2,
      description: '黄金客户：年消费 20w+，活跃 200+',
      cells: {
        'col-year-amount': { value: '200000' },
        'col-active-days': { value: '200' },
        'col-complaint': { value: '5' },
        'col-level': { value: 'A' },
        'col-discount-level': { value: 'VIP2' },
      },
    },
    {
      id: 'row-3',
      enabled: true,
      priority: 3,
      description: '白银客户：年消费 5w+，活跃 100+',
      cells: {
        'col-year-amount': { value: '50000' },
        'col-active-days': { value: '100' },
        'col-complaint': { value: '10' },
        'col-level': { value: 'B' },
        'col-discount-level': { value: 'VIP3' },
      },
    },
    {
      id: 'row-4',
      enabled: true,
      priority: 4,
      description: '普通客户',
      cells: {
        'col-year-amount': { value: '-', isEmpty: true },
        'col-active-days': { value: '-', isEmpty: true },
        'col-complaint': { value: '-', isEmpty: true },
        'col-level': { value: 'C' },
        'col-discount-level': { value: 'NORMAL' },
      },
    },
  ],
  enabled: true,
  createdAt: '2026-07-08T09:00:00.000Z',
  updatedAt: '2026-07-16T14:50:00.000Z',
};

const DEFAULT_DECISION_TABLES: DecisionTable[] = [
  DEFAULT_TABLE_ORDER_DISCOUNT,
  DEFAULT_TABLE_CUSTOMER_LEVEL,
];

function getLocalTables(): DecisionTable[] {
  return readLocal<DecisionTable[]>(CACHE_KEY) ?? DEFAULT_DECISION_TABLES;
}

function setLocalTables(tables: DecisionTable[]): void {
  writeLocal(CACHE_KEY, tables);
}

/**
 * 列出决策表（可选按 conceptId 过滤）。
 * 后端路径：GET /v1/rule/decision-tables
 */
export async function listDecisionTables(conceptId?: string): Promise<DecisionTable[]> {
  try {
    const params = conceptId ? { conceptId } : undefined;
    const data = await get<DecisionTable[]>('/v1/rule/decision-tables', params);
    if (data && Array.isArray(data)) {
      setLocalTables(data);
      return data;
    }
    throw new Error('Empty decision tables');
  } catch {
    const base = getLocalTables();
    if (!conceptId) return base;
    return base.filter((t) => t.conceptId === conceptId);
  }
}

/**
 * 获取单个决策表。
 * 后端路径：GET /v1/rule/decision-tables/:id
 */
export async function getDecisionTable(id: string): Promise<DecisionTable> {
  try {
    return await get<DecisionTable>(`/v1/rule/decision-tables/${id}`);
  } catch {
    const found = getLocalTables().find((t) => t.id === id);
    if (!found) throw new Error(`Decision table ${id} not found`);
    return found;
  }
}

/**
 * 创建决策表。
 * 后端路径：POST /v1/rule/decision-tables
 */
export async function createDecisionTable(payload: DecisionTablePayload): Promise<DecisionTable> {
  try {
    const created = await post<DecisionTable>('/v1/rule/decision-tables', payload);
    const tables = getLocalTables();
    setLocalTables([...tables, created]);
    return created;
  } catch {
    const now = new Date().toISOString();
    const created: DecisionTable = {
      ...payload,
      id: `dt-${Date.now().toString(36)}`,
      createdAt: now,
      updatedAt: now,
    };
    const tables = getLocalTables();
    setLocalTables([...tables, created]);
    return created;
  }
}

/**
 * 更新决策表。
 * 后端路径：PUT /v1/rule/decision-tables/:id
 */
export async function updateDecisionTable(
  id: string,
  payload: DecisionTablePayload,
): Promise<DecisionTable> {
  try {
    const updated = await put<DecisionTable>(`/v1/rule/decision-tables/${id}`, payload);
    const tables = getLocalTables().map((t) => (t.id === id ? updated : t));
    setLocalTables(tables);
    return updated;
  } catch {
    const now = new Date().toISOString();
    const existing = getLocalTables().find((t) => t.id === id);
    const updated: DecisionTable = {
      ...(existing ?? { id, createdAt: now }),
      ...payload,
      id,
      updatedAt: now,
    };
    const tables = getLocalTables().map((t) => (t.id === id ? updated : t));
    setLocalTables(tables);
    return updated;
  }
}

/**
 * 删除决策表。
 * 后端路径：DELETE /v1/rule/decision-tables/:id
 */
export async function deleteDecisionTable(id: string): Promise<void> {
  try {
    await del<void>(`/v1/rule/decision-tables/${id}`);
  } catch {
    /* ignore */
  }
  const tables = getLocalTables().filter((t) => t.id !== id);
  setLocalTables(tables);
}

/**
 * 执行决策表。
 * 后端路径：POST /v1/rule/decision-tables/:id/execute
 */
export async function executeDecisionTable(
  id: string,
  input: Record<string, unknown>,
): Promise<DecisionTableExecutionResult> {
  try {
    return await post<DecisionTableExecutionResult>(
      `/v1/rule/decision-tables/${id}/execute`,
      input,
    );
  } catch {
    // 本地兜底执行：根据列定义对输入做匹配
    const table = getLocalTables().find((t) => t.id === id);
    if (!table) throw new Error(`Decision table ${id} not found`);

    const inputColumns = table.columns.filter((c) => c.columnType === 'input');
    const outputColumns = table.columns.filter((c) => c.columnType === 'output');

    const matches = table.rows
      .filter((r) => r.enabled)
      .filter((r) =>
        inputColumns.every((col) => {
          const cell = r.cells[col.id];
          if (!cell || cell.isEmpty || cell.value === '-') return true; // 任意值
          const inputValue = input[col.field];
          return compareValues(inputValue, cell.value, col.operator ?? 'eq');
        }),
      );

    const ordered = table.hitPolicy === 'priority'
      ? [...matches].sort((a, b) => a.priority - b.priority)
      : matches;

    const finalMatches =
      table.hitPolicy === 'first' || table.hitPolicy === 'unique'
        ? ordered.slice(0, 1)
        : ordered;

    const outputs = finalMatches.map((r) => {
      const out: Record<string, unknown> = {};
      outputColumns.forEach((col) => {
        const cell = r.cells[col.id];
        out[col.field] = cell && !cell.isEmpty && cell.value !== '-' ? cell.value : col.defaultValue ?? null;
      });
      return out;
    });

    if (table.hitPolicy === 'unique' && matches.length > 1) {
      throw new Error(`决策表 ${table.code} 应唯一命中，但匹配到 ${matches.length} 行`);
    }

    return { matchedRows: finalMatches, outputs };
  }
}

/** 简单的本地值比较（与后端语义保持一致） */
function compareValues(
  input: unknown,
  cellValue: string,
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains' | 'between',
): boolean {
  if (input === undefined || input === null) return false;
  const inputStr = typeof input === 'string' ? input : String(input);
  const inputNum = typeof input === 'number' ? input : Number(input);
  const cellNum = Number(cellValue);

  switch (operator) {
    case 'eq':
      return inputStr === cellValue || (!Number.isNaN(inputNum) && inputNum === cellNum);
    case 'ne':
      return inputStr !== cellValue && !(inputNum === cellNum);
    case 'gt':
      return !Number.isNaN(inputNum) && !Number.isNaN(cellNum) && inputNum > cellNum;
    case 'lt':
      return !Number.isNaN(inputNum) && !Number.isNaN(cellNum) && inputNum < cellNum;
    case 'gte':
      return !Number.isNaN(inputNum) && !Number.isNaN(cellNum) && inputNum >= cellNum;
    case 'lte':
      return !Number.isNaN(inputNum) && !Number.isNaN(cellNum) && inputNum <= cellNum;
    case 'in': {
      const items = cellValue.split(',').map((s) => s.trim());
      return items.includes(inputStr);
    }
    case 'contains':
      return inputStr.includes(cellValue);
    case 'between': {
      const [min, max] = cellValue.split(',').map((s) => Number(s.trim()));
      return !Number.isNaN(inputNum) && !Number.isNaN(min) && !Number.isNaN(max) && inputNum >= min && inputNum <= max;
    }
    default:
      return false;
  }
}
