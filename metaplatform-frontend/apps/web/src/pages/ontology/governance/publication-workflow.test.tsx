import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  act,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Link } from 'react-router-dom';
import { AxiosError, type AxiosRequestConfig } from 'axios';
import SchemaWipCard from '../components/SchemaWipCard';
import ReleasesPage from './releases/ReleasesPage';
const http = vi.hoisted(() => ({
  handler: undefined as unknown as (c: AxiosRequestConfig) => Promise<unknown>,
  requests: [] as AxiosRequestConfig[],
  user: { id: 'reviewer', tenantId: 'tenant' },
}));
vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({
    fillRect() {},
    clearRect() {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
vi.mock('@/api/client', async () => {
  const { default: axios } = await import('axios');
  return {
    apiClient: axios.create({
      adapter: async (c) => {
        http.requests.push(c);
        return {
          data: await http.handler(c),
          status: 200,
          statusText: 'OK',
          headers: {},
          config: c,
        };
      },
    }),
  };
});
vi.mock('@mate/shared', () => ({ toast: vi.fn(), useAuth: () => ({ user: http.user }) }));
vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({ resolvedTheme: 'light' }),
}));
const rid = 'ont.tenant.obj.crm.customer.v1';
const other = 'ont.tenant.obj.crm.order.v1';
const payload = {
  rid,
  display_name: '新客户',
  primary_key: [],
  properties: [],
  interfaces: [],
};
const wip = {
  rid,
  author: 'author',
  payload,
  base_checksum: 'stored-base',
  created_at: '2026-10-09',
};
const live = { ...payload, display_name: '原客户', checksum: 'fresh-live' };
const valid = {
  rid,
  valid: true,
  errors: [],
  warnings: [],
  destructive: [],
  references: { resolved: [], unresolved: ['warning'], dependencies: [] },
};
const assessment = {
  baseline_rid: rid,
  target_rid: rid,
  from_checksum: 'base',
  to_checksum: 'draft-target',
  changes: [],
  counts: { instances_affected: 3 },
  warnings: [],
  plan: {
    class_rid: rid,
    from_checksum: 'base',
    renames: {},
    coercions: [],
    pk_rederive: null,
    drops: { policy: 'preserve', props: [] },
    reattach: null,
    warnings: [],
  },
};
function fail(status: number, detail: unknown): never {
  throw new AxiosError('request failed', undefined, undefined, undefined, {
    status,
    statusText: 'error',
    data: { detail },
    headers: {},
    config: {} as never,
  });
}
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
it.each(['apply', 'discard'])('keeps standalone %s owned through refresh, selection and actual settlement', async (command) => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  const late = deferred<unknown>();
  const handler = http.handler;
  http.handler = (c) => c.url?.endsWith(command === 'apply' ? '/apply' : `wip/${rid}`) && c.method !== 'get'
    ? late.promise
    : c.url === '/ont/v2/object-types/wip'
      ? Promise.resolve([wip, { ...wip, rid: other, payload: { ...payload, rid: other } }])
      : handler(c);
  mountCard();
  await check();
  fireEvent.click(screen.getByRole('button', { name: command === 'apply' ? '确认发布' : '丢弃' }));
  await waitFor(() => expect(http.requests.some((c) => command === 'apply' ? c.url?.endsWith('/apply') : c.method === 'delete')).toBe(true));
  const reads = http.requests.length;
  fireEvent.click(screen.getByRole('button', { name: '刷新草稿' }));
  fireEvent.change(screen.getByRole('combobox', { name: '目标草稿' }), { target: { value: other } });
  fireEvent.click(screen.getByRole('button', { name: '校验草稿' }));
  fireEvent.click(screen.getByRole('button', { name: '确认发布' }));
  fireEvent.click(screen.getByRole('button', { name: '丢弃' }));
  expect(http.requests).toHaveLength(reads);
  expect(screen.getByRole('combobox', { name: '目标草稿' })).toHaveValue(rid);
  expect(await screen.findByRole('button', { name: '校验草稿' })).toBeDisabled();
  await act(async () => late.resolve(command === 'apply' ? live : undefined));
  if (command === 'apply') await screen.findByText(/发布成功/);
  await waitFor(() => expect(screen.getByRole('button', { name: '刷新草稿' })).toBeEnabled());
  confirm.mockRestore();
});
it.each(['apply', 'discard'])('embedded %s blocks branch, rollback and migration, and unlocks after server failure', async (command) => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  const late = deferred<unknown>();
  const handler = http.handler;
  http.handler = async (c) => {
    if ((command === 'apply' && c.url?.endsWith('/apply')) || (command === 'discard' && c.method === 'delete')) {
      await late.promise;
      return fail(409, 'owned command refused');
    }
    if (c.url?.endsWith('/migration/assess')) return {
      ...assessment,
      counts: { ...assessment.counts, pk_missing: 1 },
      plan: { ...assessment.plan, drops: { policy: 'preserve', props: ['removed-prop'] }, pk_rederive: { old_pk: [], new_pk: ['id'], on_missing: 'abort' } },
    };
    return handler(c);
  };
  render(<MemoryRouter initialEntries={[`/?typeRef=${rid}`]}><ReleasesPage /></MemoryRouter>);
  await waitFor(() => expect(screen.getByRole('button', { name: '发布新版本' })).toBeEnabled());
  fireEvent.change(screen.getByRole('combobox', { name: '恢复模型快照' }), { target: { value: 'ont.tenant.ver.customer.v1' } });
  fireEvent.click(screen.getByRole('button', { name: '评估影响' }));
  await screen.findByRole('button', { name: '执行迁移' });
  await check();
  // Keep competing events in one render batch: the ref lock must precede disabling UI.
  act(() => {
    fireEvent.click(screen.getByRole('button', { name: command === 'apply' ? '确认发布' : '丢弃' }));
    for (const name of ['发布新版本', '回滚', '执行迁移']) {
      fireEvent.click(screen.getByRole('button', { name }));
    }
  });
  await waitFor(() => expect(http.requests.some((c) => command === 'apply' ? c.url?.endsWith('/apply') : c.method === 'delete')).toBe(true));
  fireEvent.change(screen.getByRole('combobox', { name: '无后继属性处置' }), { target: { value: 'drop' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'PK 缺失实例' }), { target: { value: 'skip' } });
  for (const name of ['发布新版本', '回滚', '执行迁移']) {
    const button = screen.getByRole('button', { name });
    expect(button).toBeDisabled();
    fireEvent.click(button);
  }
  expect(http.requests.some((c) => /\/(branch|rollback|migration\/run)$/.test(c.url || ''))).toBe(false);
  await act(async () => late.resolve(undefined));
  await screen.findByText(/409.*owned command refused/);
  expect(screen.getByRole('button', { name: '发布新版本' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '校验草稿' })).toBeEnabled();
  expect(screen.getByRole('combobox', { name: '恢复模型快照' })).toHaveValue('ont.tenant.ver.customer.v1');
  expect(screen.getByRole('combobox', { name: '无后继属性处置' })).toHaveValue('preserve');
  expect(screen.getByRole('combobox', { name: 'PK 缺失实例' })).toHaveValue('abort');
  confirm.mockRestore();
});
it('parent branch keeps child writes blocked through failure and then permits publication', async () => {
  const late = deferred<unknown>();
  const handler = http.handler;
  http.handler = async (c) => {
    if (c.url?.endsWith('/branch')) { await late.promise; return fail(409, 'branch refused'); }
    return handler(c);
  };
  render(<MemoryRouter initialEntries={[`/?typeRef=${rid}`]}><ReleasesPage /></MemoryRouter>);
  await check();
  await waitFor(() => expect(screen.getByRole('button', { name: '发布新版本' })).toBeEnabled());
  act(() => {
    fireEvent.click(screen.getByRole('button', { name: '发布新版本' }));
    fireEvent.click(screen.getByRole('button', { name: '确认发布' }));
    fireEvent.click(screen.getByRole('button', { name: '丢弃' }));
  });
  expect(screen.getByRole('button', { name: '确认发布' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '确认发布' }));
  fireEvent.click(screen.getByRole('button', { name: '丢弃' }));
  expect(http.requests.some((c) => c.url?.endsWith('/apply') || c.method === 'delete')).toBe(false);
  await act(async () => late.resolve(undefined));
  await screen.findByText(/409.*branch refused/);
  expect(screen.getByRole('button', { name: '确认发布' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '确认发布' }));
  await screen.findByText(/发布成功：原客户/);
});
beforeEach(() => {
  http.user = { id: 'reviewer', tenantId: 'tenant' };
  http.requests = [];
  http.handler = async (c) => {
    const url = c.url!;
    if (url === '/ont/v2/object-types/wip') return [wip];
    if (url === '/ont/v2/object-types')
      return [live, { ...live, rid: other, display_name: '订单' }];
    if (url.endsWith('/validate')) return valid;
    if (url.endsWith('/migration/assess')) return assessment;
    if (url.endsWith('/migration/runs')) return [];
    if (url.includes('/versions/'))
      return [
        {
          rid: 'ont.tenant.ver.customer.v1',
          class_ref: rid,
          version_no: 1,
          checksum: 'fresh-live',
          status: 'published',
          author: 'author',
          created_at: '2026-10-09',
          definition: live,
          dependencies: [],
          change_set: ['真实快照'],
        },
      ];
    if (url.endsWith('/apply')) return live;
    return { ...live, rid: url.endsWith(other) ? other : rid };
  };
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
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  }));
});
it('identity changes suppress the old command outcome while retaining ownership until failure settles', async () => {
  const late = deferred<unknown>();
  const handler = http.handler;
  http.handler = async (c) => {
    if (c.url?.endsWith('/apply')) { await late.promise; return fail(409, 'previous identity refused'); }
    return handler(c);
  };
  const view = mountCard();
  await check();
  fireEvent.click(screen.getByRole('button', { name: '确认发布' }));
  await waitFor(() => expect(http.requests.some((c) => c.url?.endsWith('/apply'))).toBe(true));
  http.user = { id: 'new-reviewer', tenantId: 'tenant' };
  view.rerender(<MemoryRouter><SchemaWipCard /></MemoryRouter>);
  expect(await screen.findByRole('button', { name: '校验草稿' })).toBeDisabled();
  await act(async () => late.resolve(undefined));
  expect(screen.queryByText(/previous identity refused/)).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: '校验草稿' })).toBeEnabled());
  expect(screen.getByRole('button', { name: '确认发布' })).toBeDisabled();
  await check();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function mountCard() {
  return render(
    <MemoryRouter>
      <SchemaWipCard />
    </MemoryRouter>,
  );
}
async function check() {
  fireEvent.click(await screen.findByRole('button', { name: '校验草稿' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '确认发布' })).toBeEnabled(),
  );
}
it('requires actual draft validation and impact before apply and preserves stored baseline', async () => {
  mountCard();
  expect(
    await screen.findByRole('button', { name: '确认发布' }),
  ).toBeDisabled();
  await check();
  fireEvent.click(screen.getByRole('button', { name: '确认发布' }));
  await screen.findByText(/发布成功/);
  const request = http.requests.find((c) => c.url?.endsWith('/apply'))!;
  expect(request.params?.expected_checksum).toBeUndefined();
  expect(http.requests.find((c) => c.url?.endsWith('/validate'))?.data).toBe(
    JSON.stringify(payload),
  );
});
it('refresh of an edited draft invalidates validation and ignores delayed old impact', async () => {
  const delayed = deferred<unknown>();
  const handler = http.handler;
  http.handler = (c) =>
    c.url?.endsWith('/migration/assess') ? delayed.promise : handler(c);
  mountCard();
  fireEvent.click(await screen.findByRole('button', { name: '校验草稿' }));
  await waitFor(() =>
    expect(
      http.requests.some((c) => c.url?.endsWith('/migration/assess')),
    ).toBe(true),
  );
  http.handler = (c) =>
    c.url === '/ont/v2/object-types/wip'
      ? Promise.resolve([
          { ...wip, payload: { ...payload, description: 'edited' } },
        ])
      : handler(c);
  fireEvent.click(screen.getByRole('button', { name: '刷新草稿' }));
  await act(async () => delayed.resolve(assessment));
  expect(screen.getByRole('button', { name: '确认发布' })).toBeDisabled();
  expect(screen.queryByText(/受影响实例 3/)).not.toBeInTheDocument();
});
it.each([403, 409, 422])(
  'preserves draft on actual %s apply response',
  async (status) => {
    const handler = http.handler;
    http.handler = async (c) =>
      c.url?.endsWith('/apply') ? fail(status, 'server refused') : handler(c);
    mountCard();
    await check();
    fireEvent.click(screen.getByRole('button', { name: '确认发布' }));
    await screen.findByText(new RegExp(`${status}.*server refused`));
    expect(screen.getByRole('heading', { name: '新客户' })).toBeInTheDocument();
    expect(screen.queryByText(/发布成功/)).not.toBeInTheDocument();
  },
);
it('uses server confirm_with for rename destructive confirmation', async () => {
  const handler = http.handler;
  http.handler = async (c) =>
    c.url?.endsWith('/apply') && !c.params?.confirm_name
      ? fail(409, {
          error: 'destructive_confirm_required',
          changes: ['removed'],
          confirm_with: '原客户',
        })
      : handler(c);
  mountCard();
  await check();
  fireEvent.click(screen.getByRole('button', { name: '确认发布' }));
  fireEvent.change(await screen.findByPlaceholderText('输入 原客户 以确认'), {
    target: { value: '原客户' },
  });
  fireEvent.click(screen.getByRole('button', { name: '重发（确认）' }));
  await screen.findByText(/发布成功/);
  expect(
    http.requests.filter((c) => c.url?.endsWith('/apply')).at(-1)?.params,
  ).toEqual({ confirm_name: '原客户' });
});
it('shows impact failure and does not assume a new type after failed read', async () => {
  const handler = http.handler;
  http.handler = async (c) =>
    c.url === '/ont/v2/object-types' ? fail(403, 'read forbidden') : handler(c);
  mountCard();
  fireEvent.click(await screen.findByRole('button', { name: '校验草稿' }));
  await screen.findByText(/403.*read forbidden/);
  expect(screen.getByRole('button', { name: '确认发布' })).toBeDisabled();
  expect(screen.queryByText(/新类型.*无存量/)).not.toBeInTheDocument();
});
it('only verifies no instance target from a successful complete active-type read', async () => {
  const handler = http.handler;
  http.handler = async (c) =>
    c.url === '/ont/v2/object-types'
      ? []
      : c.url === `/ont/v2/object-types/${rid}`
        ? fail(404, 'missing')
        : handler(c);
  mountCard();
  await check();
  expect(screen.getByText(/新类型.*无存量/)).toBeInTheDocument();
  expect(http.requests.some((c) => c.url?.endsWith('/migration/assess'))).toBe(
    false,
  );
});
it('release history reuses immutable snapshot and ignores old type response after switch', async () => {
  const delayed = deferred<unknown>();
  const handler = http.handler;
  http.handler = (c) =>
    c.url === `/ont/v2/object-types/${rid}` ? delayed.promise : handler(c);
  render(
    <MemoryRouter>
      <ReleasesPage />
    </MemoryRouter>,
  );
  const select = await screen.findByRole('combobox', { name: '目标类型' });
  await waitFor(() =>
    expect(
      http.requests.some((c) => c.url === `/ont/v2/object-types/${rid}`),
    ).toBe(true),
  );
  fireEvent.change(select, { target: { value: other } });
  await screen.findAllByText('当前生效');
  await act(async () => delayed.resolve({ ...live, display_name: '陈旧响应' }));
  expect(screen.queryByText(/陈旧响应/)).not.toBeInTheDocument();
  await screen.findByText('真实快照');
});
it('external resource navigation hides old validation and late successful apply', async () => {
  const late = deferred<unknown>();
  const handler = http.handler;
  http.handler = (c) =>
    c.url === '/ont/v2/object-types/wip'
      ? Promise.resolve([
          wip,
          {
            ...wip,
            rid: other,
            payload: { ...payload, rid: other, display_name: '订单草稿' },
          },
        ])
      : c.url?.endsWith('/apply')
        ? late.promise
        : handler(c);
  render(<MemoryRouter initialEntries={[`/?typeRef=${rid}`]}><Link to={`/?typeRef=${other}`}>外部资源导航</Link><SchemaWipCard /></MemoryRouter>);
  await check();
  fireEvent.click(screen.getByRole('button', { name: '确认发布' }));
  await waitFor(() => expect(http.requests.some((c) => c.url?.endsWith('/apply'))).toBe(true));
  fireEvent.click(screen.getByRole('link', { name: '外部资源导航' }));
  await act(async () => late.resolve(live));
  expect(screen.getByRole('button', { name: '确认发布' })).toBeDisabled();
  expect(screen.queryByText(/发布成功/)).not.toBeInTheDocument();
  expect(screen.queryByText('定义校验：通过')).not.toBeInTheDocument();
});
it('retry invalidates the earlier successful preflight while new validation is pending', async () => {
  mountCard();
  await check();
  const late = deferred<unknown>();
  const handler = http.handler;
  http.handler = (c) =>
    c.url?.endsWith('/validate') ? late.promise : handler(c);
  fireEvent.click(screen.getByRole('button', { name: '校验草稿' }));
  expect(screen.getByRole('button', { name: '确认发布' })).toBeDisabled();
  await act(async () =>
    late.resolve({ ...valid, valid: false, errors: ['invalid revised model'] }),
  );
  expect(screen.getByText(/invalid revised model/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '确认发布' })).toBeDisabled();
});
it('reports impact 422 without losing independent valid preflight', async () => {
  const handler = http.handler;
  http.handler = async (c) =>
    c.url?.endsWith('/migration/assess')
      ? fail(422, 'impact unavailable')
      : handler(c);
  mountCard();
  fireEvent.click(await screen.findByRole('button', { name: '校验草稿' }));
  await screen.findByText(/422.*impact unavailable/);
  expect(screen.getByText('定义校验：通过')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '确认发布' })).toBeDisabled();
});
it('treats archived readable type as an instance target even when no active family remains', async () => {
  const handler = http.handler;
  http.handler = (c) =>
    c.url === '/ont/v2/object-types' ? Promise.resolve([]) : handler(c);
  mountCard();
  await check();
  expect(screen.queryByText(/新类型.*无存量/)).not.toBeInTheDocument();
  expect(screen.getByText(/受影响实例 3/)).toBeInTheDocument();
});
it('draft read failure preserves explicit context without false empty state', async () => {
  http.handler = async () => fail(403, 'draft forbidden');
  render(
    <MemoryRouter
      initialEntries={[
        `/?typeRef=${other}&changeRef=real-change&returnTo=%2Fontology%2Fmodel`,
      ]}
    >
      <SchemaWipCard />
    </MemoryRouter>,
  );
  await screen.findByText(/403.*draft forbidden/);
  expect(
    screen.queryByText('当前没有待发布的 Schema WIP'),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: '返回模型' })).toHaveAttribute(
    'href',
    '/ontology/model',
  );
});
it('different-family copy reports source retained and advanced RID request remains real', async () => {
  const handler = http.handler;
  http.handler = async (c) =>
    c.url?.endsWith('/branch')
      ? { ...live, rid: 'ont.tenant.obj.crm.customer-copy.v1' }
      : handler(c);
  render(
    <MemoryRouter>
      <ReleasesPage />
    </MemoryRouter>,
  );
  const button = await screen.findByRole('button', { name: '发布新版本' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.change(screen.getByRole('combobox', { name: '发布方式' }), {
    target: { value: 'copy' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: '副本机器名' }), {
    target: { value: 'customer-copy' },
  });
  fireEvent.click(screen.getByRole('button', { name: '创建独立副本' }));
  await screen.findByText(/独立副本已创建，源类型.*保留/);
  expect(http.requests.find((c) => c.url?.endsWith('/branch'))?.data).toBe(
    JSON.stringify({
      new_rid: 'ont.tenant.obj.crm.customer-copy.v1',
      note: '',
    }),
  );
  expect(screen.queryByText(/原.*已下线/)).not.toBeInTheDocument();
});
it('editing diff input invalidates late result instead of displaying an old pair', async () => {
  const late = deferred<unknown>();
  const handler = http.handler;
  http.handler = (c) => (c.url?.endsWith('/diff') ? late.promise : handler(c));
  render(
    <MemoryRouter>
      <ReleasesPage />
    </MemoryRouter>,
  );
  const against = await screen.findByPlaceholderText('对比 rid（against）');
  fireEvent.change(against, {
    target: { value: 'ont.tenant.ver.customer.v1' },
  });
  fireEvent.click(screen.getByRole('button', { name: '对比差异' }));
  await waitFor(() =>
    expect(http.requests.some((c) => c.url?.endsWith('/diff'))).toBe(true),
  );
  fireEvent.change(against, {
    target: { value: 'ont.tenant.ver.customer.v2' },
  });
  await act(async () =>
    late.resolve({ has_changes: true, added: ['old-pair-change'] }),
  );
  expect(screen.queryByText('old-pair-change')).not.toBeInTheDocument();
});
it('retry of migration assessment disables execution while new response is pending', async () => {
  render(
    <MemoryRouter>
      <ReleasesPage />
    </MemoryRouter>,
  );
  const assess = await screen.findByRole('button', { name: '评估影响' });
  await waitFor(() => expect(assess).toBeEnabled());
  fireEvent.click(assess);
  await screen.findByRole('button', { name: '执行迁移' });
  const late = deferred<unknown>();
  const handler = http.handler;
  http.handler = (c) =>
    c.url?.endsWith('/migration/assess') ? late.promise : handler(c);
  fireEvent.click(screen.getByRole('button', { name: '评估影响' }));
  expect(
    screen.queryByRole('button', { name: '执行迁移' }),
  ).not.toBeInTheDocument();
  await act(async () => late.resolve(assessment));
  expect(screen.getByRole('button', { name: '执行迁移' })).toBeEnabled();
});
it('suggests the next object RID from snapshot definition RID facts rather than snapshot version number', async () => {
  const late = deferred<unknown>();
  const handler = http.handler;
  http.handler = (c) =>
    c.url?.includes('/versions/') ? late.promise : handler(c);
  render(
    <MemoryRouter>
      <ReleasesPage />
    </MemoryRouter>,
  );
  await waitFor(() =>
    expect(screen.getAllByText('当前生效').length).toBeGreaterThan(0),
  );
  await act(async () =>
    late.resolve([
      {
        rid: 'ont.tenant.ver.customer.v44',
        class_ref: rid,
        definition: { ...live, rid: 'ont.tenant.obj.crm.customer.v7' },
        version_no: 44,
        checksum: 'old',
        status: 'published',
        author: 'a',
        created_at: '2026-10-09',
        dependencies: [],
        change_set: [],
      },
    ]),
  );
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: '高级新版本 RID' })).toHaveValue(
      'ont.tenant.obj.crm.customer.v8',
    ),
  );
});
it('selected snapshot rollback posts immutable RID with explicit model-only confirmation', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  const handler = http.handler;
  http.handler = (c) =>
    c.url?.endsWith('/rollback') ? Promise.resolve(live) : handler(c);
  render(
    <MemoryRouter>
      <ReleasesPage />
    </MemoryRouter>,
  );
  await waitFor(() =>
    expect(
      screen
        .getByRole('combobox', { name: '恢复模型快照' })
        .querySelectorAll('option'),
    ).toHaveLength(2),
  );
  fireEvent.change(screen.getByRole('combobox', { name: '恢复模型快照' }), {
    target: { value: 'ont.tenant.ver.customer.v1' },
  });
  fireEvent.click(screen.getByRole('button', { name: '回滚' }));
  await screen.findByText(/回滚成功/);
  expect(http.requests.find((c) => c.url?.endsWith('/rollback'))?.data).toBe(
    '{"from_rid":"ont.tenant.ver.customer.v1"}',
  );
  expect(confirm.mock.calls[0][0]).toContain('只回滚模型定义');
  confirm.mockRestore();
});
it('release page starts the selected draft in the same gated publication steps', async () => {
  render(
    <MemoryRouter initialEntries={[`/?typeRef=${rid}`]}>
      <ReleasesPage />
    </MemoryRouter>,
  );
  expect(
    await screen.findByRole('button', { name: '确认发布' }),
  ).toBeDisabled();
  expect(screen.getByRole('list', { name: '发布步骤' })).toBeInTheDocument();
});
it('refresh clears snapshot-derived choices while failed current history remains unavailable', async () => {
  const handler = http.handler;
  render(
    <MemoryRouter>
      <ReleasesPage />
    </MemoryRouter>,
  );
  await waitFor(() =>
    expect(
      screen
        .getByRole('combobox', { name: '恢复模型快照' })
        .querySelectorAll('option'),
    ).toHaveLength(2),
  );
  http.handler = async (c) =>
    c.url?.includes('/versions/') ? fail(403, 'history forbidden') : handler(c);
  fireEvent.click(screen.getByRole('button', { name: '刷新' }));
  await screen.findByText(/403.*history forbidden/);
  expect(
    screen
      .getByRole('combobox', { name: '恢复模型快照' })
      .querySelectorAll('option'),
  ).toHaveLength(1);
  expect(screen.getByRole('textbox', { name: '高级新版本 RID' })).toHaveValue(
    '',
  );
});
it('rechecks stored WIP revision before apply and requires validation after another editor saved', async () => {
  mountCard();
  await check();
  const handler = http.handler;
  http.handler = (c) =>
    c.url === '/ont/v2/object-types/wip'
      ? Promise.resolve([
          { ...wip, payload: { ...payload, description: 'saved elsewhere' } },
        ])
      : handler(c);
  fireEvent.click(screen.getByRole('button', { name: '确认发布' }));
  await screen.findByText(/草稿已变化.*重新校验/);
  expect(http.requests.some((c) => c.url?.endsWith('/apply'))).toBe(false);
  expect(screen.getByRole('button', { name: '确认发布' })).toBeDisabled();
});
it('keeps delayed migration serialized through unrelated input and snapshot interactions and shows its real result', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  const late = deferred<unknown>();
  const handler = http.handler;
  http.handler = (c) =>
    c.url?.endsWith('/migration/run') ? late.promise : handler(c);
  render(
    <MemoryRouter>
      <ReleasesPage />
    </MemoryRouter>,
  );
  const assess = await screen.findByRole('button', { name: '评估影响' });
  await waitFor(() => expect(assess).toBeEnabled());
  fireEvent.click(assess);
  fireEvent.click(await screen.findByRole('button', { name: '执行迁移' }));
  await waitFor(() =>
    expect(
      http.requests.filter((c) => c.url?.endsWith('/migration/run')),
    ).toHaveLength(1),
  );

  fireEvent.change(screen.getByPlaceholderText('对比 rid（against）'), {
    target: { value: 'unrelated-diff' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: '高级新版本 RID' }), {
    target: { value: 'ont.tenant.obj.crm.customer.v9' },
  });
  fireEvent.click(screen.getByRole('button', { name: '设为对比' }));
  const pending = screen.getByRole('button', { name: /迁移中|执行迁移/ });
  expect(pending).toBeDisabled();
  fireEvent.click(pending);
  fireEvent.click(screen.getByRole('button', { name: '发布新版本' }));
  expect(
    http.requests.filter((c) => c.url?.endsWith('/migration/run')),
  ).toHaveLength(1);
  expect(http.requests.some((c) => c.url?.endsWith('/branch'))).toBe(false);
  expect(
    http.requests.find((c) => c.url?.endsWith('/migration/run'))?.headers?.[
      'Idempotency-Key'
    ],
  ).toBeTruthy();

  await act(async () =>
    late.resolve({ run_id: 'actual-run-1', counts: { reattached: 3 } }),
  );
  await screen.findByText(/迁移完成（run actual-run-1）/);
  expect(
    screen.queryByRole('button', { name: '执行迁移' }),
  ).not.toBeInTheDocument();
  expect(screen.getByPlaceholderText('对比 rid（against）')).toBeEnabled();
  confirm.mockRestore();
});
