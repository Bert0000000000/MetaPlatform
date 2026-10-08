import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '@/api/client';
import type {
  KernelBackingDatasource,
  KernelObjectType,
} from '@/api/ont/kernel';
import { setEditorSessionIdentity } from '../../hooks/editorSession';
import BackingDatasourcePanel from './BackingDatasourcePanel';

const auth = vi.hoisted(() => ({
  user: { id: 'mapping-editor', tenantId: 't' },
  listeners: new Set<() => void>(),
}));
vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({
    fillRect() {},
    clearRect() {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
vi.mock('@mate/shared', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useAuth: () => ({
      user: useSyncExternalStore(
        (listener) => {
          auth.listeners.add(listener);
          return () => {
            auth.listeners.delete(listener);
          };
        },
        () => auth.user,
      ),
    }),
    toast: vi.fn(),
  };
});
vi.mock('@/utils/auth', () => ({
  getToken: () => '',
  getRefreshToken: () => '',
  removeToken: vi.fn(),
  setToken: vi.fn(),
  setRefreshToken: vi.fn(),
}));
vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({ resolvedTheme: 'light' }),
}));
const a: KernelObjectType = {
  rid: 'ont.t.obj.crm.customer.v1',
  display_name: '客户',
  primary_key: ['ont.t.prop.crm.customer-id.v1'],
  interfaces: [],
  properties: [
    {
      rid: 'ont.t.prop.crm.customer-id.v1',
      title: '客户编号',
      type_id: 'STRING',
      format: 'string',
      primary_key: true,
      nullable: false,
    },
    {
      rid: 'ont.t.prop.crm.customer-name.v1',
      title: '客户名称',
      type_id: 'STRING',
      format: 'string',
      primary_key: false,
      nullable: false,
    },
    {
      rid: 'ont.t.prop.crm.customer-note.v1',
      title: '备注',
      type_id: 'STRING',
      format: 'string',
      primary_key: false,
      nullable: true,
    },
  ],
};
const b: KernelObjectType = {
  ...a,
  rid: 'ont.t.obj.crm.order.v1',
  display_name: '订单',
};
const source = (rid = a.rid, name = 'crm'): KernelBackingDatasource => ({
  rid: `ont.t.bds.${name}`,
  class_rid: rid,
  name,
  kind: 'pg_table',
  dsn_env: 'ONT_CRM_DSN',
  table_name: 'public.customer',
  pk_column: 'customer_id',
  priority: 100,
  field_mapping: {
    [a.properties[0].rid]: 'customer_id',
    [a.properties[1].rid]: 'legal_name',
  },
  ts_column: 'updated_at',
  last_synced_at: '2026-10-08T01:00:00Z',
});
type Request = {
  method: string;
  url: string;
  body: Record<string, unknown>;
  incremental?: boolean;
};
let requests: Request[];
let types: KernelObjectType[];
let bindings: Record<string, KernelBackingDatasource[]>;
let rejectSave: boolean;
let failSamples: boolean;
let failBindings: boolean;
let syncResult: Record<string, unknown>;
let pendingA: (() => Promise<unknown>) | undefined;
let pendingSave: (() => Promise<void>) | undefined;
let pendingSync: (() => Promise<void>) | undefined;
let failReadback: boolean;
const originalAdapter = apiClient.defaults.adapter;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
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
  setEditorSessionIdentity('');
  auth.user = { id: 'mapping-editor', tenantId: 't' };
  requests = [];
  types = [a, b];
  bindings = { [a.rid]: [source()], [b.rid]: [] };
  rejectSave = failSamples = failBindings = failReadback = false;
  pendingA = undefined;
  pendingSave = undefined;
  pendingSync = undefined;
  syncResult = {
    ok: false,
    total_synced: 7,
    total_failed: 1,
    total_deleted: 2,
    sources: {
      crm: {
        synced: 7,
        failed: 1,
        deleted: 2,
        failures: [{ pk: 'c8', error: 'invalid customer' }],
        cursor: { ts: '2026-10-08T02:00:00Z', pk: 'c7' },
      },
    },
  };
  apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const url = config.url || '';
    const method = config.method || 'get';
    const body =
      typeof config.data === 'string'
        ? JSON.parse(config.data)
        : config.data || {};
    requests.push({
      method,
      url,
      body,
      incremental: config.params?.incremental,
    });
    let data: unknown;
    const rid = decodeURIComponent(
      url.split('/object-types/')[1]?.split('/')[0] || '',
    );
    const forbidden = (detail: string) => {
      throw new AxiosError(detail, 'ERR_BAD_REQUEST', config, undefined, {
        config,
        status: 403,
        statusText: 'Forbidden',
        headers: {},
        data: { detail },
      });
    };
    if (url.endsWith('/object-types'))
      data = types.slice(
        Number(config.params?.offset || 0),
        Number(config.params?.offset || 0) + 100,
      );
    else if (url.endsWith('/materialization')) {
      if (failSamples) forbidden('sample denied');
      data = {
        class_rid: rid,
        count: 1,
        generated_at: '2026-10-08T03:00:00Z',
        schema: {
          customer_id: { type: 'string' },
          legal_name: { type: 'string' },
        },
        rows: [{ customer_id: 'c7', legal_name: '真实物化客户' }],
      };
    } else if (url.endsWith('/datasources/sync')) {
      if (pendingSync) await pendingSync();
      data = syncResult;
    } else if (url.endsWith('/datasources') && method === 'post') {
      if (rejectSave) forbidden('write denied');
      if (pendingSave) await pendingSave();
      const saved = {
        ...source(rid, String(body.name)),
        dsn_env: String(body.dsn_env),
        table_name: String(body.table),
        pk_column: String(body.pk_column),
        priority: Number(body.priority),
        field_mapping: body.field_mapping as Record<string, string>,
      };
      bindings[rid] = [saved];
      data = { rid: saved.rid, name: saved.name };
      if (failReadback) failBindings = true;
    } else if (url.endsWith('/datasources')) {
      if (pendingA && rid === a.rid) data = await pendingA();
      else {
        if (failBindings) forbidden('binding denied');
        data = bindings[rid] || [];
      }
    } else throw new Error(`Unexpected HTTP ${method} ${url}`);
    return { config, status: 200, statusText: 'OK', headers: {}, data };
  };
});
afterEach(() => {
  cleanup();
  apiClient.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function mount(query = `typeRef=${a.rid}`) {
  const router = createMemoryRouter(
    [
      { path: '/ontology/data/mappings', element: <BackingDatasourcePanel /> },
      { path: '/elsewhere', element: <div>别页</div> },
    ],
    { initialEntries: [`/ontology/data/mappings?${query}`] },
  );
  render(<RouterProvider router={router} />);
  return router;
}
const writes = () => requests.filter((r) => r.method === 'post');
async function ready() {
  await screen.findAllByDisplayValue('legal_name');
}
it('reads saved full-RID mappings, saves exact DTO through the real HTTP client and reads back', async () => {
  mount();
  await ready();
  expect(screen.getByText('业务主键')).toBeInTheDocument();
  expect(screen.getByLabelText('连接环境键')).toHaveValue('ONT_CRM_DSN');
  expect(screen.getByText('updated_at')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('客户名称 来源列'), {
    target: { value: 'display_name' },
  });
  fireEvent.click(screen.getByRole('button', { name: '保存映射' }));
  await screen.findByText('映射已保存并回读');
  expect(writes()).toHaveLength(1);
  expect(writes()[0].body).toEqual({
    class_rid: a.rid,
    name: 'crm',
    kind: 'pg_table',
    dsn_env: 'ONT_CRM_DSN',
    table: 'public.customer',
    pk_column: 'customer_id',
    priority: 100,
    field_mapping: {
      [a.properties[0].rid]: 'customer_id',
      [a.properties[1].rid]: 'display_name',
    },
  });
  expect(writes()[0].body).not.toHaveProperty('ts_column');
  expect(
    requests.filter(
      (r) => r.url.endsWith('/datasources') && r.method === 'get',
    ),
  ).toHaveLength(2);
});
it('blocks blank required sources and duplicate targets before any external write', async () => {
  types = [{ ...a, properties: [...a.properties, a.properties[1]] }];
  mount();
  await ready();
  fireEvent.click(screen.getByRole('button', { name: '保存映射' }));
  expect(await screen.findByText(/重复目标属性/)).toBeInTheDocument();
  expect(writes()).toHaveLength(0);
});
it('keeps invalid input and prevents synchronization while dirty', async () => {
  mount();
  await ready();
  fireEvent.change(screen.getByLabelText('客户名称 来源列'), {
    target: { value: '' },
  });
  fireEvent.click(screen.getByRole('button', { name: '保存映射' }));
  expect(
    await screen.findByText(/客户名称.*来源列不能为空/),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: '全量同步全部来源' }),
  ).toBeDisabled();
  expect(writes()).toHaveLength(0);
});
it('preserves failed-save input and reports the real forbidden error', async () => {
  rejectSave = true;
  mount();
  await ready();
  fireEvent.change(screen.getByLabelText('客户名称 来源列'), {
    target: { value: 'kept_column' },
  });
  fireEvent.click(screen.getByRole('button', { name: '保存映射' }));
  expect(
    await screen.findByText(/forbidden.*403.*write denied/),
  ).toBeInTheDocument();
  expect(screen.getByLabelText('客户名称 来源列')).toHaveValue('kept_column');
});
it('renders separate real materialization with schema/time/count and retries without synchronization', async () => {
  failSamples = true;
  mount();
  await ready();
  expect(
    await screen.findByText(/forbidden.*403.*sample denied/),
  ).toBeInTheDocument();
  failSamples = false;
  fireEvent.click(screen.getByRole('button', { name: '读取物化样本' }));
  expect(await screen.findByText('真实物化客户')).toBeInTheDocument();
  expect(screen.getByText(/2026-10-08T03:00:00Z/)).toBeInTheDocument();
  expect(writes()).toHaveLength(0);
});
it('renders actual aggregate/per-source partial failure from HTTP 200, including failure and cursor', async () => {
  mount();
  await ready();
  fireEvent.click(screen.getByRole('button', { name: '增量同步全部来源' }));
  expect(
    await screen.findByText(/部分失败.*同步 7.*失败 1.*删除 2/),
  ).toBeInTheDocument();
  expect(screen.getByText(/c8.*invalid customer/)).toBeInTheDocument();
  expect(screen.getByText(/2026-10-08T02:00:00Z.*c7/)).toBeInTheDocument();
  expect(writes()[0].incremental).toBe(true);
});
it('retains type A input across guarded selection and route navigation without submitting A as B', async () => {
  const router = mount();
  await ready();
  fireEvent.change(screen.getByLabelText('客户名称 来源列'), {
    target: { value: 'unsaved_A' },
  });
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.change(screen.getByLabelText('对象类型'), {
    target: { value: b.rid },
  });
  expect(screen.getByLabelText('客户名称 来源列')).toHaveValue('unsaved_A');
  vi.mocked(window.confirm).mockReturnValue(true);
  fireEvent.change(screen.getByLabelText('对象类型'), {
    target: { value: b.rid },
  });
  await waitFor(() => expect(screen.getByLabelText('源名')).toHaveValue(''));
  expect(writes()).toHaveLength(0);
  await act(() => router.navigate(`/ontology/data/mappings?typeRef=${a.rid}`));
  await screen.findByDisplayValue('unsaved_A');
  await act(() => router.navigate('/elsewhere'));
  await act(() => router.navigate(`/ontology/data/mappings?typeRef=${a.rid}`));
  await screen.findByDisplayValue('unsaved_A');
  expect(writes()).toHaveLength(0);
});
it('does not replace unknown URL context with the first type and consumes later type pages', async () => {
  types = Array.from({ length: 100 }, (_, i) => ({
    ...a,
    rid: `ont.t.obj.page.item${i}.v1`,
  })).concat(b);
  const router = mount(
    `typeRef=${b.rid}&returnTo=%2Fontology%2Fmodel%2Fgraph%3Fq%3Dorders`,
  );
  await waitFor(() =>
    expect(screen.getByLabelText('对象类型')).toHaveValue(b.rid),
  );
  expect(screen.getByRole('link', { name: '返回原资源' })).toHaveAttribute(
    'href',
    '/ontology/model/graph?q=orders',
  );
  await act(() =>
    router.navigate('/ontology/data/mappings?typeRef=ont.t.obj.unknown.v1'),
  );
  expect(await screen.findByText(/请求的对象类型不可用/)).toBeInTheDocument();
  expect(screen.queryByLabelText('源名')).not.toBeInTheDocument();
  expect(writes()).toHaveLength(0);
});
it('ignores late binding reads after a type switch', async () => {
  let resolve!: (value: unknown) => void;
  pendingA = () =>
    new Promise((r) => {
      resolve = r;
    });
  const router = mount();
  await waitFor(() => expect(resolve).toBeDefined());
  await act(() => router.navigate(`/ontology/data/mappings?typeRef=${b.rid}`));
  await screen.findByLabelText('源名');
  await act(async () => {
    resolve([source()]);
  });
  expect(screen.getByLabelText('源名')).toHaveValue('');
  expect(screen.getByLabelText('对象类型')).toHaveValue(b.rid);
});
it('surfaces unexpected saved mapping fields and never silently drops them on save', async () => {
  bindings[a.rid][0].field_mapping['ont.t.prop.deleted.v1'] = 'legacy_column';
  mount();
  await ready();
  expect(screen.getByText(/ont.t.prop.deleted.v1/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '保存映射' }));
  expect(
    await screen.findByText(/存在不属于当前类型的映射/),
  ).toBeInTheDocument();
  expect(writes()).toHaveLength(0);
});
it('blocks custom-watermark binding save without losing input, while saved sync remains available after discard', async () => {
  bindings[a.rid][0].ts_column = 'changed_on';
  mount();
  await ready();
  expect(
    screen.getByText(/当前保存接口无法保留自定义水位列/),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '保存映射' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('客户名称 来源列'), {
    target: { value: 'kept_custom' },
  });
  fireEvent.click(screen.getByRole('button', { name: '保存映射' }));
  expect(screen.getByLabelText('客户名称 来源列')).toHaveValue('kept_custom');
  expect(
    screen.getByRole('button', { name: '全量同步全部来源' }),
  ).toBeDisabled();
  expect(writes()).toHaveLength(0);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: '丢弃未保存输入' }));
  await ready();
  fireEvent.click(screen.getByRole('button', { name: '全量同步全部来源' }));
  await screen.findByText(/部分失败/);
  expect(writes()).toHaveLength(1);
  expect(writes()[0].url).toContain('/datasources/sync');
});
it('cannot bypass custom-watermark protection by declaring a new source with the existing source name', async () => {
  bindings[a.rid][0].ts_column = 'changed_on';
  mount();
  await ready();
  fireEvent.click(screen.getByRole('button', { name: '声明新来源' }));
  await waitFor(() => expect(screen.getByLabelText('源名')).toHaveValue(''));
  for (const [label, value] of [
    ['源名', 'crm'],
    ['来源表', 'public.new_customer'],
    ['源主键列', 'id'],
    ['客户编号 来源列', 'id'],
    ['客户名称 来源列', 'legal_name'],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: '保存映射' }));
  expect(await screen.findByText(/源名已存在/)).toBeInTheDocument();
  expect(writes()).toHaveLength(0);
  fireEvent.change(screen.getByLabelText('源名'), {
    target: { value: 'crm_new' },
  });
  fireEvent.click(screen.getByRole('button', { name: '保存映射' }));
  await screen.findByText('映射已保存并回读');
  expect(writes()[0].body.name).toBe('crm_new');
  expect(writes()[0].body).not.toHaveProperty('ts_column');
});
it('preserves submitted fields when save succeeds but declaration readback fails, and blocks stale writes/sync', async () => {
  failReadback = true;
  mount();
  await ready();
  fireEvent.change(screen.getByLabelText('客户名称 来源列'), {
    target: { value: 'submitted_column' },
  });
  fireEvent.click(screen.getByRole('button', { name: '保存映射' }));
  await screen.findByText(/输入已保留.*保存已受理/);
  expect(screen.getByLabelText('客户名称 来源列')).toHaveValue(
    'submitted_column',
  );
  expect(screen.queryByText('映射已保存并回读')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '保存映射' })).toBeDisabled();
  expect(
    screen.getByRole('button', { name: '全量同步全部来源' }),
  ).toBeDisabled();
  failBindings = false;
  fireEvent.click(screen.getByRole('button', { name: '重载来源绑定' }));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: '重载来源绑定' }),
    ).not.toBeDisabled(),
  );
  expect(screen.getByLabelText('客户名称 来源列')).toHaveValue(
    'submitted_column',
  );
  expect(writes()).toHaveLength(1);
});
it('ignores late save completion after route/type replacement and restores the earlier unsaved resource', async () => {
  let resolve!: () => void;
  pendingSave = () =>
    new Promise((r) => {
      resolve = r;
    });
  const router = mount();
  await ready();
  fireEvent.change(screen.getByLabelText('客户名称 来源列'), {
    target: { value: 'pending_A' },
  });
  fireEvent.click(screen.getByRole('button', { name: '保存映射' }));
  await waitFor(() => expect(resolve).toBeDefined());
  expect(screen.getByLabelText('客户名称 来源列')).toBeDisabled();
  expect(screen.getByLabelText('对象类型')).toBeDisabled();
  await act(() => router.navigate(`/ontology/data/mappings?typeRef=${b.rid}`));
  await screen.findByLabelText('源名');
  await act(async () => resolve());
  expect(screen.getByLabelText('源名')).toHaveValue('');
  expect(screen.getByLabelText('对象类型')).toHaveValue(b.rid);
  expect(screen.queryByText('映射已保存并回读')).not.toBeInTheDocument();
  expect(
    requests.filter(
      (r) => r.method === 'get' && r.url.endsWith(`${a.rid}/datasources`),
    ),
  ).toHaveLength(1);
  await act(() => router.navigate(`/ontology/data/mappings?typeRef=${a.rid}`));
  await screen.findByDisplayValue('pending_A');
  expect(writes()).toHaveLength(1);
});
it('never shares mapping drafts with an incomplete or changed identity', async () => {
  const router = mount();
  await ready();
  fireEvent.change(screen.getByLabelText('客户名称 来源列'), {
    target: { value: 'private_draft' },
  });
  await act(() => {
    auth.user = { id: '', tenantId: 't' };
    auth.listeners.forEach((listener) => listener());
  });
  await act(() =>
    router.navigate(
      `/ontology/data/mappings?typeRef=${a.rid}&identity=missing`,
    ),
  );
  await ready();
  expect(screen.getByRole('button', { name: '保存映射' })).toBeDisabled();
  expect(
    screen.getByRole('button', { name: '全量同步全部来源' }),
  ).toBeDisabled();
  expect(screen.queryByDisplayValue('private_draft')).not.toBeInTheDocument();
  expect(screen.getByText(/身份或租户不可用/)).toBeInTheDocument();
  expect(writes()).toHaveLength(0);
});
it('does not announce or select an old source after its delayed save readback completes on another source', async () => {
  const second = source(a.rid, 'billing');
  bindings[a.rid].push(second);
  const router = mount();
  await ready();
  let resolve!: (value: unknown) => void;
  pendingA = () =>
    new Promise((r) => {
      resolve = r;
    });
  fireEvent.change(screen.getByLabelText('客户名称 来源列'), {
    target: { value: 'old_saved' },
  });
  fireEvent.click(screen.getByRole('button', { name: '保存映射' }));
  await waitFor(() => expect(resolve).toBeDefined());
  await act(() =>
    router.navigate(
      `/ontology/data/mappings?typeRef=${a.rid}&sourceRef=${second.rid}`,
    ),
  );
  await waitFor(() =>
    expect(screen.getByLabelText('源名')).toHaveValue('billing'),
  );
  await act(async () => resolve([source(), second]));
  expect(screen.queryByText('映射已保存并回读')).not.toBeInTheDocument();
  expect(screen.getByLabelText('源名')).toHaveValue('billing');
});
it('retains dirty source A while selecting source B and blocks whole-type sync until A is resolved', async () => {
  const second = source(a.rid, 'billing');
  bindings[a.rid].push(second);
  mount();
  await ready();
  fireEvent.change(screen.getByLabelText('客户名称 来源列'), {
    target: { value: 'source_A_draft' },
  });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.change(screen.getByLabelText('来源绑定'), {
    target: { value: second.rid },
  });
  await waitFor(() =>
    expect(screen.getByLabelText('源名')).toHaveValue('billing'),
  );
  expect(
    screen.getByRole('button', { name: '全量同步全部来源' }),
  ).toBeDisabled();
  expect(screen.getByText(/其他来源有未保存映射/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('来源绑定'), {
    target: { value: source().rid },
  });
  await screen.findByDisplayValue('source_A_draft');
  expect(writes()).toHaveLength(0);
});
it('locks mapping mutation while a saved-configuration sync request is executing', async () => {
  let resolve!: () => void;
  pendingSync = () =>
    new Promise((r) => {
      resolve = r;
    });
  mount();
  await ready();
  fireEvent.click(screen.getByRole('button', { name: '全量同步全部来源' }));
  await waitFor(() => expect(resolve).toBeDefined());
  expect(screen.getByRole('button', { name: '保存映射' })).toBeDisabled();
  expect(screen.getByLabelText('客户名称 来源列')).toBeDisabled();
  expect(screen.getByLabelText('对象类型')).toBeDisabled();
  await act(async () => resolve());
  await screen.findByText(/部分失败/);
});
it('preserves the latest same-resource URL return context across an in-flight save', async () => {
  let resolve!: () => void;
  pendingSave = () =>
    new Promise((r) => {
      resolve = r;
    });
  const router = mount();
  await ready();
  fireEvent.change(screen.getByLabelText('客户名称 来源列'), {
    target: { value: 'same_resource' },
  });
  fireEvent.click(screen.getByRole('button', { name: '保存映射' }));
  await waitFor(() => expect(resolve).toBeDefined());
  const returnTo = '/ontology/model/graph?view=list&q=kept';
  const next = new URLSearchParams({
    typeRef: a.rid,
    sourceRef: source().rid,
    returnTo,
    changeRef: 'real-change',
  });
  await act(() => router.navigate(`/ontology/data/mappings?${next}`));
  await act(async () => resolve());
  await screen.findByText('映射已保存并回读');
  const actual = new URLSearchParams(router.state.location.search);
  expect(actual.get('returnTo')).toBe(returnTo);
  expect(actual.get('changeRef')).toBe('real-change');
});
