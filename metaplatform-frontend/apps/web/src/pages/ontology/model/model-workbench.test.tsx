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
