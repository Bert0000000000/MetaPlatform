import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { useState } from 'react';
import * as api from '@/api/ont/kernel';
import ObjectTypesPage from './ObjectTypesPage';
import OntologyModelingPage from '../../OntologyModelingPage';
import ModelGraphCanvas from '../graph/ModelGraphCanvas';
import { setEditorSessionIdentity } from '../../hooks/editorSession';
vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({
    fillRect() {},
    clearRect() {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
const auth = vi.hoisted(() => ({
  user: { id: 'real-user', tenantId: 'tenant' },
}));
vi.mock('@/api/ont/kernel', async (original) => ({
  ...(await original<typeof api>()),
  listObjectTypes: vi.fn(),
  listLinkTypes: vi.fn(),
  listActionTypes: vi.fn(),
  listValueTypes: vi.fn(),
  listInterfaces: vi.fn(),
  getTypeHierarchy: vi.fn(),
  precheckObjectTypes: vi.fn(),
  createObjectType: vi.fn(),
}));
vi.mock('@mate/shared', () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock('@/utils/auth', () => ({ getTenantId: () => 'tenant' }));
vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({ resolvedTheme: 'light' }),
}));
const type: api.KernelObjectType = {
  rid: 'ont.tenant.obj.crm.customer.v1',
  display_name: '已有客户',
  primary_key: ['ont.tenant.prop.crm.customer-id.v1'],
  properties: [
    {
      rid: 'ont.tenant.prop.crm.customer-id.v1',
      title: '客户编号',
      type_id: 'string',
      format: 'string',
      nullable: false,
      primary_key: true,
    },
  ],
  interfaces: [],
};
beforeEach(() => {
  auth.user = { id: 'real-user', tenantId: 'tenant' };
  setEditorSessionIdentity('');
  vi.clearAllMocks();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.mocked(api.listObjectTypes).mockResolvedValue([type]);
  vi.mocked(api.listActionTypes).mockResolvedValue([]);
  vi.mocked(api.listLinkTypes).mockResolvedValue([]);
  vi.mocked(api.listValueTypes).mockResolvedValue([]);
  vi.mocked(api.listInterfaces).mockResolvedValue([]);
  vi.mocked(api.getTypeHierarchy).mockResolvedValue([]);
  vi.mocked(api.precheckObjectTypes).mockResolvedValue({
    candidates: [
      {
        rid: type.rid,
        display_name: type.display_name,
        similarity: 0.9,
        slug: 'crm.customer',
        suggested_action: 'merge',
      },
    ],
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function mount() {
  const router = createMemoryRouter(
    [
      { path: '/ontology/model/object-types', element: <ObjectTypesPage /> },
      { path: '/other', element: <h1>其他页面</h1> },
    ],
    { initialEntries: ['/ontology/model/object-types?create=true'] },
  );
  render(<RouterProvider router={router} />);
  return router;
}
it.each(['', '   '])('warns about identity-unavailable page restoration and retains modal dirty protection (%j)', async (id) => {
  auth.user = { id, tenantId: 'tenant' };
  const router = mount();
  const drawer = await screen.findByRole('dialog', { name: '模型编辑器' });
  expect(await within(drawer).findByRole('alert')).toHaveTextContent(/身份不可用.*跨页.*无法恢复/);
  expect(within(drawer).getByRole('link', { name: '重新登录' })).toHaveAttribute('href', '/login');
  expect(within(drawer).getByRole('button', { name: '保存（整体 upsert）' })).toBeEnabled();
  fireEvent.change(screen.getByPlaceholderText('例如：客户'), { target: { value: 'unknown personal input' } });
  expect(screen.queryByText(/未保存输入已保留在当前会话/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  expect(await screen.findByRole('dialog', { name: '未保存的修改' })).toBeVisible();
  await act(async () => { await router.navigate('/other'); });
  auth.user = { id: id ? '' : '   ', tenantId: 'tenant' };
  await act(async () => { await router.navigate(-1); });
  await screen.findByRole('dialog', { name: '模型编辑器' });
  expect(screen.getByPlaceholderText('例如：客户')).toHaveValue('');
  expect(screen.queryByText(/未保存输入已保留在当前会话/)).toBeNull();
});
async function candidate() {
  await screen.findByRole('dialog', { name: '模型编辑器' });
  fireEvent.change(screen.getByPlaceholderText('例如：客户'), {
    target: { value: '待提交客户' },
  });
  fireEvent.change(screen.getByPlaceholderText('例如：customer'), {
    target: { value: 'new_customer' },
  });
  fireEvent.click(screen.getByRole('button', { name: '保存（整体 upsert）' }));
  await screen.findByText('检测到相似概念');
  fireEvent.click(screen.getByRole('button', { name: '仍要新建' }));
  await waitFor(() => expect(api.createObjectType).toHaveBeenCalledTimes(1));
}
it('locks the actual retained editor throughout deferred similarity continuation and retains failed input', async () => {
  let reject: (reason: unknown) => void = () => {};
  vi.mocked(api.createObjectType).mockImplementation(
    () =>
      new Promise((_resolve, no) => {
        reject = no;
      }),
  );
  mount();
  await candidate();
  expect(screen.getByPlaceholderText('例如：客户')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.getByRole('dialog', { name: '模型编辑器' })).toBeVisible();
  expect(screen.queryByRole('dialog', { name: '未保存的修改' })).toBeNull();
  await act(async () =>
    reject({
      response: { status: 422, data: { detail: 'continuation rejected' } },
    }),
  );
  expect(
    await within(screen.getByRole('dialog', { name: '模型编辑器' })).findByText(
      /422.*continuation rejected/,
    ),
  ).toBeVisible();
  expect(screen.getByPlaceholderText('例如：客户')).toBeEnabled();
  expect(screen.getByPlaceholderText('例如：客户')).toHaveValue('待提交客户');
});
it('cannot clear or close a newer restored draft when an old continuation succeeds after navigation', async () => {
  let finish: (result: api.KernelObjectType) => void = () => {};
  vi.mocked(api.createObjectType).mockImplementation(
    () =>
      new Promise((ok) => {
        finish = ok;
      }),
  );
  const router = mount();
  await candidate();
  await act(async () => {
    await router.navigate('/other');
  });
  await screen.findByRole('heading', { name: '其他页面' });
  await act(async () => {
    await router.navigate(-1);
  });
  await screen.findByRole('dialog', { name: '模型编辑器' });
  fireEvent.change(screen.getByPlaceholderText('例如：客户'), {
    target: { value: '更新的未提交草稿' },
  });
  await act(async () => finish(type));
  expect(screen.getByRole('dialog', { name: '模型编辑器' })).toBeVisible();
  expect(screen.getByPlaceholderText('例如：客户')).toHaveValue(
    '更新的未提交草稿',
  );
  expect(api.createObjectType).toHaveBeenCalledTimes(1);
  await act(async () => {
    await router.navigate('/other');
    await router.navigate(-1);
  });
  await screen.findByRole('dialog', { name: '模型编辑器' });
  expect(screen.getByPlaceholderText('例如：客户')).toHaveValue(
    '更新的未提交草稿',
  );
});
it('shows rejected value/interface reads inside the actual editor entry and retries them', async () => {
  vi.mocked(api.listValueTypes).mockRejectedValueOnce({
    response: { status: 403, data: { detail: 'value registry denied' } },
  });
  vi.mocked(api.listInterfaces).mockRejectedValueOnce({
    response: {
      status: 503,
      data: { detail: 'interface service unavailable' },
    },
  });
  mount();
  const drawer = await screen.findByRole('dialog', { name: '模型编辑器' });
  expect(
    await within(drawer).findByText(/值类型.*forbidden.*403/),
  ).toBeVisible();
  expect(within(drawer).getByText(/接口.*unavailable.*503/)).toBeVisible();
  fireEvent.change(screen.getByPlaceholderText('例如：客户'), {
    target: { value: '保留名称' },
  });
  vi.mocked(api.listInterfaces).mockResolvedValueOnce([
    {
      rid: 'ont.tenant.ifc.named.v1',
      properties: [],
      required_links: [],
      polymorphic_action_constraints: [],
    },
  ]);
  fireEvent.click(
    within(drawer).getByRole('button', { name: '重试编辑辅助信息' }),
  );
  await waitFor(() => expect(api.listInterfaces).toHaveBeenCalledTimes(2));
  expect(
    await within(drawer).findByRole('option', { name: /named/ }),
  ).toBeVisible();
  expect(screen.getByPlaceholderText('例如：客户')).toHaveValue('保留名称');
});
it('fits a tall canvas in both viewport dimensions and resets its scroll origin', () => {
  const types = Array.from({ length: 12 }, (_, i) => ({
    ...type,
    rid: `ont.tenant.obj.crm.type-${i}.v1`,
  }));
  const result = render(
    <ModelGraphCanvas
      types={types}
      links={[]}
      onSelect={() => {}}
      onOpen={() => {}}
    />,
  );
  const stage = result.container.querySelector('.mw-canvas') as HTMLDivElement;
  Object.defineProperties(stage, {
    clientWidth: { value: 900 },
    clientHeight: { value: 300 },
  });
  stage.scrollTop = 400;
  stage.scrollLeft = 80;
  fireEvent.click(screen.getByRole('button', { name: '适应画布' }));
  expect(stage.scrollTop).toBe(0);
  expect(stage.scrollLeft).toBe(0);
  const plane = result.container.querySelector(
    '.mw-canvas-plane',
  ) as HTMLDivElement;
  expect(plane.style.transform).toBe(`scale(${300 / 945})`);
});
it('ignores an old continuation after an identity change on the same mounted page', async () => {
  let finish: (result: api.KernelObjectType) => void = () => {};
  vi.mocked(api.createObjectType).mockImplementation(
    () =>
      new Promise((ok) => {
        finish = ok;
      }),
  );
  const router = mount();
  await candidate();
  auth.user = { id: 'second-user', tenantId: 'tenant' };
  await act(async () => {
    await router.navigate(
      '/ontology/model/object-types?create=true&identity=second',
    );
  });
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: '模型编辑器' })).toBeNull(),
  );
  fireEvent.click(screen.getByRole('button', { name: '新建本体' }));
  await screen.findByRole('dialog', { name: '模型编辑器' });
  await waitFor(() =>
    expect(screen.getByPlaceholderText('例如：客户')).toBeEnabled(),
  );
  fireEvent.change(screen.getByPlaceholderText('例如：客户'), {
    target: { value: '新身份草稿' },
  });
  await act(async () => finish(type));
  expect(screen.getByPlaceholderText('例如：客户')).toHaveValue('新身份草稿');
  expect(screen.getByRole('dialog', { name: '模型编辑器' })).toBeVisible();
});
function ReferenceHarness() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [open, setOpen] = useState(true);
  return (
    <>
      <button onClick={() => setRefreshKey((n) => n + 1)}>刷新引用</button>
      <OntologyModelingPage
        createOpen={open}
        setCreateOpen={setOpen}
        refreshKey={refreshKey}
      />
    </>
  );
}
it('keeps prior reference values on failure and ignores older retry responses', async () => {
  const named: api.KernelInterface = {
    rid: 'ont.tenant.ifc.named.v1',
    properties: [],
    required_links: [],
    polymorphic_action_constraints: [],
  };
  vi.mocked(api.listInterfaces).mockResolvedValueOnce([named]);
  const router = createMemoryRouter([
    { path: '/', element: <ReferenceHarness /> },
  ]);
  render(<RouterProvider router={router} />);
  const drawer = await screen.findByRole('dialog', { name: '模型编辑器' });
  await within(drawer).findByRole('option', { name: /named/ });
  fireEvent.change(within(drawer).getByRole('listbox'), {
    target: { value: named.rid },
  });
  vi.mocked(api.listInterfaces).mockRejectedValueOnce({
    response: { status: 403, data: { detail: 'retry denied' } },
  });
  fireEvent.click(screen.getByRole('button', { name: '刷新引用' }));
  expect(await within(drawer).findByText(/接口.*stale.*403/)).toBeVisible();
  expect(within(drawer).getByRole('option', { name: /named/ })).toBeVisible();
  expect(within(drawer).getByRole('listbox')).toHaveValue([named.rid]);
  let old: (value: api.KernelInterface[]) => void = () => {};
  vi.mocked(api.listInterfaces).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        old = resolve;
      }),
  );
  fireEvent.click(
    within(drawer).getByRole('button', { name: '重试编辑辅助信息' }),
  );
  await waitFor(() => expect(api.listInterfaces).toHaveBeenCalledTimes(3));
  vi.mocked(api.listInterfaces).mockResolvedValueOnce([
    { ...named, rid: 'ont.tenant.ifc.latest.v1' },
  ]);
  fireEvent.click(screen.getByRole('button', { name: '刷新引用' }));
  await within(drawer).findByRole('option', { name: /latest/ });
  await act(async () => old([{ ...named, rid: 'ont.tenant.ifc.stale.v1' }]));
  expect(within(drawer).getByRole('option', { name: /latest/ })).toBeVisible();
  expect(within(drawer).queryByRole('option', { name: /stale/ })).toBeNull();
});
it('clears only the successfully submitted continuation and allows a clean new draft', async () => {
  let finish: () => void = () => {};
  vi.mocked(api.createObjectType).mockImplementationOnce(
    (payload) =>
      new Promise((resolve) => {
        finish = () => resolve({ ...type, ...payload });
      }),
  );
  mount();
  await candidate();
  expect(screen.getByPlaceholderText('例如：客户')).toBeDisabled();
  await act(async () => finish());
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: '模型编辑器' })).toBeNull(),
  );
  fireEvent.click(screen.getByRole('button', { name: '新建本体' }));
  await screen.findByRole('dialog', { name: '模型编辑器' });
  expect(screen.getByPlaceholderText('例如：客户')).toHaveValue('');
  expect(
    screen.queryByText(/未保存输入已保留在当前会话，尚未提交后端/),
  ).toBeNull();
});
