import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { safeReturnTo, resourceUrl } from '../hooks/resourceContext';
import {
  setEditorSessionIdentity,
  readEditorInput,
  retainEditorInput,
} from '../hooks/editorSession';
import * as api from '@/api/ont/kernel';
import OntologyGraphView from './OntologyGraphView';
import ObjectTypeDetailPage from './object-types/ObjectTypeDetailPage';
vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({
    fillRect() {},
    clearRect() {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
vi.mock('@/api/ont/kernel', async (original) => ({
  ...(await original<typeof api>()),
  listObjectTypes: vi.fn(),
  listLinkTypes: vi.fn(),
  getObjectType: vi.fn(),
  listActionTypes: vi.fn(),
  listBackingDatasources: vi.fn(),
  getMaterialization: vi.fn(),
  listVersions: vi.fn(),
  listValueTypes: vi.fn(),
  listInterfaces: vi.fn(),
  createObjectType: vi.fn(),
  saveSchemaWip: vi.fn(),
  validateObjectTypeModel: vi.fn(),
}));
vi.mock('@/utils/auth', () => ({ getTenantId: () => 'tenant' }));
vi.mock('@mate/shared', () => ({
  useAuth: () => ({ user: { id: 'editor-user', tenantId: 'tenant' } }),
}));
vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({ resolvedTheme: 'light' }),
}));
const nested: api.KernelProperty = {
  rid: 'ont.tenant.prop.crm.address-street.v1',
  title: '街道',
  type_id: 'CUSTOM_STRING',
  format: 'string',
  nullable: false,
  primary_key: false,
  description: '嵌套说明',
  shared: true,
  struct_fields: [],
};
const customer: api.KernelObjectType = {
  rid: 'ont.tenant.obj.crm.customer.v1',
  display_name: '客户',
  primary_key: ['ont.tenant.prop.crm.customer-id.v1'],
  interfaces: ['ont.tenant.ifc.named.v1'],
  parent_class: 'ont.tenant.obj.crm.party.v1',
  marking: ['internal'],
  status: 'active',
  type_group: 'CRM',
  render_hints: [['icon', 'user']],
  checksum: 'live-sum',
  description: '客户模型',
  properties: [
    {
      rid: 'ont.tenant.prop.crm.customer-id.v1',
      title: '客户编号',
      type_id: 'STRING',
      format: 'string',
      primary_key: true,
      nullable: false,
      description: '客户唯一标识',
      shared: true,
      array: false,
    },
    {
      rid: 'ont.tenant.prop.crm.address.v1',
      title: '地址',
      type_id: 'struct',
      format: 'struct',
      primary_key: false,
      nullable: true,
      struct_fields: [nested],
    },
  ],
};
beforeEach(() => {
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
  vi.mocked(api.listObjectTypes).mockResolvedValue([customer]);
  vi.mocked(api.getObjectType).mockResolvedValue(customer);
  vi.mocked(api.listLinkTypes).mockResolvedValue([
    {
      rid: 'ont.tenant.link.customer-party.v1',
      src: customer.rid,
      dst: customer.rid,
      cardinality: 'N:1',
      directionality: 'directed',
      link_properties: [],
    },
  ]);
  vi.mocked(api.listActionTypes).mockResolvedValue([]);
  vi.mocked(api.listBackingDatasources).mockResolvedValue([]);
  vi.mocked(api.getMaterialization).mockResolvedValue({
    class_rid: customer.rid,
    count: 0,
    rows: [],
    schema: {},
  });
  vi.mocked(api.listVersions).mockResolvedValue([
    {
      rid: 'ont.tenant.ver.customer.1',
      class_ref: customer.rid,
      parent_rid: null,
      created_at: '2026-10-08T10:00:00Z',
      author: 'reviewer',
      change_set: ['initial'],
      version_no: 1,
      checksum: 'live-sum',
      status: 'published',
      definition: { display_name: '快照客户' },
      dependencies: [],
    },
  ]);
  vi.mocked(api.listValueTypes).mockResolvedValue([]);
  vi.mocked(api.listInterfaces).mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function mount(path = '/ontology/model/graph') {
  const router = createMemoryRouter(
    [
      { path: '/ontology/model/graph', element: <OntologyGraphView /> },
      {
        path: '/ontology/model/object-types/:rid/:tab?',
        element: <ObjectTypeDetailPage />,
      },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}
it('selects real card DTO, preserves RID when opening complete editor detail', async () => {
  const router = mount();
  fireEvent.click(await screen.findByRole('button', { name: '选择模型 客户' }));
  expect(
    screen.getByRole('complementary', { name: '资源属性' }),
  ).toHaveTextContent('客户编号');
  fireEvent.click(screen.getByRole('button', { name: '打开模型编辑器' }));
  expect(await screen.findByRole('heading', { name: '客户' })).toBeVisible();
  expect(router.state.location.pathname).toContain(
    encodeURIComponent(customer.rid),
  );
});
it('edits complete metadata, stages true WIP and keeps failed input', async () => {
  mount(
    `/ontology/model/object-types/${encodeURIComponent(customer.rid)}/properties`,
  );
  fireEvent.click(await screen.findByRole('button', { name: '编辑模型' }));
  fireEvent.change(screen.getByLabelText('概念显示名'), {
    target: { value: '客户新名' },
  });
  vi.mocked(api.saveSchemaWip).mockRejectedValueOnce({
    response: { status: 422, data: { detail: '定义无效' } },
  });
  fireEvent.click(screen.getByRole('button', { name: '保存草稿（WIP）' }));
  expect(await screen.findByText(/422.*定义无效/)).toBeVisible();
  expect(screen.getByLabelText('概念显示名')).toHaveValue('客户新名');
  expect(api.saveSchemaWip).toHaveBeenCalledWith(
    expect.objectContaining({
      display_name: '客户新名',
      interfaces: customer.interfaces,
      parent_class: customer.parent_class,
      marking: customer.marking,
      render_hints: customer.render_hints,
      properties: [
        expect.objectContaining({ description: '客户唯一标识', shared: true }),
        expect.objectContaining({ struct_fields: [nested] }),
      ],
    }),
  );
  expect(api.createObjectType).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  expect(screen.getByRole('dialog', { name: '未保存的修改' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '继续编辑' }));
  expect(screen.getByLabelText('概念显示名')).toHaveValue('客户新名');
});
it('reads snapshot history rather than live family and separates binding from samples', async () => {
  const router = mount(
    `/ontology/model/object-types/${encodeURIComponent(customer.rid)}/history`,
  );
  expect(await screen.findByText('当前生效')).toBeVisible();
  expect(api.listVersions).toHaveBeenCalledWith(customer.rid);
  await router.navigate(
    `/ontology/model/object-types/${encodeURIComponent(customer.rid)}/datasources`,
  );
  expect(
    await screen.findByRole('heading', { name: '来源绑定' }),
  ).toBeVisible();
  expect(screen.getByRole('heading', { name: '物化样本' })).toBeVisible();
  expect(api.listBackingDatasources).toHaveBeenCalledWith(customer.rid);
});
it('exposes forbidden auxiliary reads with retry, never an empty success', async () => {
  vi.mocked(api.listBackingDatasources).mockRejectedValueOnce({
    response: { status: 403, data: { detail: 'denied' } },
  });
  mount(
    `/ontology/model/object-types/${encodeURIComponent(customer.rid)}/datasources`,
  );
  expect(await screen.findByText(/来源绑定.*forbidden.*403/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '重试来源绑定' }));
  await waitFor(() =>
    expect(api.listBackingDatasources).toHaveBeenCalledTimes(2),
  );
  expect(await screen.findByText('暂无来源绑定')).toBeVisible();
});
it('keeps filter counts and selected URL, model checks never turn failed reads into success', async () => {
  vi.mocked(api.listObjectTypes).mockResolvedValue([
    customer,
    {
      ...customer,
      rid: 'ont.tenant.obj.crm.supplier.v1',
      display_name: '供应商',
    },
  ]);
  const router = mount(
    `/ontology/model/graph?typeRef=${encodeURIComponent(customer.rid)}&q=客户&view=list`,
  );
  expect(
    await screen.findByRole('button', { name: '选择模型 客户' }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('1 类型 · 1 关系')).toBeVisible();
  expect(screen.queryByRole('button', { name: '选择模型 供应商' })).toBeNull();
  expect(screen.getByText(/尚未校验/)).toBeVisible();
  vi.mocked(api.validateObjectTypeModel).mockRejectedValueOnce({
    response: { status: 403, data: { detail: 'denied' } },
  });
  fireEvent.click(screen.getByRole('button', { name: '校验选中模型' }));
  expect(await screen.findByText(/校验失败.*403/)).toBeVisible();
  expect(screen.queryByText(/校验通过/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '图谱视图' }));
  expect(router.state.location.search).toContain('typeRef=');
  expect(
    await screen.findByRole('button', { name: '选择模型 客户' }),
  ).toBeVisible();
});
it('ignores stale object and auxiliary responses after switching resources', async () => {
  let finishOld: (value: api.KernelBackingDatasource[]) => void = () => {};
  const old = new Promise<api.KernelBackingDatasource[]>((resolve) => {
    finishOld = resolve;
  });
  vi.mocked(api.listBackingDatasources).mockImplementation((rid) =>
    rid === customer.rid ? old : Promise.resolve([]),
  );
  const supplier = {
    ...customer,
    rid: 'ont.tenant.obj.crm.supplier.v1',
    display_name: '供应商',
  };
  vi.mocked(api.getObjectType).mockImplementation((rid) =>
    Promise.resolve(rid === supplier.rid ? supplier : customer),
  );
  const router = mount(
    `/ontology/model/object-types/${encodeURIComponent(customer.rid)}/datasources`,
  );
  await screen.findByRole('heading', { name: '客户' });
  await router.navigate(
    `/ontology/model/object-types/${encodeURIComponent(supplier.rid)}/datasources`,
  );
  expect(await screen.findByRole('heading', { name: '供应商' })).toBeVisible();
  finishOld([
    {
      rid: 'source',
      class_rid: customer.rid,
      name: '陈旧来源',
      kind: 'postgres',
      dsn_env: 'DSN',
      table_name: 'old',
      pk_column: 'id',
      field_mapping: {},
      priority: 1,
    },
  ]);
  expect(await screen.findByText('暂无来源绑定')).toBeVisible();
  expect(screen.queryByText('陈旧来源')).toBeNull();
});
it('does not discard clean editor and explicitly handles Escape on dirty fields', async () => {
  mount(
    `/ontology/model/object-types/${encodeURIComponent(customer.rid)}/properties`,
  );
  fireEvent.click(await screen.findByRole('button', { name: '编辑模型' }));
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  expect(screen.queryByRole('dialog', { name: '未保存的修改' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '编辑模型' }));
  fireEvent.change(screen.getByLabelText('概念显示名'), {
    target: { value: '修改' },
  });
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.getByRole('dialog', { name: '未保存的修改' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '放弃修改并关闭' }));
  expect(screen.queryByLabelText('概念显示名')).toBeNull();
});
it('rejects unsafe return URLs while preserving identifiers and legacy class', () => {
  for (const value of [
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/home\n',
  ])
    expect(safeReturnTo(value)).toBeUndefined();
  const url = resourceUrl(
    '/ontology/explore/objects',
    customer.rid,
    '/ontology/model/graph?view=list',
    'change-rid',
  );
  const params = new URLSearchParams(url.split('?')[1]);
  expect(params.get('typeRef')).toBe(customer.rid);
  expect(params.get('class')).toBe(customer.rid);
  expect(params.get('returnTo')).toBe('/ontology/model/graph?view=list');
  expect(params.get('changeRef')).toBe('change-rid');
});
it('restores FULL unsaved input after navigation away and back without any mutation', async () => {
  const path = `/ontology/model/object-types/${encodeURIComponent(customer.rid)}/properties`;
  const router = mount(path);
  fireEvent.click(await screen.findByRole('button', { name: '编辑模型' }));
  fireEvent.change(screen.getByLabelText('概念显示名'), {
    target: { value: '未保存名称' },
  });
  fireEvent.click(screen.getAllByRole('button', { name: '添加属性' }).at(-1)!);
  const invalid = screen.getByPlaceholderText('例如 dept_name');
  fireEvent.change(invalid, { target: { value: 'invalid property !' } });
  await router.navigate('/ontology/model/graph');
  await screen.findByRole('button', { name: '选择模型 客户' });
  vi.mocked(api.getObjectType).mockResolvedValueOnce({
    ...customer,
    checksum: 'changed-live',
    description: '服务端新描述',
  });
  await router.navigate(-1);
  await screen.findByRole('heading',{name:'客户'});
  await waitFor(()=>expect(screen.getByRole('button',{name:'编辑模型'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '编辑模型' }));
  expect(screen.getByLabelText('概念显示名')).toHaveValue('未保存名称');
  expect(screen.getByPlaceholderText('例如 dept_name')).toHaveValue(
    'invalid property !',
  );
  expect(
    screen.getByText(/未保存输入已保留在当前会话，尚未提交后端/),
  ).toHaveTextContent('当前生效定义已变化');
  expect(api.createObjectType).not.toHaveBeenCalled();
  expect(api.saveSchemaWip).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  fireEvent.click(screen.getByRole('button', { name: '放弃修改并关闭' }));
  fireEvent.click(screen.getByRole('button', { name: '编辑模型' }));
  expect(screen.getByLabelText('概念显示名')).toHaveValue('客户');
  expect(screen.queryByText(/未保存输入已保留/)).toBeNull();
});
it('clears session input on logout and identity changes', () => {
  setEditorSessionIdentity('user-a');
  retainEditorInput('user-a', 'resource', { invalidDraft: '!' });
  expect(readEditorInput('user-a', 'resource')).toEqual({ invalidDraft: '!' });
  setEditorSessionIdentity('');
  setEditorSessionIdentity('user-a');
  expect(readEditorInput('user-a', 'resource')).toBeUndefined();
  retainEditorInput('user-a', 'resource', { invalidDraft: '!' });
  setEditorSessionIdentity('user-b');
  expect(readEditorInput('user-b', 'resource')).toBeUndefined();
});
it('marks active-family checksum when an archived RID detail is opened', async () => {
  const live = {
    ...customer,
    rid: customer.rid.replace('.v1', '.v2'),
    checksum: 'new-live',
  };
  vi.mocked(api.listObjectTypes).mockResolvedValue([live]);
  const base = {
    class_ref: customer.rid,
    parent_rid: null,
    created_at: '2026-10-08T10:00:00Z',
    author: 'reviewer',
    change_set: [],
    status: 'published',
    dependencies: [],
  };
  vi.mocked(api.listVersions).mockResolvedValue([
    {
      ...base,
      rid: 'snap-old',
      version_no: 1,
      checksum: 'live-sum',
      definition: { display_name: '旧快照' },
    },
    {
      ...base,
      rid: 'snap-new',
      version_no: 2,
      checksum: 'new-live',
      definition: { display_name: '生效快照' },
    },
  ]);
  mount(
    `/ontology/model/object-types/${encodeURIComponent(customer.rid)}/history`,
  );
  const current = await screen.findByText('当前生效');
  expect(current.closest('tr')).toHaveTextContent('生效快照');
  expect(current.closest('tr')).not.toHaveTextContent('旧快照');
  expect(screen.getByRole('heading', { name: '客户' })).toBeVisible();
  expect(api.listVersions).toHaveBeenCalledWith(customer.rid);
});
it('selects from the resource tree with the same filter, Inspector and URL across refresh and back', async () => {
  const supplier = { ...customer, rid: 'ont.tenant.obj.crm.supplier.v1', display_name: '供应商', type_group: '' };
  vi.mocked(api.listObjectTypes).mockResolvedValue([customer, supplier]);
  const router = mount();
  const tree = await screen.findByRole('complementary', { name: '模型资源树' });
  expect(within(tree).getByText('CRM')).toBeVisible();
  expect(within(tree).getByText('未分组')).toBeVisible();
  fireEvent.click(within(tree).getByRole('button', { name: '选择资源 供应商' }));
  expect(new URLSearchParams(router.state.location.search).get('typeRef')).toBe(supplier.rid);
  expect(screen.getByRole('complementary', { name: '资源属性' })).toHaveTextContent('供应商');
  fireEvent.click(screen.getByRole('button', { name: '刷新' }));
  expect(await screen.findByRole('button', { name: '选择资源 供应商' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.change(screen.getByLabelText('筛选资源树'), { target: { value: '客户' } });
  expect(screen.getByLabelText('筛选模型')).toHaveValue('客户');
  expect(screen.getByText('1 类型 · 1 关系')).toBeVisible();
  expect(screen.queryByRole('button', { name: '选择资源 供应商' })).toBeNull();
  expect(screen.getByRole('complementary', { name: '资源属性' })).toHaveTextContent('所选资源被筛选隐藏');
  fireEvent.click(screen.getByRole('button', { name: '资源列表' }));
  expect(screen.getByRole('button', { name: '选择模型 客户' })).toBeVisible();
  fireEvent.change(screen.getByLabelText('筛选资源树'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: '选择资源 客户' }));
  await router.navigate(-1);
  await waitFor(() => expect(screen.getByRole('complementary', { name: '资源属性' })).toHaveTextContent('供应商'));
  expect(api.createObjectType).not.toHaveBeenCalled();
  expect(api.saveSchemaWip).not.toHaveBeenCalled();
  expect(api.validateObjectTypeModel).not.toHaveBeenCalled();
});
it('keeps unknown requested resources explicit and exposes collapsible tree and Inspector controls', async () => {
  mount('/ontology/model/graph?typeRef=ont.tenant.obj.missing.v1');
  const inspector = await screen.findByRole('complementary', { name: '资源属性' });
  expect(inspector).toHaveTextContent('未找到请求的模型');
  expect(inspector).toHaveTextContent('ont.tenant.obj.missing.v1');
  fireEvent.click(screen.getByRole('button', { name: '资源树' }));
  expect(screen.queryByRole('complementary', { name: '模型资源树' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '资源树' }));
  expect(screen.getByRole('complementary', { name: '模型资源树' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '属性检查器' }));
  expect(screen.queryByRole('complementary', { name: '资源属性' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '属性检查器' }));
  expect(screen.getByRole('complementary', { name: '资源属性' })).toHaveTextContent('未找到请求的模型');
});
it('does not advertise partial reads as complete counts or a current-family checksum', async () => {
  vi.mocked(api.listObjectTypes).mockRejectedValue(new Error('later page unavailable'));
  const router = mount('/ontology/model/graph');
  expect(await screen.findByRole('alert')).toHaveTextContent('later page unavailable');
  expect(screen.queryByText('0 类型 · 0 关系')).toBeNull();
  expect(screen.getByRole('complementary', { name: '模型资源树' })).toHaveTextContent('计数未完成');
  expect(screen.queryByText('没有匹配的资源')).toBeNull();
  expect(screen.getByText('模型读取未完成')).toBeVisible();
  await router.navigate(`/ontology/model/object-types/${customer.rid}/history`);
  expect(await screen.findByText(/当前生效定义.*later page unavailable/)).toBeVisible();
  expect(screen.queryByText('当前生效')).toBeNull();
});
it('offers mobile resource access before the canvas and opens the same resource with Shift+Enter', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  const router = mount(`/ontology/model/graph?typeRef=${customer.rid}&q=客户`);
  await screen.findByRole('button', { name: '选择模型 客户' });
  expect(screen.getByRole('button', { name: '资源树' })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByRole('button', { name: '属性检查器' })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('complementary', { name: '资源属性' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '属性检查器' }));
  expect(screen.getByRole('complementary', { name: '资源属性' })).toHaveTextContent(customer.rid);
  fireEvent.click(screen.getByRole('button', { name: '资源树' }));
  fireEvent.keyDown(screen.getByRole('button', { name: '选择资源 客户' }), { key: 'Enter', shiftKey: true });
  expect(await screen.findByRole('heading', { name: '客户' })).toBeVisible();
  const returnTo = new URL(new URLSearchParams(router.state.location.search).get('returnTo')!, 'https://boundary.test');
  expect(returnTo.pathname).toBe('/ontology/model/graph');
  expect(returnTo.searchParams.get('typeRef')).toBe(customer.rid);
  expect(returnTo.searchParams.get('q')).toBe('客户');
  expect(screen.getByRole('button', { name: '切换对象资源' })).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(screen.getByRole('button', { name: '切换对象资源' }));
  expect(screen.getByRole('complementary', { name: '对象资源' })).toBeVisible();
  expect(api.createObjectType).not.toHaveBeenCalled();
});
it('does not label a failed relationship read as an empty selected model', async () => {
  vi.mocked(api.listLinkTypes).mockRejectedValueOnce(new Error('links unavailable'));
  mount(`/ontology/model/graph?typeRef=${customer.rid}`);
  expect(await screen.findByRole('alert')).toHaveTextContent('links unavailable');
  const inspector = screen.getByRole('complementary', { name: '资源属性' });
  expect(inspector).toHaveTextContent('关系读取未完成');
  expect(inspector).not.toHaveTextContent('关联模型 · 0');
});
