import { expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), put: vi.fn(), post: vi.fn() }));
vi.mock('@mate/shared/api', () => ({ createApiClient: () => api, apiPath: () => '/api/v1/apphub' }));
import { listApps, updateApp } from '@/api/apphub/apps';

it('uses actual lifecycle owner timestamps and module count for application cards', async () => {
  api.get.mockResolvedValue({ data: { items: [{ id: 'a', code: 'orders', name: 'Orders',
    version: '2.0.0', status: 'DESIGNING', owner: 'reviewer', created_at: null,
    updated_at: '2026-10-11T00:00:00Z', module_count: 2, tags: ['x'] }], total: 1 } });
  const app = (await listApps()).items[0];
  expect(app.status).toBe('DESIGNING');
  expect(app.owner).toBe('reviewer');
  expect(app.version).toBe('2.0.0');
  expect(app.createdAt).toBe('');
  expect(app.updatedAt).toBe('2026-10-11T00:00:00Z');
  expect(app.moduleCount).toBe(2);
});
it('saves metadata through the existing PATCH handler', async () => {
  api.patch.mockResolvedValue({ data: { id: 'a', name: 'Actual', code: 'orders' } });
  await updateApp('orders', { name: 'Actual' });
  expect(api.patch).toHaveBeenCalledWith('/apps/orders', { name: 'Actual' });
  expect(api.put).not.toHaveBeenCalled();
});

import { listModules } from '@/api/apphub/modules';
it('maps real module identity while leaving absent type and timestamps unknown', async () => {
  api.get.mockResolvedValue({ data: { items: [{ id: 'module-id', code: 'module-code', app_code: 'app-code', name: 'Review' }], total: 1 } });
  const module = (await listModules('app-code')).items[0];
  expect(module.moduleId).toBe('module-id');
  expect(module.code).toBe('module-code');
  expect(module.appCode).toBe('app-code');
  expect(module.type).toBeUndefined();
  expect(module.updatedAt).toBe('');
});

import { createOrderReviewApplication } from '@/api/apphub/apps';
it('creates an explicit business group for an empty tenant before creating the order app', async () => {
  api.get.mockResolvedValue({ data: { items: [] } });
  api.post.mockImplementation(async (path: string, body: Record<string, unknown>) => ({ data: { id: 'created', ...body } }));
  await createOrderReviewApplication('My orders');
  expect(api.post).toHaveBeenCalledWith('/groups', { name: '业务应用', code: 'business' });
  expect(api.post).toHaveBeenCalledWith('/apps', expect.objectContaining({ name: 'My orders', category: 'business' }));
});
it('does not treat a failed group lookup as an empty tenant', async () => {
  api.post.mockClear(); api.get.mockRejectedValue(new Error('offline'));
  await expect(createOrderReviewApplication('My orders')).rejects.toThrow('offline');
  expect(api.post).not.toHaveBeenCalled();
});
import { createOrderReviewPage } from '@/api/apphub/pages';
it('retains a successfully created module for retry after page creation fails', async () => {
  api.post.mockReset();
  api.post.mockResolvedValueOnce({ data: { id: 'module-id' } }).mockRejectedValueOnce(new Error('page unavailable'));
  let partial: any;
  try { await createOrderReviewPage('orders'); } catch (error) { partial = error; }
  expect(partial.message).toContain('模块已创建');
  expect(partial.moduleCode).toBeTruthy();
  api.get.mockResolvedValueOnce({ data: { items: [], total: 0 } });
  api.post.mockResolvedValueOnce({ data: { id: 'page-id' } });
  const result = await createOrderReviewPage('orders', partial.moduleCode);
  expect(result.id).toBe('page-id');
  expect(api.post.mock.calls.filter(([path]) => path === '/modules')).toHaveLength(1);
});
