import { get, post, put, del } from './client';
import type { PageResponse } from '@/types';

export interface ConversationRecord {
  conversationId: string;
  employeeId: string;
  taskId: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'tool';
    content: string;
    toolCall?: { name: string; args: Record<string, unknown>; result?: unknown };
    timestamp: string;
  }>;
  qualityScore?: number;
  evaluatedBy?: string;
  evaluatedAt?: string;
  createdAt: string;
}

export interface EvaluationReport {
  reportId: string;
  employeeId: string;
  period: string;
  totalTasks: number;
  avgQualityScore: number;
  successRate: number;
  avgDuration: number;
  highlights: string[];
  issues: string[];
  createdAt: string;
}

const CONV_KEY = 'app_dw_conversations';
const REPORT_KEY = 'app_dw_reports';

function loadConv(): ConversationRecord[] {
  const raw = localStorage.getItem(CONV_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ConversationRecord[];
  } catch {
    return [];
  }
}

function saveConv(items: ConversationRecord[]): void {
  localStorage.setItem(CONV_KEY, JSON.stringify(items));
}

function loadReports(): EvaluationReport[] {
  const raw = localStorage.getItem(REPORT_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as EvaluationReport[];
  } catch {
    return [];
  }
}

function saveReports(items: EvaluationReport[]): void {
  localStorage.setItem(REPORT_KEY, JSON.stringify(items));
}

function now(): string {
  return new Date().toISOString();
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export async function listConversations(employeeId?: string): Promise<ConversationRecord[]> {
  try {
    return await get<ConversationRecord[]>('/v1/agent/conversations', { employeeId });
  } catch {
    const items = loadConv();
    return employeeId ? items.filter((c) => c.employeeId === employeeId) : items;
  }
}

export async function getConversation(id: string): Promise<ConversationRecord> {
  try {
    return await get<ConversationRecord>(`/v1/agent/conversations/${id}`);
  } catch {
    const c = loadConv().find((x) => x.conversationId === id);
    if (!c) throw new Error('对话不存在');
    return c;
  }
}

export async function scoreConversation(
  id: string,
  score: number,
  evaluatedBy: string,
): Promise<ConversationRecord> {
  const items = loadConv();
  const idx = items.findIndex((c) => c.conversationId === id);
  if (idx === -1) throw new Error('对话不存在');
  const updated: ConversationRecord = {
    ...items[idx]!,
    qualityScore: score,
    evaluatedBy,
    evaluatedAt: now(),
  };
  items[idx] = updated;
  saveConv(items);
  return updated;
}

export async function generateReport(employeeId: string, period: string): Promise<EvaluationReport> {
  await new Promise((r) => setTimeout(r, 1000));
  const report: EvaluationReport = {
    reportId: generateId('rep'),
    employeeId,
    period,
    totalTasks: 100 + Math.floor(Math.random() * 50),
    avgQualityScore: 0.8 + Math.random() * 0.15,
    successRate: 0.85 + Math.random() * 0.1,
    avgDuration: 60 + Math.floor(Math.random() * 60),
    highlights: [
      '准确完成用户意图识别',
      '工具调用成功率 92%',
      '响应延迟稳定低于 1.5s',
    ],
    issues: ['部分 SQL 缺少 LIMIT 限制', '建议增加更细粒度的错误处理'],
    createdAt: now(),
  };
  const items = loadReports();
  saveReports([report, ...items]);
  return report;
}

export async function listReports(employeeId?: string): Promise<EvaluationReport[]> {
  const items = loadReports();
  return employeeId ? items.filter((r) => r.employeeId === employeeId) : items;
}

export async function getQualityTrend(employeeId: string): Promise<Array<{
  date: string;
  score: number;
}>> {
  const arr = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 3600 * 1000);
    arr.push({
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      score: 0.7 + Math.random() * 0.25,
    });
  }
  return arr;
}

export async function saveConversation(conv: ConversationRecord): Promise<void> {
  const items = loadConv();
  const idx = items.findIndex((c) => c.conversationId === conv.conversationId);
  if (idx >= 0) items[idx] = conv;
  else items.unshift(conv);
  saveConv(items);
}
