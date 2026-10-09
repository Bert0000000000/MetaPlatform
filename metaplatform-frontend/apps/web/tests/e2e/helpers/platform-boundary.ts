import type { Page } from '@playwright/test';
/** Hand-authored DTO substitutions for domains not in the isolated Ont stack.
 * Auth/settings/Ont remain real. Unregistered calls explicitly fail HTTP 503. */
export async function platformBoundary(page: Page) {
  const reads = new Map<string, number>();
  const onceFailed = new Set(['/api/v1/dashboard/todos', '/api/v1/apphub/apps/groups', '/api/v1/apphub/apps/domains']);
  const summary = { stats: [{ label: 'HTTP 边界统计', value: '7', trend_label: null, trend_value: null, trend_up: false, icon: 'boxes' }], recentTasks: [], systemHealth: [], activeAgents: [], quickLinks: [{ id: 'builder', label: '继续模型建设', icon: 'Database', link: '/ontology/model/graph' }] };
  const responses: Record<string, unknown> = {
    '/api/v1/dashboard/page/summary': summary,
    '/api/v1/dashboard/todos': { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
    '/api/v1/apphub/apps': { items: [{ id: 'boundary-app', name: 'HTTP 边界应用', code: 'boundary-app', description: '目录交互验证', category: 'business', version: '1.0', business_domain: 'orders' }], total: 1 },
    '/api/v1/apphub/apps/groups': { items: [{ code: 'business' }] },
    '/api/v1/apphub/apps/domains': { items: [{ code: 'orders', name: '订单域', sort_order: 1 }] },
    '/api/v1/dw/employees': { items: [{ employeeId: 'boundary-employee', name: 'HTTP 边界员工', code: 'boundary-employee', roleCategory: 'CUSTOM', roleIdentity: '目录验证', description: '契约激活状态', status: 'ACTIVE', capability: { model: 'boundary-model', tools: [] } }], total: 1, page: 1, pageSize: 20, totalPages: 1 },
    '/api/v1/copilot/conversations': { items: [{ id: 'conv-boundary', title: 'HTTP 边界会话', mode: 'chat', favorite: false, createdAt: '2026-10-08T00:00:00Z', updatedAt: '2026-10-08T00:00:00Z' }], total: 1 },
    '/api/v1/copilot/conversations/conv-boundary/messages': { items: [{ id: 'boundary-message', conversationId: 'conv-boundary', role: 'user', content: '实际 DTO 会话内容', createdAt: '2026-10-08T00:00:00Z' }], total: 1 },
    '/api/v1/copilot/models/chat': { items: [], total: 0, default_model: '', provider: '' },
    '/api/v1/copilot/models/multimodal': { items: [], total: 0 },
  };
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    const realSettings = path === '/api/v1/dashboard/settings' && (method === 'GET' || method === 'PUT');
    if (path.startsWith('/api/v1/iam/') || path.startsWith('/api/v1/ont/') || realSettings) return route.continue();
    reads.set(path, (reads.get(path) ?? 0) + 1);
    if (onceFailed.has(path) && reads.get(path) === 1) return route.fulfill({ status: 503, json: { message: `${path.endsWith('/todos') ? '审批' : path.endsWith('/groups') ? '分类' : '业务域'}边界读取失败` } });
    if (route.request().method() === 'GET' && path in responses) return route.fulfill({ json: responses[path] });
    return route.fulfill({ status: 503, json: { message: '该域未启动；未登记 HTTP 边界调用' } });
  });
  return reads;
}
