vi.hoisted(() => { HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) })) as never; });
vi.mock('lottie-web', () => ({ default: { loadAnimation: vi.fn() } }));
import { Suspense } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
const http = vi.hoisted(() => ({ get: vi.fn(), sources: vi.fn() }));
vi.mock('@/api/client', () => ({ apiClient: http }));
vi.mock('@mate/shared', () => ({ useAuth: () => ({ user: { id: 'signed-user', tenantId: 'owned-tenant' } }) }));
vi.mock('@/api/ontology-bigdata', () => ({ listBigDataSources: async () => [] }));
vi.mock('@/api/apphub/runtime', () => ({ getAppRuntime: vi.fn() }));
vi.mock('@/api/apphub/apps', () => ({ listApps: async () => ({ items: [], total: 0 }) }));
vi.mock('@/api/ont/kernel', async importOriginal => ({
  ...await importOriginal<typeof import('./kernel')>(),
  listLinkTypes: async () => [], listActionTypes: async () => [],
  listBackingDatasources: http.sources, listIndividuals: async () => [], listLinkInstances: async () => [],
  getMaterialization: async (classRid: string) => ({ class_rid: classRid, schema: {}, rows: [], count: 0 }),
}));
import BackingDatasourcePanel from '@/pages/ontology/data/mappings/BackingDatasourcePanel';
import OrderReviewBinding from '@/pages/apphub/components/OrderReviewBinding';
import ProductOnboarding, { onboardingKey } from '@/pages/dashboard/components/ProductOnboarding';
const model = (rid: string, display_name: string) => ({ rid, display_name, status: 'active', checksum: 'checksum-' + rid,
  primary_key: ['id'], properties: [{ rid: 'id', title: 'id', type_id: 'integer', format: 'integer', nullable: false, primary_key: true }], interfaces: [] });
const models = [...Array.from({ length: 101 }, (_, n) => model('ont.owned-tenant.obj.filler' + n, 'Filler ' + n)),
  model('ont.owned-tenant.obj.zcustomer', 'Late Customer'), model('ont.owned-tenant.obj.zorder', 'Late Order')];
let storage: Map<string, string>;
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal('localStorage', { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) });
  http.sources.mockReset().mockResolvedValue([]);
  http.get.mockReset();
  http.get.mockImplementation(async (_path: string, config?: { params?: { limit?: number; offset?: number } }) => {
    const { limit = 100, offset = 0 } = config?.params ?? {};
    return { data: models.slice(offset, offset + limit) };
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const consumers = ['mapping', 'binding', 'onboarding'] as const;
function mount(consumer: typeof consumers[number]) {
  if (consumer === 'onboarding') {
    localStorage.setItem(onboardingKey('owned-tenant', 'signed-user'), JSON.stringify({ flow: 'data', modelRid: models[102].rid }));
  }
  return render(<MemoryRouter>{consumer === 'mapping' ? <BackingDatasourcePanel /> :
    consumer === 'binding' ? <OrderReviewBinding onChange={vi.fn()} /> : <ProductOnboarding />}</MemoryRouter>);
}
it.each(consumers)('%s exposes late-page Order and Customer and preserves selected onboarding model', async consumer => {
  mount(consumer);
  await screen.findAllByRole('option', { name: 'Late Order' });
  expect(screen.getAllByRole('option', { name: 'Late Customer' }).length).toBeGreaterThan(0);
  if (consumer === 'mapping') {
    await waitFor(() => expect((screen.getByLabelText('对象类型') as HTMLSelectElement).disabled).toBe(false));
    fireEvent.change(screen.getByLabelText('对象类型'), { target: { value: models[102].rid } });
    await waitFor(() => expect((screen.getByLabelText('对象类型') as HTMLSelectElement).value).toBe(models[102].rid));
  } else if (consumer === 'onboarding') {
    expect((screen.getByLabelText('本次对象模型') as HTMLSelectElement).value).toBe(models[102].rid);
    fireEvent.click(screen.getByRole('button', { name: '重新核验产物' }));
    await waitFor(() => expect((screen.getByLabelText('本次对象模型') as HTMLSelectElement).value).toBe(models[102].rid));
    expect(JSON.parse(localStorage.getItem(onboardingKey('owned-tenant', 'signed-user'))!).modelRid).toBe(models[102].rid);
  }
});
it.each(consumers)('%s shows failed later-page catalog rather than accepting a truncated success', async consumer => {
  http.get.mockImplementation(async (_path: string, config?: { params?: { offset?: number } }) => {
    if ((config?.params?.offset ?? 0) > 0) throw new Error('later catalog page unavailable');
    return { data: models.slice(0, 100) };
  });
  mount(consumer);
  expect((await screen.findByRole('alert')).textContent).toContain('later catalog page unavailable');
  expect(screen.queryByRole('option', { name: 'Filler 0' })).toBeNull();
});
it.each(consumers)('%s rejects a repeated later page with no catalog progress', async consumer => {
  http.get.mockResolvedValue({ data: models.slice(0, 100) });
  mount(consumer);
  expect((await screen.findByRole('alert')).textContent).toContain('分页未取得进展');
});
it('does not replace a pending type selection when the previous source read finishes', async () => {
  let resolveSources!: (value: []) => void;
  const sources = new Promise<[]>((resolve) => { resolveSources = resolve; });
  http.sources.mockImplementation((rid: string) => rid === models[0].rid ? sources : Promise.resolve([]));
  let releaseNavigation!: () => void;
  const pending = new Promise<void>((resolve) => { releaseNavigation = resolve; });
  let settled = false;
  let navigationRequested = false;
  function PendingDestination() {
    const location = useLocation();
    if (new URLSearchParams(location.search).get('typeRef') === models[102].rid && !settled) {
      navigationRequested = true;
      throw pending;
    }
    return null;
  }
  render(<MemoryRouter initialEntries={[`/?typeRef=${models[0].rid}`]}>
    <Suspense fallback={<p>正在提交类型导航</p>}><PendingDestination /><BackingDatasourcePanel /></Suspense>
  </MemoryRouter>);
  await screen.findAllByRole('option', { name: 'Late Order' });
  await waitFor(() => expect((screen.getByLabelText('对象类型') as HTMLSelectElement).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText('对象类型'), { target: { value: models[102].rid } });
  await waitFor(() => expect(navigationRequested).toBe(true));
  // The old workspace stays mounted until this concurrent navigation commits.
  await act(async () => { resolveSources([]); await sources; });
  await act(async () => { settled = true; releaseNavigation(); await pending; });
  await screen.findByText(/该类型尚未声明来源/);
  expect((screen.getByLabelText('对象类型') as HTMLSelectElement).value).toBe('ont.owned-tenant.obj.zorder');
  expect(screen.getByText(/来源：当前对象类型的物化结果/).textContent).toContain('ont.owned-tenant.obj.zorder');
});
