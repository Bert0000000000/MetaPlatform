import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError } from 'axios';
import { apiClient } from '@/api/client';
import type { KernelLinkType } from '@/api/ont/kernel';
import LinkTypesPage from './LinkTypesPage';
import { SettingsProvider } from '@/contexts/SettingsContext';

vi.hoisted(() => { HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, measureText: () => ({ width: 0 }) })) as unknown as typeof HTMLCanvasElement.prototype.getContext; });

const customer = 'ont.acme.obj.customer', order = 'ont.acme.obj.order';
const definition: KernelLinkType = { rid: 'ont.acme.link.customer_orders', src: customer, dst: order,
  cardinality: '1:N', directionality: 'directed', src_display_name: 'Orders', dst_display_name: 'Customer',
  description: '', link_properties: [] };
let types: KernelLinkType[], instances: Record<string, unknown>[], failure: string;
let endpointCount: number, individualCount: number;
const originalAdapter = apiClient.defaults.adapter;
beforeEach(() => {
  types = [definition]; instances = []; failure = ''; endpointCount = 2; individualCount = 1;
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k), clear: () => storage.clear() });
  localStorage.setItem('mate_platform_user', JSON.stringify({ tenantId: 'acme' }));
  vi.stubGlobal('matchMedia', () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
  // Only external transport is doubled; API wrappers and mounted components remain real.
  apiClient.defaults.adapter = async config => {
    const path = config.url ?? '';
    const response = (data: unknown, status = 200) => ({ data, status, statusText: '', headers: {}, config });
    if ((failure === 'instances' && path.endsWith('/link-instances') && config.method === 'get') ||
        (failure === 'stats' && path.endsWith('/stats')) ||
        (failure === 'catalog' && path.endsWith('/link-types') && config.method === 'get') ||
        (failure === 'page2' && path.endsWith('/link-instances') && config.params?.offset === 200)) {
      throw new AxiosError('Unavailable', 'ERR_BAD_RESPONSE', config, undefined, response({ detail: '数据库暂不可用' }, 503));
    }
    if (path.endsWith('/settings')) return response({});
    if (path.endsWith('/object-types')) {
      const make = (rid: string, display_name: string) => ({ rid, display_name, properties: [], primary_key: [], interfaces: [] });
      const all = [make(customer, 'Customer'),
        ...Array.from({ length: endpointCount - 2 }, (_, i) => make('ont.acme.obj.filler' + i, 'Filler ' + i)),
        make(order, 'Order')];
      const offset = config.params?.offset ?? 0, limit = config.params?.limit ?? 100;
      return response(all.slice(offset, offset + limit));
    }
    if (path.endsWith('/value-types')) return response([{ type_id: 'string', format: 'string', description: '' }]);
    if (path.endsWith('/individuals')) return response(config.params?.class_rid === customer
      ? Array.from({ length: individualCount }, (_, i) => ({ rid: 'ont.acme.ind.c' + String(i + 1).padStart(3, '0'),
        class_rid: customer, primary_key: 'C' + String(i + 1).padStart(3, '0'), props: {}, tenant_id: 'acme' }))
      : [{ rid: 'ont.acme.ind.o001', class_rid: order, primary_key: 'O001', props: {}, tenant_id: 'acme' }]);
    if (path.endsWith('/stats')) return response({ total: instances.length, by_link_type: { [definition.rid]: instances.length } });
    if (path.endsWith('/link-types')) {
      if (config.method === 'post') { const body = JSON.parse(config.data);
        if (config.params?.create_only && types.some(t => t.rid === body.rid)) throw new AxiosError('Conflict', 'ERR_BAD_RESPONSE', config, undefined, response({ detail: '关系标识已存在' }, 409));
        types = [...types.filter(t => t.rid !== body.rid), body]; return response(body); }
      return response(types);
    }
    if (path.endsWith('/link-instances')) {
      if (config.method === 'post') {
        if (failure === 'conflict') throw new AxiosError('Conflict', 'ERR_BAD_RESPONSE', config, undefined, response({ detail: '订单已关联其他客户' }, 409));
        const body = JSON.parse(config.data);
        if (Array.isArray(body.props)) throw new Error('Wrong LinkInstanceDTO');
        const row = { ...body, props: Object.fromEntries(Object.entries(body.props).map(([k, v]) => [k, (v as { value: unknown }).value])), tenant_id: 'acme' };
        instances.push(row); return response(row);
      }
      return response(instances.slice(config.params?.offset ?? 0, (config.params?.offset ?? 0) + (config.params?.limit ?? instances.length)));
    }
    throw new Error('Unexpected request ' + path);
  };
});
afterEach(() => { cleanup(); apiClient.defaults.adapter = originalAdapter; localStorage.clear(); vi.unstubAllGlobals(); });
const mount = (url = '/') => render(<MemoryRouter initialEntries={[url]}><SettingsProvider><LinkTypesPage /></SettingsProvider></MemoryRouter>);
const change = (name: string, value: string) => fireEvent.change(screen.getByLabelText(name), { target: { value } });
async function associate() {
  fireEvent.click(await screen.findByRole('button', { name: '实例' }));
  fireEvent.click(await screen.findByRole('button', { name: '关联对象' }));
  await screen.findByRole('option', { name: 'C001' });
  change('源对象', 'ont.acme.ind.c001'); change('目标对象', 'ont.acme.ind.o001');
}
describe('relationship UI (transport mocked)', () => {
  it('creates a definition from endpoint choices and shows it after saving', async () => {
    mount(); fireEvent.click(await screen.findByRole('button', { name: '新建关系' }));
    await screen.findAllByRole('option', { name: 'Customer' });
    change('关系名称', 'Customer Orders'); change('源对象类型', customer); change('目标对象类型', order);
    expect(screen.getByLabelText('关系标识')).toHaveValue('customer_orders');
    change('关系标识', 'new_orders'); fireEvent.click(screen.getByRole('button', { name: '保存关系' }));
    expect(await screen.findByText('new_orders')).toBeVisible();
  });
  it('associates C001/O001 and reloads the list and count', async () => {
    mount(); await associate(); fireEvent.click(screen.getByRole('button', { name: '保存关联' }));
    expect(await screen.findByText('c001')).toBeVisible();
    expect(screen.getByText('o001')).toBeVisible(); expect(screen.getByText('1 条实例')).toBeVisible();
  });
  it('retains inputs and server conflict for retry', async () => {
    failure = 'conflict'; mount(); await associate(); fireEvent.click(screen.getByRole('button', { name: '保存关联' }));
    expect(await screen.findByText('订单已关联其他客户')).toBeVisible();
    expect(screen.getByLabelText('源对象')).toHaveValue('ont.acme.ind.c001');
    expect(screen.getByLabelText('目标对象')).toHaveValue('ont.acme.ind.o001');
    failure = ''; fireEvent.click(screen.getByRole('button', { name: '保存关联' }));
    expect(await screen.findByText('c001')).toBeVisible();
  });
  it('shows read failure instead of empty list and recovers on retry', async () => {
    failure = 'instances'; mount(); fireEvent.click(await screen.findByRole('button', { name: '实例' }));
    expect(await screen.findByText('数据库暂不可用')).toBeVisible();
    expect(screen.queryByText('该关系类型还没有实例')).not.toBeInTheDocument();
    failure = ''; fireEvent.click(screen.getByRole('button', { name: '重试实例' }));
    expect(await screen.findByText('该关系类型还没有实例')).toBeVisible();
  });
  it('shows statistics failure rather than a false zero', async () => {
    failure = 'stats'; mount(); expect(await screen.findByText(/统计读取失败/)).toBeVisible();
    expect(screen.getByText('不可用')).toBeVisible();
  });
  it('preselects current object and protects structure when instances exist', async () => {
    instances.push({ rid: 'ont.acme.lnk.1', link_type_rid: definition.rid, src: 'ont.acme.ind.c001', dst: 'ont.acme.ind.o001', props: {}, tenant_id: 'acme' });
    mount('/?source=' + encodeURIComponent(customer) + '&create=1');
    expect(await screen.findByLabelText('源对象类型')).toHaveValue(customer);
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    fireEvent.click(await screen.findByRole('button', { name: '编辑关系' }));
    const form = await screen.findByRole('form', { name: '关系定义表单' });
    expect(within(form).getByLabelText('源对象类型')).toBeDisabled();
    expect(within(form).getByLabelText('基数')).toBeDisabled(); expect(within(form).getByLabelText('说明')).toBeEnabled();
  });
});


describe('relationship review regressions (transport mocked)', () => {
  it('blocks creation while catalog is unavailable, then retries without losing inputs', async () => {
    failure = 'catalog'; mount('/?create=1');
    await screen.findAllByRole('option', { name: 'Customer' });
    change('关系名称', 'New Relation'); change('源对象类型', customer); change('目标对象类型', order);
    expect(screen.getByRole('button', { name: '保存关系' })).toBeDisabled();
    expect(screen.getByText(/关系目录读取失败/)).toBeVisible();
    failure = ''; fireEvent.click(screen.getByRole('button', { name: '重试关系目录' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '保存关系' })).toBeEnabled());
    expect(screen.getByLabelText('关系名称')).toHaveValue('New Relation');
  });
  it('retains creation inputs when another session claims the RID after catalog loading', async () => {
    types = []; mount('/?create=1');
    await screen.findAllByRole('option', { name: 'Customer' });
    change('关系名称', 'Customer Orders'); change('源对象类型', customer); change('目标对象类型', order);
    change('说明', 'My unsaved description');
    types = [definition];
    fireEvent.click(screen.getByRole('button', { name: '保存关系' }));
    expect(await screen.findByText('关系标识已存在')).toBeVisible();
    expect(screen.getByLabelText('说明')).toHaveValue('My unsaved description');
  });
  it('loads later authorized pages and keeps a later-page source deep link selected', async () => {
    endpointCount = 102; mount('/?create=1&source=' + encodeURIComponent(order));
    await screen.findAllByRole('option', { name: 'Order' });
    expect(screen.getByLabelText('源对象类型')).toHaveValue(order);
    change('关系名称', 'Later Page'); change('目标对象类型', customer);
    fireEvent.click(screen.getByRole('button', { name: '保存关系' }));
    expect(await screen.findByText('later_page')).toBeVisible();
  });
  it.each([200, 201])('shows all %i actual individuals without a fake load-more action', async count => {
    individualCount = count; mount();
    fireEvent.click(await screen.findByRole('button', { name: '实例' }));
    fireEvent.click(await screen.findByRole('button', { name: '关联对象' }));
    await screen.findByRole('option', { name: 'C' + count });
    expect(screen.queryByRole('button', { name: '加载更多源对象' })).not.toBeInTheDocument();
  });
  it('can return to the previous instance page after the next-page read fails', async () => {
    instances = Array.from({ length: 200 }, (_, i) => ({ rid: 'ont.acme.lnk.' + i, link_type_rid: definition.rid,
      src: 'ont.acme.ind.c' + i, dst: 'ont.acme.ind.o' + i, props: {}, tenant_id: 'acme' }));
    mount(); fireEvent.click(await screen.findByRole('button', { name: '实例' }));
    await screen.findByText('200 条实例');
    failure = 'page2'; fireEvent.click(screen.getByRole('button', { name: '下一页实例' }));
    expect(await screen.findByText('数据库暂不可用')).toBeVisible();
    expect(screen.getByRole('button', { name: '上一页实例' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '上一页实例' }));
    expect(await screen.findByText('200 条实例')).toBeVisible();
    expect(screen.queryByText('数据库暂不可用')).not.toBeInTheDocument();
  }, 10000);
});
