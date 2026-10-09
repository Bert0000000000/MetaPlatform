import '@testing-library/jest-dom/vitest';
import '@douyinfe/semi-ui/react19-adapter';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../../../../../packages/shared/src/api/types';
import ClientDrawer from './ClientDrawer';

const transport = vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  return { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
});
vi.mock('@mate/shared/api', () => ({ createApiClient: () => transport, apiPath: () => '/api/v1/mcp' }));
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => ({ resolvedTheme: 'light' }) }));

const clientId = 'ui-audit-absent-20261009';
// clients_routes._to_dict emits explicit null for the known no-auth setting.
const loadedClient = {
  id: clientId, name: 'Registered Client', endpoint: 'https://example.test/mcp',
  serverUrl: 'https://example.test/mcp', baseUrl: 'https://example.test/mcp',
  clientType: 'custom', transportType: 'SSE', authType: null, apiKey: null, authToken: null,
  timeoutMs: 30000, headers: '', serverIds: '[]', config: '', status: 'DISCONNECTED',
  discoveredTools: 0, lastSyncAt: null, lastConnectedAt: null,
  createdAt: '2026-10-09T00:00:00Z', updatedAt: '2026-10-09T00:00:00Z',
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const props = { open: true, onClose: vi.fn(), onSaved: vi.fn() };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {} }));
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  transport.get.mockRejectedValue(new HttpError(404, 'client not found'));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function renderDrawer(id: string | null = clientId) {
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<ClientDrawer {...props} clientId={id} />); });
  return view;
}
function expectNoWrites() {
  expect(transport.put).not.toHaveBeenCalled();
  expect(transport.post).not.toHaveBeenCalled();
  expect(transport.delete).not.toHaveBeenCalled();
  expect(props.onSaved).not.toHaveBeenCalled();
}

describe('MCP Client edit read boundaries', () => {
  it.each([404, 403, 503])('keeps HTTP %i visible, offers retry, and blocks dependent mutations', async (status) => {
    const message = status === 404 ? 'client not found' : status === 403 ? '无权访问' : 'Client 服务暂不可用';
    transport.get.mockRejectedValue(new HttpError(status, message));
    await renderDrawer();
    expect(screen.queryByRole('alert')).toHaveTextContent('Client 加载失败');
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: '重试读取 Client' })).toBeEnabled();
    const save = screen.getByRole('button', { name: /保存$/ });
    const test = screen.getByRole('button', { name: /测试连接$/ });
    expect(save).toBeDisabled();
    expect(test).toBeDisabled();
    await act(async () => { fireEvent.click(save); fireEvent.click(test); });
    expectNoWrites();
    expect(screen.queryByText('无认证')).not.toBeInTheDocument();
    expect(screen.queryByText('自定义')).not.toBeInTheDocument();
  });

  it('retries a failed read without creating a client and fills only the returned configuration', async () => {
    transport.get.mockRejectedValueOnce(new HttpError(404, 'client not found'))
      .mockResolvedValueOnce({ data: loadedClient });
    await renderDrawer();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '重试读取 Client' })); });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue(loadedClient.name)).toBeVisible();
    expect(screen.getByDisplayValue(loadedClient.endpoint)).toBeVisible();
    expect(screen.getByText('SSE')).toBeVisible();
    expect(screen.getByText('无认证')).toBeVisible();
    expect(screen.queryByPlaceholderText('sk-...')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /保存$/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /测试连接$/ })).toBeEnabled();
    expect(transport.get.mock.calls.map(call => call[0])).toEqual([`/clients/${clientId}`, `/clients/${clientId}`]);
    expectNoWrites();
  });

  it('blocks save and connection tests until the edit read completes', async () => {
    const pending = deferred<{ data: typeof loadedClient }>();
    transport.get.mockReturnValueOnce(pending.promise);
    await renderDrawer();
    const save = screen.getByRole('button', { name: /保存$/ });
    const test = screen.getByRole('button', { name: /测试连接$/ });
    expect(save).toBeDisabled();
    expect(test).toBeDisabled();
    await act(async () => { fireEvent.click(save); fireEvent.click(test); });
    expectNoWrites();
    await act(async () => { pending.resolve({ data: loadedClient }); });
    expect(screen.getByRole('button', { name: /保存$/ })).toBeEnabled();
  });

  it('marks omitted configuration as unknown instead of filling custom, HTTP or no-auth defaults', async () => {
    transport.get.mockResolvedValueOnce({ data: {
      id: clientId, name: loadedClient.name, endpoint: loadedClient.endpoint, status: 'DISCONNECTED',
    } });
    await renderDrawer();
    expect(screen.getByDisplayValue(loadedClient.name)).toBeVisible();
    expect(screen.queryByText('Client 配置未完整返回，暂不能保存或测试连接。')).toBeVisible();
    expect(screen.queryByText('自定义')).not.toBeInTheDocument();
    expect(screen.queryByText('HTTP')).not.toBeInTheDocument();
    expect(screen.queryByText('无认证')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('sk-...')).not.toBeInTheDocument();
    const save = screen.getByRole('button', { name: /保存$/ });
    expect(save).toBeDisabled();
    expect(screen.getByRole('button', { name: /测试连接$/ })).toBeDisabled();
    await act(async () => { fireEvent.click(save); });
    expectNoWrites();
  });

  it('ignores an older successful read after navigating to an unresolved edit deep link', async () => {
    const previousId = 'previous-client';
    const previous = deferred<{ data: typeof loadedClient }>();
    const current = deferred<{ data: typeof loadedClient }>();
    transport.get.mockImplementation((path: string) => path === `/clients/${previousId}` ? previous.promise : current.promise);
    const view = await renderDrawer(previousId);
    await act(async () => { view.rerender(<ClientDrawer {...props} clientId={clientId} />); });
    await act(async () => { previous.resolve({ data: { ...loadedClient, id: previousId, name: 'Old Client' } }); });
    expect(screen.queryByText('编辑 Client：Old Client')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /保存$/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /测试连接$/ })).toBeDisabled();
    await act(async () => { current.reject(new HttpError(404, 'client not found')); });
    expect(screen.queryByRole('alert')).toHaveTextContent('client not found');
    expect(screen.queryByDisplayValue('Old Client')).not.toBeInTheDocument();
    expectNoWrites();
  });

  it('keeps explicit new-client defaults without issuing a read or generating a token', async () => {
    await renderDrawer(null);
    expect(screen.getByText('自定义')).toBeVisible();
    expect(screen.getByText('HTTP')).toBeVisible();
    expect(screen.getByText('无认证')).toBeVisible();
    expect(screen.getByRole('button', { name: /保存$/ })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /测试连接$/ })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('sk-...')).not.toBeInTheDocument();
    expect(transport.get).not.toHaveBeenCalled();
    expectNoWrites();
  });
});
