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

const BASE = '/v1/rule/rules';

export async function listRules(): Promise<PageResponse<OntologyRule>> {
  return get<PageResponse<OntologyRule>>(BASE);
}

export async function getRule(id: string): Promise<OntologyRule> {
  return get<OntologyRule>(`${BASE}/${id}`);
}

export async function createRule(req: Omit<OntologyRule, 'ruleId' | 'tenantId' | 'createdAt'>): Promise<OntologyRule> {
  return post<OntologyRule>(BASE, req);
}

export async function updateRule(id: string, req: Omit<OntologyRule, 'ruleId' | 'tenantId' | 'createdAt'>): Promise<OntologyRule> {
  return put<OntologyRule>(`${BASE}/${id}`, req);
}

export async function deleteRule(id: string): Promise<void> {
  await del<void>(`${BASE}/${id}`);
}

export async function testRule(ruleId: string, sample?: Record<string, unknown>): Promise<{
  passed: boolean;
  conditions: Array<{ id: string; passed: boolean; message: string }>;
  actions: Array<{ id: string; executed: boolean; output?: string; error?: string }>;
}> {
  return post<{
    passed: boolean;
    conditions: Array<{ id: string; passed: boolean; message: string }>;
    actions: Array<{ id: string; executed: boolean; output?: string; error?: string }>;
  }>(`${BASE}/${ruleId}/test`, sample);
}
