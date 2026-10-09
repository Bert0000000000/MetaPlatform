import '@testing-library/jest-dom/vitest';
import '@douyinfe/semi-ui/react19-adapter';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../../../../packages/shared/src/api/types';
import { listResources } from '@/api/mcphub/resources';
import ResourceListPage from './ResourceListPage';

const transport = vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  return { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
});
// HTTP is the external boundary; the resource adapter, page, drawer and Semi form stay real.
vi.mock('@mate/shared/api', () => ({ createApiClient: () => transport, apiPath: () => '/api/v1/mcp' }));
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => ({ resolvedTheme: 'light' }) }));

const registrations = [{ uri: '?', name: 'ontology_class' }];
function RouteLocation() {
  return <output data-testid="route-location">{useLocation().pathname}</output>;
}
async function renderPage(path = '/ki/mcp/resources') {
  await act(async () => {
    render(<MemoryRouter initialEntries={[path]}><ResourceListPage /><RouteLocation /></MemoryRouter>);
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {} }));
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  transport.get.mockImplementation(async (path: string) => {
    if (path === '/resources') return { data: { resources: registrations } };
    throw new HttpError(404, 'resource not found');
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('registered MCP resource boundaries', () => {
  it('preserves the actual registration without fabricating a CRUD ID or missing metadata', async () => {
    const page = await listResources();
    expect(page.items).toEqual(registrations);
    expect(page.items[0]).not.toHaveProperty('id');
    expect(page.items[0]).not.toHaveProperty('mimeType');
    expect(page.items[0]).not.toHaveProperty('content');
    expect(page.items[0]).not.toHaveProperty('updatedAt');
  });

  it('rejects an unsupported successful response instead of presenting an empty resource collection', async () => {
    transport.get.mockResolvedValueOnce({ data: {} });
    await expect(listResources()).rejects.toThrow('资源注册信息响应缺少资源列表');
  });

  it('renders name and URI as registrations, marks absent metadata, and disables unavailable CRUD', async () => {
    await renderPage();
    const row = screen.getByText('ontology_class').closest('tr')!;
    expect(within(row).getByText('?')).toBeVisible();
    expect(within(row).queryAllByText('未提供')).toHaveLength(3);
    expect(screen.queryByText('资源管理未接入')).toBeVisible();
    const add = screen.getByRole('button', { name: /添加资源$/ });
    const edit = within(row).getByRole('button', { name: /编辑$/ });
    const remove = within(row).getByRole('button', { name: /删除$/ });
    expect(add).toBeDisabled();
    expect(edit).toBeDisabled();
    expect(remove).toBeDisabled();
    fireEvent.click(add);
    fireEvent.click(edit);
    fireEvent.click(remove);
    expect(screen.getByTestId('route-location')).toHaveTextContent('/ki/mcp/resources');
    expect(screen.getByTestId('route-location')).not.toHaveTextContent('undefined');
    expect(transport.get.mock.calls.map(call => call[0])).toEqual(['/resources']);
    expect(transport.post).not.toHaveBeenCalled();
    expect(transport.put).not.toHaveBeenCalled();
    expect(transport.delete).not.toHaveBeenCalled();
  });

  it('shows a persistent failed initial read with retry, then accepts a genuine empty registration list', async () => {
    transport.get.mockRejectedValueOnce(new HttpError(503, '资源服务暂不可用'))
      .mockResolvedValueOnce({ data: { resources: [] } });
    await renderPage();

    expect(screen.queryByRole('alert')).toHaveTextContent('资源列表加载失败');
    expect(screen.getByRole('alert')).toHaveTextContent('资源服务暂不可用');
    expect(screen.queryByText('还没有 MCP 资源')).not.toBeInTheDocument();
    expect(screen.queryByText('ontology_class')).not.toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '重试资源列表' })); });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('还没有 MCP 资源')).toBeVisible();
    expect(transport.get).toHaveBeenCalledTimes(2);
  });

  it('preserves successfully read registrations after refresh failure and labels them as the last result', async () => {
    await renderPage();
    transport.get.mockRejectedValueOnce(new Error('资源刷新失败'))
      .mockResolvedValueOnce({ data: { resources: registrations } });
    const search = screen.getByPlaceholderText('搜索名称/URI');
    await act(async () => { fireEvent.change(search, { target: { value: 'ontology' } }); });
    await act(async () => {
      fireEvent.keyDown(search, { key: 'Enter', code: 'Enter', keyCode: 13 });
      fireEvent.keyPress(search, { key: 'Enter', code: 'Enter', keyCode: 13, charCode: 13 });
      fireEvent.keyUp(search, { key: 'Enter', code: 'Enter', keyCode: 13 });
    });

    expect(screen.queryByRole('alert')).toHaveTextContent('资源列表加载失败');
    expect(screen.getByRole('alert')).toHaveTextContent('显示上次成功读取的结果');
    expect(screen.getByText('ontology_class')).toBeVisible();
    expect(screen.queryByText('还没有 MCP 资源')).not.toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '重试资源列表' })); });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('ontology_class')).toBeVisible();
  });

  it('keeps the direct new-resource form reviewable while preventing an unavailable POST', async () => {
    await renderPage('/ki/mcp/resources/new');

    expect(screen.getByPlaceholderText('docs://handbook/index.md')).toBeVisible();
    expect(screen.queryByText('资源表单仅供审阅，尚未接入保存。')).toBeVisible();
    const save = screen.getByRole('button', { name: /保存$/ });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('docs://handbook/index.md'), { target: { value: 'docs://review' } });
    fireEvent.click(save);
    expect(transport.post).not.toHaveBeenCalled();
    expect(transport.put).not.toHaveBeenCalled();
    expect(screen.getByTestId('route-location')).toHaveTextContent('/ki/mcp/resources/new');
  });

  it('marks a legacy detail deep link as unavailable without requesting a stub or using a registration as ID', async () => {
    await renderPage('/ki/mcp/resources/undefined');

    expect(screen.queryByText('资源表单仅供审阅，尚未接入保存。')).toBeVisible();
    expect(screen.getByRole('button', { name: /保存$/ })).toBeDisabled();
    expect(transport.get.mock.calls.map(call => call[0])).toEqual(['/resources']);
    expect(transport.put).not.toHaveBeenCalled();
    expect(transport.delete).not.toHaveBeenCalled();
  });
});
