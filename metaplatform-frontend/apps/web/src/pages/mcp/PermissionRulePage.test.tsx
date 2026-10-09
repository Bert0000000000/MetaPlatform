import '@testing-library/jest-dom/vitest';
import '@douyinfe/semi-ui/react19-adapter';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PermissionRulePage from './PermissionRulePage';
import { createRule, updateRule } from '@/api/mcphub/permissions';

const transport = vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  return { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
});
vi.mock('@mate/shared/api', () => ({ createApiClient: () => transport, apiPath: () => '/api/v1/mcp' }));
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => ({ resolvedTheme: 'light' }) }));

const rule = { id: 'pol-existing', name: '真实多资源规则', subjectType: 'USER', subjectId: 'user-existing',
  resourceType: 'tool', resourceIds: ['tool-one', 'tool-two'], action: 'invoke', effect: 'ALLOW',
  conditionExpression: 'tenant == current', priority: 5, enabled: true };
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  transport.get.mockImplementation(async (path: string) => ({ data: path === '/permissions' ? { items: [rule], total: 1, page: 1, size: 100 }
    : path === '/resources' ? { resources: [{ name: 'ontology_class', uri: '?' }] }
    : path === '/tools' ? { items: [{ id: 'tool-one', name: '真实工具', category: 'test' }], total: 1 }
    : path === '/servers' ? { items: [{ id: 'server-one', name: '真实服务器' }], total: 1 }
    : { items: [], total: 0 } }));
  transport.post.mockResolvedValue({ data: rule });
  transport.put.mockResolvedValue({ data: rule });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const renderPage = async () => {
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<MemoryRouter><PermissionRulePage /></MemoryRouter>); });
  return view;
};

it('renders a nonempty real permission DTO including its single action and all resource identities', async () => {
  await renderPage();
  expect(screen.getByText('真实多资源规则')).toBeVisible();
  expect(screen.getByText('user-existing')).toBeVisible();
  expect(screen.getByText('tool-one')).toBeVisible();
  expect(screen.getByText('tool-two')).toBeVisible();
  expect(screen.getByText('invoke')).toBeVisible();
  expect(screen.getByText('ALLOW')).toBeVisible();
});

it('excludes ID-less registrations from rule options and explains why they cannot be selected', async () => {
  await renderPage();
  expect(screen.getByText(/资源注册信息没有权限资源 ID/)).toBeVisible();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /创建规则$/ })); });
  await act(async () => { fireEvent.click(screen.getByRole('combobox', { name: '资源 ID' })); });
  expect(screen.getByText('tool:真实工具')).toBeVisible();
  expect(screen.queryByText('resource:ontology_class')).not.toBeInTheDocument();
  expect(screen.queryByText('server:真实服务器')).not.toBeInTheDocument();
});

it('submits actual editor fields without dropping multiple resource IDs or an existing condition', async () => {
  await renderPage();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /编辑$/ })); });
  expect(screen.getByRole('textbox', { name: '条件表达式' })).toHaveValue('tenant == current');
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '保存' })); });
  await waitFor(() => expect(transport.put).toHaveBeenCalledWith('/permissions/pol-existing', expect.objectContaining({
    subjectId: 'user-existing', resourceIds: ['tool-one', 'tool-two'], action: 'invoke', conditionExpression: 'tenant == current',
  })));
});

it('preserves canonical permission fields on create and update without dropping resource IDs or conditions', async () => {
  const { id, ...request } = rule;
  await createRule(request);
  await updateRule(id, request);
  expect(transport.post).toHaveBeenCalledWith('/permissions', request);
  expect(transport.put).toHaveBeenCalledWith('/permissions/pol-existing', request);
});

it('shows a persistent failed read and gates writes until an actual successful retry', async () => {
  transport.get.mockRejectedValueOnce(new Error('权限读取暂不可用'));
  const view = await renderPage();
  const page = within(view.container);
  expect(page.getByRole('alert')).toHaveTextContent('权限读取暂不可用');
  expect(screen.getByRole('button', { name: /创建规则$/ })).toBeDisabled();
  expect(screen.queryByText('还没有权限规则')).not.toBeInTheDocument();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '重试权限规则' })); });
  expect(page.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /创建规则$/ })).toBeEnabled();
  expect(screen.getByText('真实多资源规则')).toBeVisible();
});
