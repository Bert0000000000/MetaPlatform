import { get, post } from './client';
import type { ActionItem, ActionMatchResult, ActionResult } from '@/types';

const MOCK_ACTIONS: ActionItem[] = [
  {
    id: 'act-send-email',
    name: '发送邮件通知',
    description: '向指定收件人发送邮件通知',
    category: '通知推送',
    inputSchema: [
      { name: 'to', label: '收件人邮箱', type: 'string', required: true, description: '收件人邮箱地址' },
      { name: 'subject', label: '邮件主题', type: 'string', required: true },
      { name: 'body', label: '邮件内容', type: 'string', required: true },
      { name: 'cc', label: '抄送', type: 'string', required: false },
    ],
    outputType: 'text',
    enabled: true,
  },
  {
    id: 'act-query-data',
    name: '查询业务数据',
    description: '根据条件查询业务对象的记录',
    category: '数据查询',
    inputSchema: [
      { name: 'entity', label: '业务对象', type: 'select', required: true, options: [
        { label: '客户', value: 'customer' },
        { label: '订单', value: 'order' },
        { label: '合同', value: 'contract' },
      ] },
      { name: 'filter', label: '筛选条件', type: 'string', required: false, description: '如：status=active' },
      { name: 'limit', label: '返回条数', type: 'number', required: false, defaultValue: 100 },
    ],
    outputType: 'table',
    enabled: true,
  },
  {
    id: 'act-create-task',
    name: '创建待办任务',
    description: '为指定用户创建一个待办任务',
    category: '任务管理',
    inputSchema: [
      { name: 'assignee', label: '指派给', type: 'string', required: true },
      { name: 'title', label: '任务标题', type: 'string', required: true },
      { name: 'description', label: '任务描述', type: 'string', required: false },
      { name: 'priority', label: '优先级', type: 'select', required: false, defaultValue: 'normal', options: [
        { label: '低', value: 'low' },
        { label: '中', value: 'normal' },
        { label: '高', value: 'high' },
      ] },
    ],
    outputType: 'json',
    enabled: true,
  },
  {
    id: 'act-approve',
    name: '审批流程操作',
    description: '对审批流程进行同意/拒绝操作',
    category: '审批管理',
    inputSchema: [
      { name: 'processId', label: '流程实例 ID', type: 'string', required: true },
      { name: 'action', label: '审批操作', type: 'select', required: true, options: [
        { label: '同意', value: 'approve' },
        { label: '拒绝', value: 'reject' },
      ] },
      { name: 'comment', label: '审批意见', type: 'string', required: false },
    ],
    outputType: 'text',
    enabled: true,
  },
  {
    id: 'act-export',
    name: '导出数据报表',
    description: '将查询结果导出为 Excel/PDF 报表',
    category: '数据导出',
    inputSchema: [
      { name: 'format', label: '导出格式', type: 'select', required: true, options: [
        { label: 'Excel', value: 'xlsx' },
        { label: 'PDF', value: 'pdf' },
        { label: 'CSV', value: 'csv' },
      ] },
      { name: 'sql', label: '查询 SQL', type: 'string', required: true },
      { name: 'filename', label: '文件名', type: 'string', required: false },
    ],
    outputType: 'file',
    enabled: true,
  },
];

export async function listActions(): Promise<ActionItem[]> {
  try {
    return await get<ActionItem[]>('/v1/actions');
  } catch {
    return MOCK_ACTIONS;
  }
}

export async function executeAction(actionId: string, params: Record<string, unknown>): Promise<ActionResult> {
  try {
    return await post<ActionResult>('/v1/actions/execute', { actionId, params });
  } catch {
    return mockExecute(actionId, params);
  }
}

export async function matchAction(query: string): Promise<ActionMatchResult[]> {
  try {
    return await post<ActionMatchResult[]>('/v1/actions/match', { query });
  } catch {
    return mockMatch(query);
  }
}

function mockExecute(actionId: string, params: Record<string, unknown>): ActionResult {
  const action = MOCK_ACTIONS.find((a) => a.id === actionId);
  if (!action) throw new Error('Action 不存在');

  let output: unknown;
  switch (actionId) {
    case 'act-send-email':
      output = { messageId: `msg_${Date.now()}`, sent: true, to: params.to };
      break;
    case 'act-query-data':
      output = [
        { id: 1, name: '示例记录 1', status: 'active' },
        { id: 2, name: '示例记录 2', status: 'active' },
        { id: 3, name: '示例记录 3', status: 'inactive' },
      ];
      break;
    case 'act-create-task':
      output = { taskId: `task_${Date.now()}`, status: 'created', assignee: params.assignee };
      break;
    case 'act-approve':
      output = { processId: params.processId, result: params.action, completed: true };
      break;
    case 'act-export':
      output = { fileId: `file_${Date.now()}`, downloadUrl: `/api/v1/files/${Date.now()}`, format: params.format };
      break;
    default:
      output = { result: 'ok' };
  }

  return {
    actionId,
    actionName: action.name,
    success: true,
    output,
    message: `Action「${action.name}」执行成功`,
    executedAt: new Date().toISOString(),
  };
}

function mockMatch(query: string): ActionMatchResult[] {
  const lower = query.toLowerCase();
  const results: ActionMatchResult[] = [];

  for (const action of MOCK_ACTIONS) {
    let confidence = 0;
    const reason: string[] = [];

    const keywords: Record<string, string[]> = {
      'act-send-email': ['邮件', '发送', '通知', 'email', 'mail', 'send'],
      'act-query-data': ['查询', '数据', '搜索', '查找', 'query', 'search', 'data'],
      'act-create-task': ['任务', '待办', '创建', '指派', 'task', 'todo', 'assign'],
      'act-approve': ['审批', '同意', '拒绝', '流程', 'approve', 'reject'],
      'act-export': ['导出', '报表', 'excel', 'pdf', 'export', 'download'],
    };

    const kws = keywords[action.id] || [];
    for (const kw of kws) {
      if (lower.includes(kw)) {
        confidence += 30;
        reason.push(`关键词匹配: ${kw}`);
      }
    }

    if (confidence > 0) {
      results.push({
        action,
        confidence: Math.min(confidence, 95),
        reason: reason.join('；'),
      });
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}
