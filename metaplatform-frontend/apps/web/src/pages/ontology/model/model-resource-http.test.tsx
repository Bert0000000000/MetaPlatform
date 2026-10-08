import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { apiClient } from '@/api/client';
import type { KernelObjectType } from '@/api/ont/kernel';
import OntologyGraphView from './OntologyGraphView';
import ObjectTypeDetailPage from './object-types/ObjectTypeDetailPage';
vi.hoisted(() => { HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) })) as unknown as typeof HTMLCanvasElement.prototype.getContext; });
vi.mock('@mate/shared', () => ({ toast: vi.fn(), useAuth: () => ({ user: { id: 'test-user', tenantId: 'tenant' } }) }));
vi.mock('@/utils/auth', () => ({ getToken: () => null, getRefreshToken: () => null, getTenantId: () => 'tenant' }));
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => ({ resolvedTheme: 'light' }) }));
const originalAdapter = apiClient.defaults.adapter;
afterEach(() => { cleanup(); apiClient.defaults.adapter = originalAdapter; vi.unstubAllGlobals(); });
it('selects the real later-page DTO and marks checksum from the complete active family for an archived detail', async () => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  const archived: KernelObjectType = { rid: 'ont.tenant.obj.crm.customer.v1', display_name: '旧客户', primary_key: [], properties: [], interfaces: [], checksum: 'old-sum' };
  const live = { ...archived, rid: 'ont.tenant.obj.crm.customer.v2', display_name: '生效客户', checksum: 'active-sum' };
  const first = Array.from({ length: 100 }, (_, i) => ({ ...archived, rid: `ont.tenant.obj.crm.a${String(i).padStart(3, '0')}.v1`, display_name: `类型 ${i}`, checksum: `sum-${i}` }));
  const base = { class_ref: archived.rid, parent_rid: null, created_at: '2026-10-08T10:00:00Z', author: 'reviewer', change_set: [], status: 'published', dependencies: [] };
  const requests: string[] = [];
  apiClient.defaults.adapter = async (config) => {
    requests.push(`${config.method} ${apiClient.getUri(config)}`);
    const url = new URL(apiClient.getUri(config), 'https://boundary.test');
    const path = decodeURIComponent(url.pathname);
    let data: unknown = [];
    if (path === '/api/v1/ont/v2/object-types') data = url.searchParams.get('offset') === '100' ? [live] : first;
    else if (path === `/api/v1/ont/v2/object-types/${archived.rid}`) data = archived;
    else if (path === `/api/v1/ont/v2/versions/${archived.rid}`) data = [
      { ...base, rid: 'snap-active', version_no: 1, checksum: 'active-sum', definition: { display_name: '当前快照' } },
      { ...base, rid: 'snap-largest', version_no: 99, checksum: 'old-sum', definition: { display_name: '最大序号旧快照' } },
    ];
    else if (path.endsWith('/materialization')) data = { class_rid: archived.rid, count: 0, rows: [], schema: {} };
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
  const router = createMemoryRouter([
    { path: '/ontology/model/graph', element: <OntologyGraphView /> },
    { path: '/ontology/model/object-types/:rid/:tab?', element: <ObjectTypeDetailPage /> },
  ], { initialEntries: [`/ontology/model/object-types/${archived.rid}/history`] });
  render(<RouterProvider router={router} />);
  expect((await screen.findByText('当前生效')).closest('tr')).toHaveTextContent('当前快照');
  expect(screen.getByText('最大序号旧快照').closest('tr')).not.toHaveTextContent('当前生效');
  expect(screen.getByRole('heading', { name: '旧客户' })).toBeVisible();
  await router.navigate('/ontology/model/graph');
  fireEvent.change(await screen.findByLabelText('筛选模型'), { target: { value: '生效客户' } });
  fireEvent.click(await screen.findByRole('button', { name: '选择资源 生效客户' }));
  expect(screen.getByText('1 类型 · 0 关系')).toBeVisible();
  expect(within(screen.getByRole('complementary', { name: '资源属性' })).getByText(live.rid, { selector: 'dd', exact: true })).toBeVisible();
  expect(new URLSearchParams(router.state.location.search).get('typeRef')).toBe(live.rid);
  expect(requests.some((r) => r === 'get /api/v1/ont/v2/object-types?limit=100&offset=100')).toBe(true);
  expect(requests.every((r) => r.startsWith('get '))).toBe(true);
});
