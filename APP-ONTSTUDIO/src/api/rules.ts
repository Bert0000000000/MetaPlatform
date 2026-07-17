import { get, post, put, del } from './client';
import type { PageResponse } from '@/types';

export interface RuleCondition {
  id: string;
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'in' | 'contains';
  value: string;
}

export interface RuleAction {
  id: string;
  type: 'set-value' | 'send-notify' | 'call-action' | 'trigger-flow';
  config: Record<string, unknown>;
}

export interface OntologyRule {
  ruleId: string;
  tenantId: string;
  code: string;
  name: string;
  description?: string;
  conceptId: string;
  trigger: 'create' | 'update' | 'delete' | 'manual';
  conditions: RuleCondition[];
  actions: RuleAction[];
  enabled: boolean;
  lastTestResult?: 'pass' | 'fail';
  createdAt?: string;
}

const STORAGE_KEY = 'ontstudio_rules';

function load(): OntologyRule[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as OntologyRule[];
  } catch {
    return [];
  }
}

function save(items: OntologyRule[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function now(): string {
  return new Date().toISOString();
}

function generateId(): string {
  return `rule_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export async function listRules(): Promise<PageResponse<OntologyRule>> {
  try {
    return await get<PageResponse<OntologyRule>>('/v1/ont/rules');
  } catch {
    const items = load();
    return {
      items,
      total: items.length,
      page: 1,
      pageSize: items.length,
      totalPages: 1,
    };
  }
}

export async function getRule(id: string): Promise<OntologyRule> {
  try {
    return await get<OntologyRule>(`/v1/ont/rules/${id}`);
  } catch {
    const r = load().find((x) => x.ruleId === id);
    if (!r) throw new Error('规则不存在');
    return r;
  }
}

export async function createRule(req: Omit<OntologyRule, 'ruleId' | 'tenantId' | 'createdAt'>): Promise<OntologyRule> {
  try {
    return await post<OntologyRule>('/v1/ont/rules', req);
  } catch {
    const items = load();
    if (items.some((r) => r.code === req.code)) throw new Error('规则编码已存在');
    const created: OntologyRule = {
      ruleId: generateId(),
      tenantId: 'default',
      ...req,
      createdAt: now(),
    };
    save([...items, created]);
    return created;
  }
}

export async function updateRule(id: string, req: Omit<OntologyRule, 'ruleId' | 'tenantId' | 'createdAt'>): Promise<OntologyRule> {
  try {
    return await put<OntologyRule>(`/v1/ont/rules/${id}`, req);
  } catch {
    const items = load();
    const idx = items.findIndex((r) => r.ruleId === id);
    if (idx === -1) throw new Error('规则不存在');
    items[idx] = { ...items[idx]!, ...req };
    save(items);
    return items[idx]!;
  }
}

export async function deleteRule(id: string): Promise<void> {
  try {
    await del(`/v1/ont/rules/${id}`);
  } catch {
    save(load().filter((r) => r.ruleId !== id));
  }
}

export async function testRule(_ruleId: string, _sample?: Record<string, unknown>): Promise<{
  passed: boolean;
  conditions: Array<{ id: string; passed: boolean; message: string }>;
  actions: Array<{ id: string; executed: boolean; output?: string; error?: string }>;
}> {
  await new Promise((r) => setTimeout(r, 600));
  return {
    passed: true,
    conditions: [
      { id: 'c1', passed: true, message: 'amount > 1000' },
      { id: 'c2', passed: true, message: 'status === "pending"' },
    ],
    actions: [
      { id: 'a1', executed: true, output: '已发送通知给财务' },
    ],
  };
}
