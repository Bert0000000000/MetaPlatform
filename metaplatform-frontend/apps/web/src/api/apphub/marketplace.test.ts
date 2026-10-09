import { afterEach, expect, it, vi } from 'vitest';
import { getTemplate, installTemplate, listTemplates } from './marketplace';
import * as api from './marketplace';

const boundary = vi.hoisted(() => ({
  requests: [] as Array<{ method: string; url: string; options?: unknown; body?: unknown }>,
  response: { items: [] as Array<Record<string, unknown>> },
  postResponse: {} as Record<string, unknown>,
}));
vi.mock('@mate/shared/api', () => ({
  apiPath: () => '/api/v1/apphub',
  createApiClient: () => ({
    get: async (url: string, options?: unknown) => {
      boundary.requests.push({ method: 'GET', url, options });
      return { data: boundary.response };
    },
    post: async (url: string, body?: unknown) => {
      boundary.requests.push({ method: 'POST', url, body });
      return { data: boundary.postResponse };
    },
  }),
}));
afterEach(() => { boundary.requests.length = 0; boundary.response = { items: [] }; boundary.postResponse = {}; });

it('uses the supported template type query and filters the returned catalog by keyword', async () => {
  boundary.response.items = [
    { id: 'tpl-request', code: 'request', name: '申请模板', template_type: 'form', description: '员工请假', content: { fields: [{ fieldKey: 'reason', label: '事由', type: 'text' }] }, tenant_id: 'tenant' },
    { id: 'tpl-feedback', code: 'feedback', name: '反馈模板', template_type: 'form', description: '产品反馈', content: {}, tenant_id: 'tenant' },
  ];
  const templates = await listTemplates({ keyword: '请假', category: 'form' });
  expect(templates.map((item) => item.templateId)).toEqual(['tpl-request']);
  expect(boundary.requests).toEqual([{ method: 'GET', url: '/templates', options: { params: { template_type: 'form' } } }]);
  expect(JSON.parse(templates[0].configSnapshot ?? '{}')).toEqual({ fields: [{ fieldKey: 'reason', label: '事由', type: 'text' }] });
  expect(templates[0].author).toBeUndefined();
});

it('resolves a template from the supported catalog instead of a nonexistent detail endpoint', async () => {
  boundary.response.items = [{ id: 'tpl-request', code: 'request', name: '申请模板', template_type: 'form', description: '', content: {}, tenant_id: 'tenant' }];
  expect((await getTemplate('tpl-request')).name).toBe('申请模板');
  expect(boundary.requests).toEqual([{ method: 'GET', url: '/templates', options: undefined }]);
});

it('does not synthesize a market artifact UUID and write an installation for an apphub template', async () => {
  expect(await installTemplate('tpl-request')).toEqual({ success: false, error: '该模板尚未关联可安装的市场制品' });
  expect(boundary.requests).toEqual([]);
});

it('creates a shared template through the existing template endpoint using its actual DTO', async () => {
  const payload = { code: 'request', name: '申请模板', template_type: 'form' as const, description: '员工请假', content: { fields: [{ fieldKey: 'reason', label: '事由', type: 'text' }] } };
  boundary.postResponse = { id: 'tpl-request', ...payload, tenant_id: 'tenant' };
  expect((await api.createTemplate(payload)).templateId).toBe('tpl-request');
  expect(boundary.requests).toEqual([{ method: 'POST', url: '/templates', body: payload }]);
});
