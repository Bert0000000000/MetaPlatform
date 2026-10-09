import '@douyinfe/semi-ui/react19-adapter';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { createElement } from 'react';
import { getApp, listApps } from './apps';
import AppDetailPage from '@/pages/apphub/AppDetailPage';
import AppLifecyclePage from '@/pages/apphub/AppLifecyclePage';
import AppListPage from '@/pages/apphub/AppListPage';

const boundary = vi.hoisted(() => ({
  requests: [] as Array<{ method: string; url: string; options?: { params?: Record<string, unknown> } }>,
  app: {} as Record<string, unknown>,
  modules: [] as Array<Record<string, unknown>>,
}));
vi.hoisted(() => { HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) })) as never; });
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
Range.prototype.getBoundingClientRect = () => new DOMRect();
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => ({ resolvedTheme: 'light' }) }));
vi.mock('@/pages/apphub/DesignFlowPage', () => ({ default: () => null }));
vi.mock('@mate/shared/api', () => ({
  apiPath: () => '/api/v1/apphub',
  createApiClient: () => ({
    get: async (url: string, options?: { params?: Record<string, unknown> }) => {
      boundary.requests.push({ method: 'GET', url, options });
      if (url === '/apps') return { data: { items: [boundary.app], total: 1 } };
      if (url === '/apps/app-record') return { data: boundary.app };
      if (url === '/modules') {
        const items = boundary.modules.filter((item) => item.app_code === options?.params?.app_code);
        return { data: { items, total: items.length } };
      }
      return { data: { items: [], total: 0 } };
    },
    post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(),
  }),
}));
afterEach(() => { cleanup(); boundary.requests.length = 0; boundary.modules = []; });

function backendApp() {
  return { id: 'app-record', tenant_id: 'tenant-real', name: '真实应用', code: 'order-app', category: 'business', description: '后台目录', version: '2.3.1', owner: 'actual-team', tags: ['订单', '内部', '财务'], business_domain: '' };
}

it('keeps absent application facts absent instead of interpreting tags and version as lifecycle data', async () => {
  boundary.app = backendApp();
  const app = (await listApps()).items[0];
  expect(app.status).toBeUndefined();
  expect(app.moduleCount).toBeUndefined();
  expect(app.createdAt).toBeUndefined();
  expect(app.updatedAt).toBeUndefined();
  expect(app.version).toBe('2.3.1');
});

it('preserves explicit status, count and timestamps independently from a reported version', async () => {
  boundary.app = { ...backendApp(), status: 'OFFLINE', module_count: 0, created_at: '2026-10-08T01:00:00Z', updated_at: '2026-10-09T02:00:00Z' };
  expect(await getApp('app-record')).toMatchObject({ status: 'OFFLINE', moduleCount: 0, createdAt: '2026-10-08T01:00:00Z', updatedAt: '2026-10-09T02:00:00Z', version: '2.3.1' });
});

it('reads existing modules using the loaded application code rather than its record identity', async () => {
  boundary.app = backendApp();
  boundary.modules = [{ id: 'module-record', tenant_id: 'tenant-real', name: '已登记订单模块', code: 'orders', app_code: 'order-app', description: '已有模块', entry_path: '/orders' }];
  render(createElement(MemoryRouter, null, createElement<{ appId?: string }>(AppDetailPage, { appId: 'app-record' })));
  expect(await screen.findByText('已登记订单模块')).toBeVisible();
  expect(boundary.requests.filter((request) => request.url === '/modules')).toEqual([{ method: 'GET', url: '/modules', options: { params: { app_code: 'order-app' } } }]);
  expect(screen.queryByText(/还没有模块/)).toBeNull();
  expect(document.body.textContent).not.toMatch(/NaN|Invalid Date/);
});

it('shows unavailable lifecycle facts without claiming the application is serving or assigning a stage', async () => {
  boundary.app = backendApp();
  render(createElement(MemoryRouter, null, createElement<{ appId?: string }>(AppLifecyclePage, { appId: 'app-record' })));
  expect((await screen.findAllByText('未提供')).length).toBeGreaterThan(0);
  expect(screen.queryByText('应用正在服务')).toBeNull();
  expect(document.body.textContent).not.toMatch(/NaN|Invalid Date/);
  expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
});

it('renders the reported version in the application catalog without borrowing the update timestamp', async () => {
  boundary.app = { ...backendApp(), updated_at: '2026-10-09T02:00:00Z' };
  render(createElement(MemoryRouter, null, createElement(AppListPage)));
  expect(await screen.findByText('v2.3.1')).toBeVisible();
  expect(screen.queryByText('v2026-10-09T02:00:00Z')).toBeNull();
});
