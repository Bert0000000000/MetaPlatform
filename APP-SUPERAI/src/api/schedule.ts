import { get, post, put, del } from './client';
import type { PageResponse } from '@/types';

export interface ScheduleIntent {
  intentId: string;
  userId: string;
  rawUtterance: string;
  detectedIntent: 'scheduled' | 'immediate';
  confidence: number;
  detectedEmployees: string[];
  scheduleAt?: string;
  matchedAt?: string;
  status: 'pending' | 'planned' | 'running' | 'completed' | 'failed';
}

export interface ExecutionPlan {
  planId: string;
  intentId: string;
  steps: Array<{ id: string; name: string; employeeId?: string; tool?: string; estimatedDuration: number }>;
  totalEstimatedDuration: number;
  parallelGroups?: Array<{ groupId: string; stepIds: string[] }>;
  createdAt: string;
}

export interface SubTaskResult {
  resultId: string;
  planId: string;
  stepId: string;
  status: 'completed' | 'failed' | 'skipped';
  output?: string;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
}

export interface ScheduleTemplate {
  templateId: string;
  name: string;
  description: string;
  intentPattern: string;
  plan: ExecutionPlan;
  createdBy: string;
  createdAt: string;
}

export interface ScheduleExecution {
  executionId: string;
  intentId: string;
  planId: string;
  status: 'pending' | 'running' | 'completed' | 'partial' | 'failed';
  progress: number;
  results: SubTaskResult[];
  startedAt: string;
  completedAt?: string;
  finalReport?: string;
}

const STORAGE_KEY = 'mate_superai_schedule';

function load<T>(key: string): T[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function save<T>(key: string, items: T[]): void {
  localStorage.setItem(key, JSON.stringify(items));
}

function now(): string {
  return new Date().toISOString();
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export async function detectIntent(text: string): Promise<ScheduleIntent> {
  await new Promise((r) => setTimeout(r, 500));
  const isScheduled = /每[日周月]|定时|周期|明天|下次|以后/.test(text);
  const employeeMatches: string[] = [];
  if (/财务|报销|会计/.test(text)) employeeMatches.push('finance-bot');
  if (/HR|招聘|人事|考勤/.test(text)) employeeMatches.push('hr-bot');
  if (/数据|分析|报表/.test(text)) employeeMatches.push('data-bot');
  if (employeeMatches.length === 0) employeeMatches.push('default-bot');

  const intent: ScheduleIntent = {
    intentId: generateId('int'),
    userId: 'admin',
    rawUtterance: text,
    detectedIntent: isScheduled ? 'scheduled' : 'immediate',
    confidence: 0.85 + Math.random() * 0.1,
    detectedEmployees: employeeMatches,
    matchedAt: now(),
    status: 'pending',
  };
  const items = load<ScheduleIntent>('superai_intents');
  items.unshift(intent);
  save('superai_intents', items.slice(0, 50));
  return intent;
}

export async function matchEmployees(intent: string): Promise<Array<{ employeeId: string; name: string; confidence: number }>> {
  await new Promise((r) => setTimeout(r, 500));
  return [
    { employeeId: 'finance-bot', name: '财务数字员工', confidence: 0.92 },
    { employeeId: 'data-bot', name: '数据分析员工', confidence: 0.84 },
    { employeeId: 'hr-bot', name: 'HR 数字员工', confidence: 0.7 },
  ];
}

export async function generatePlan(intentId: string): Promise<ExecutionPlan> {
  await new Promise((r) => setTimeout(r, 800));
  return {
    planId: generateId('plan'),
    intentId,
    steps: [
      { id: 's1', name: '查询本月数据', employeeId: 'data-bot', tool: 'query_database', estimatedDuration: 30 },
      { id: 's2', name: '汇总分析', employeeId: 'finance-bot', estimatedDuration: 60 },
      { id: 's3', name: '生成报告', employeeId: 'default-bot', estimatedDuration: 20 },
    ],
    totalEstimatedDuration: 110,
    parallelGroups: [{ groupId: 'g1', stepIds: ['s1', 's2'] }],
    createdAt: now(),
  };
}

export async function startExecution(planId: string): Promise<ScheduleExecution> {
  await new Promise((r) => setTimeout(r, 500));
  return {
    executionId: generateId('exec'),
    intentId: 'intent',
    planId,
    status: 'running',
    progress: 0,
    results: [],
    startedAt: now(),
  };
}

export async function aggregateResults(executionId: string): Promise<string> {
  return `执行报告 #${executionId}\n\n所有步骤已完成，结果已汇总。\n\n下一步建议：请相关数字员工执行后续任务。`;
}

export async function listIntentHistory(): Promise<ScheduleIntent[]> {
  return load<ScheduleIntent>('superai_intents');
}

export async function listTemplates(): Promise<ScheduleTemplate[]> {
  return load<ScheduleTemplate>('superai_templates');
}

export async function createTemplate(req: Omit<ScheduleTemplate, 'templateId' | 'createdAt'>): Promise<ScheduleTemplate> {
  const items = load<ScheduleTemplate>('superai_templates');
  const created: ScheduleTemplate = {
    templateId: generateId('tmpl'),
    ...req,
    createdAt: now(),
  };
  save('superai_templates', [created, ...items]);
  return created;
}
