import '@douyinfe/semi-ui/react19-adapter';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Toast } from '@douyinfe/semi-ui';
import AppDetailPage from './AppDetailPage';
import AppLifecyclePage from './AppLifecyclePage';
import VersionManagementPage from './VersionManagementPage';
import PageDesignerPage from './PageDesignerPage';
import ReleaseRecordPage from './ReleaseRecordPage';
import FormDesignerPage from './FormDesignerPage';
import FlowDesignerPage from './FlowDesignerPage';
import MarketplacePage from './MarketplacePage';
import * as apps from '@/api/apphub/apps';
import * as modules from '@/api/apphub/modules';
import * as versions from '@/api/apphub/versions';
import * as pages from '@/api/apphub/pages';
import * as releases from '@/api/apphub/release';
import * as forms from '@/api/apphub/forms';
import * as flows from '@/api/apphub/flows';
import * as marketplace from '@/api/apphub/marketplace';
import type { TemplateItem } from '@/api/apphub/marketplace';
import type { AppItem, ModuleItem, PageResponse } from '@/api/apphub/types';
import type { PageDesignerConfig } from '@/api/apphub/pages';

vi.hoisted(() => { HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) })) as never; });
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
Range.prototype.getBoundingClientRect = () => new DOMRect();
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => ({ resolvedTheme: 'light' }) }));
vi.mock('@/api/apphub/apps', async (original) => ({ ...(await original<typeof import('@/api/apphub/apps')>()), getApp: vi.fn() }));
vi.mock('@/api/apphub/modules', async (original) => ({ ...(await original<typeof import('@/api/apphub/modules')>()), listModules: vi.fn(), getModule: vi.fn(), createModule: vi.fn(), updateModule: vi.fn(), deleteModule: vi.fn() }));
vi.mock('@/api/apphub/versions', async (original) => ({ ...(await original<typeof import('@/api/apphub/versions')>()), listVersions: vi.fn() }));
vi.mock('@/api/apphub/pages', async (original) => ({ ...(await original<typeof import('@/api/apphub/pages')>()), getPage: vi.fn() }));
vi.mock('@/api/apphub/release', async (original) => ({ ...(await original<typeof import('@/api/apphub/release')>()), listReleases: vi.fn() }));
vi.mock('@/api/apphub/forms', async (original) => ({ ...(await original<typeof import('@/api/apphub/forms')>()), getFormDefinition: vi.fn() }));
vi.mock('@/api/apphub/flows', async (original) => ({ ...(await original<typeof import('@/api/apphub/flows')>()), getFlow: vi.fn(), listFormModules: vi.fn() }));
vi.mock('@/api/apphub/marketplace', async (original) => ({ ...(await original<typeof import('@/api/apphub/marketplace')>()), listTemplates: vi.fn(), listInstalled: vi.fn() }));
afterEach(async () => { cleanup(); await act(async () => Toast.destroyAll()); vi.resetAllMocks(); });

const app: AppItem = { appId: 'app-real', name: '实际应用', code: 'real', businessDomain: '', status: 'DESIGNING', moduleCount: 0, createdAt: '', updatedAt: '' };
const emptyPage = { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
const module: ModuleItem = { moduleId: 'module-real', appId: 'app-real', name: '实际模块', code: 'real', type: 'FORM', createdAt: '', updatedAt: '', config: { name: '实际表单', fields: [] } };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const appA: AppItem = { ...app, appId: 'app-a', name: '应用 A', code: 'code-a' };
const appB: AppItem = { ...app, appId: 'app-b', name: '应用 B', code: 'code-b' };
const modulesA = { ...emptyPage, items: [{ ...module, moduleId: 'module-a', name: 'A 模块' }] };
const modulesB = { ...emptyPage, items: [{ ...module, moduleId: 'module-b', name: 'B 模块' }] };

const rawModule = { id: 'module-record', tenant_id: 'tenant-real', name: '后台模块', code: 'orders', app_code: 'real', description: '已登记模块', entry_path: '/orders' };

function CurrentRoute() {
  const location = useLocation();
  return <output data-testid="current-route">{location.pathname}{location.search}</output>;
}

it('disables unsupported module editing and deletion without making mutation requests', async () => {
  vi.mocked(apps.getApp).mockResolvedValue(app);
  vi.mocked(modules.listModules).mockResolvedValue({ ...emptyPage, items: [rawModule as unknown as ModuleItem] });
  render(<MemoryRouter><AppDetailPage appId="app-real" /></MemoryRouter>);
  await screen.findByText(rawModule.name);
  fireEvent.click(screen.getByRole('button', { name: 'more' }));
  const edit = await screen.findByRole('menuitem', { name: /编辑模块/ });
  const remove = screen.getByRole('menuitem', { name: /删除模块/ });
  expect(edit).toHaveAttribute('aria-disabled', 'true');
  expect(remove).toHaveAttribute('aria-disabled', 'true');
  fireEvent.click(edit);
  fireEvent.click(remove);
  expect(screen.queryByRole('dialog', { name: '编辑模块' })).toBeNull();
  expect(screen.queryByText('确认删除')).toBeNull();
  expect(modules.updateModule).not.toHaveBeenCalled();
  expect(modules.deleteModule).not.toHaveBeenCalled();
  expect(screen.getByText(/当前后端未提供模块编辑与删除接口/)).toBeVisible();
});

it.each([
  { type: undefined, id: 'module-record' },
  { type: 'FORM', id: undefined },
])('does not construct a designer route when module type or identifier is missing ($type, $id)', async (metadata) => {
  vi.mocked(apps.getApp).mockResolvedValue(app);
  vi.mocked(modules.listModules).mockResolvedValue({ ...emptyPage, items: [{ ...rawModule, ...metadata } as unknown as ModuleItem] });
  render(<MemoryRouter initialEntries={['/apps/mine?app=app-real']}><AppDetailPage appId="app-real" /><CurrentRoute /></MemoryRouter>);
  fireEvent.click(await screen.findByText(rawModule.name));
  expect(screen.getByTestId('current-route')).toHaveTextContent('/apps/mine?app=app-real');
  expect(screen.getByTestId('current-route').textContent).not.toContain('module=');
  expect(await screen.findByText(/模块未提供设计器类型或标识/)).toBeVisible();
  expect(modules.updateModule).not.toHaveBeenCalled();
  expect(modules.deleteModule).not.toHaveBeenCalled();
});

it.each([
  { type: 'FORM', tab: 'form-designer' },
  { type: 'FLOW', tab: 'flow-designer' },
])('uses the supplied real module identifier for an explicitly typed $type module', async ({ type, tab }) => {
  vi.mocked(apps.getApp).mockResolvedValue(app);
  vi.mocked(modules.listModules).mockResolvedValue({ ...emptyPage, items: [{ ...rawModule, type } as unknown as ModuleItem] });
  render(<MemoryRouter><AppDetailPage appId="app-real" /><CurrentRoute /></MemoryRouter>);
  fireEvent.click(await screen.findByText(rawModule.name));
  const location = screen.getByTestId('current-route').textContent!;
  const query = new URLSearchParams(location.slice(location.indexOf('?') + 1));
  expect(query.get('module')).toBe(rawModule.id);
  expect(query.get('tab')).toBe(tab);
  expect(location).not.toContain('undefined');
});

it('creates a module with the app_code required by the existing backend', async () => {
  vi.mocked(apps.getApp).mockResolvedValue(app);
  vi.mocked(modules.listModules).mockResolvedValue(emptyPage);
  vi.mocked(modules.createModule).mockResolvedValue(rawModule as unknown as ModuleItem);
  render(<MemoryRouter><AppDetailPage appId="app-real" /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: /创建模块/ }));
  const dialog = await screen.findByRole('dialog');
  await act(async () => fireEvent.change(within(dialog).getByPlaceholderText('例如：采购申请'), { target: { value: '真实新模块' } }));
  await act(async () => fireEvent.change(within(dialog).getByPlaceholderText('例如：purchase_apply'), { target: { value: 'new_orders' } }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'confirm' }));
  await waitFor(() => expect(modules.createModule).toHaveBeenCalledWith(expect.objectContaining({ name: '真实新模块', code: 'new_orders', app_code: app.code })));
  expect(modules.updateModule).not.toHaveBeenCalled();
  expect(modules.deleteModule).not.toHaveBeenCalled();
});

it('keeps the current application when an earlier application read finishes last', async () => {
  const older = deferred<AppItem>();
  vi.mocked(apps.getApp).mockImplementation((id) => id === 'app-a' ? older.promise : Promise.resolve(appB));
  vi.mocked(modules.listModules).mockImplementation((code) => Promise.resolve(code === 'code-a' ? modulesA : modulesB));
  const view = render(<MemoryRouter><AppDetailPage appId="app-a" /></MemoryRouter>);
  view.rerender(<MemoryRouter><AppDetailPage appId="app-b" /></MemoryRouter>);
  await screen.findByText('B 模块');
  await act(async () => older.resolve(appA));
  expect(screen.getByRole('heading', { name: '应用 B', level: 1 })).toBeVisible();
  expect(screen.getByText('B 模块')).toBeVisible();
  expect(modules.listModules).not.toHaveBeenCalledWith('code-a');
});

it('keeps the current modules when an earlier module read finishes last', async () => {
  const older = deferred<PageResponse<ModuleItem>>();
  vi.mocked(apps.getApp).mockImplementation((id) => Promise.resolve(id === 'app-a' ? appA : appB));
  vi.mocked(modules.listModules).mockImplementation((code) => code === 'code-a' ? older.promise : Promise.resolve(modulesB));
  const view = render(<MemoryRouter><AppDetailPage appId="app-a" /></MemoryRouter>);
  await waitFor(() => expect(modules.listModules).toHaveBeenCalledWith('code-a'));
  view.rerender(<MemoryRouter><AppDetailPage appId="app-b" /></MemoryRouter>);
  await screen.findByText('B 模块');
  await act(async () => older.resolve(modulesA));
  expect(screen.getByRole('heading', { name: '应用 B', level: 1 })).toBeVisible();
  expect(screen.getByText('B 模块')).toBeVisible();
  expect(screen.queryByText('A 模块')).toBeNull();
});

it.each(['application', 'modules'] as const)('ignores an obsolete %s failure after the current application has loaded', async (stage) => {
  const olderApp = deferred<AppItem>();
  const olderModules = deferred<PageResponse<ModuleItem>>();
  vi.mocked(apps.getApp).mockImplementation((id) => id === 'app-b' ? Promise.resolve(appB) : stage === 'application' ? olderApp.promise : Promise.resolve(appA));
  vi.mocked(modules.listModules).mockImplementation((code) => code === 'code-a' ? olderModules.promise : Promise.resolve(modulesB));
  const view = render(<MemoryRouter><AppDetailPage appId="app-a" /></MemoryRouter>);
  if (stage === 'modules') await waitFor(() => expect(modules.listModules).toHaveBeenCalledWith('code-a'));
  view.rerender(<MemoryRouter><AppDetailPage appId="app-b" /></MemoryRouter>);
  await screen.findByText('B 模块');
  await act(async () => (stage === 'application' ? olderApp : olderModules).reject(new Error('旧应用读取失败')));
  expect(screen.queryByText('旧应用读取失败')).toBeNull();
  expect(screen.getByRole('heading', { name: '应用 B', level: 1 })).toBeVisible();
  expect(screen.getByText('B 模块')).toBeVisible();
});

it('keeps current modules busy while an obsolete module request completes', async () => {
  const older = deferred<PageResponse<ModuleItem>>();
  const current = deferred<PageResponse<ModuleItem>>();
  vi.mocked(apps.getApp).mockImplementation((id) => Promise.resolve(id === 'app-a' ? appA : appB));
  vi.mocked(modules.listModules).mockImplementation((code) => code === 'code-a' ? older.promise : current.promise);
  const view = render(<MemoryRouter><AppDetailPage appId="app-a" /></MemoryRouter>);
  await waitFor(() => expect(modules.listModules).toHaveBeenCalledWith('code-a'));
  view.rerender(<MemoryRouter><AppDetailPage appId="app-b" /></MemoryRouter>);
  await waitFor(() => expect(modules.listModules).toHaveBeenCalledWith('code-b'));
  const card = screen.getByText('code-b').closest('[aria-busy]');
  expect(card).toHaveAttribute('aria-busy', 'true');
  await act(async () => older.resolve(modulesA));
  expect(card).toHaveAttribute('aria-busy', 'true');
  expect(screen.queryByText('A 模块')).toBeNull();
  await act(async () => current.resolve(modulesB));
  expect(await screen.findByText('B 模块')).toBeVisible();
  expect(card).toHaveAttribute('aria-busy', 'false');
});

it.each(['resolve', 'reject'] as const)('keeps the current page when an obsolete page read %ss last', async (settlement) => {
  const older = deferred<PageDesignerConfig>();
  vi.mocked(pages.getPage).mockImplementation((id) => id === 'page-a' ? older.promise : Promise.resolve({ name: '页面 B', widgets: [], layout: 'grid' }));
  const view = render(<MemoryRouter><PageDesignerPage pageId="page-a" /></MemoryRouter>);
  view.rerender(<MemoryRouter><PageDesignerPage pageId="page-b" /></MemoryRouter>);
  await screen.findByRole('heading', { name: '页面设计器 · 页面 B', level: 1 });
  await act(async () => {
    if (settlement === 'resolve') older.resolve({ name: '页面 A', widgets: [], layout: 'grid' });
    else older.reject(new Error('旧页面读取失败'));
  });
  expect(screen.queryByText('旧页面读取失败')).toBeNull();
  expect(screen.getByRole('heading', { name: '页面设计器 · 页面 B', level: 1 })).toBeVisible();
  expect(screen.getByRole('button', { name: /保存/ })).toBeVisible();
});

it.each(['resolve', 'reject'] as const)('keeps the current page loading when an obsolete page read %ss', async (settlement) => {
  const older = deferred<PageDesignerConfig>();
  const current = deferred<PageDesignerConfig>();
  vi.mocked(pages.getPage).mockImplementation((id) => id === 'page-a' ? older.promise : current.promise);
  const view = render(<MemoryRouter><PageDesignerPage pageId="page-a" /></MemoryRouter>);
  view.rerender(<MemoryRouter><PageDesignerPage pageId="page-b" /></MemoryRouter>);
  await act(async () => {
    if (settlement === 'resolve') older.resolve({ name: '页面 A', widgets: [], layout: 'grid' });
    else older.reject(new Error('旧页面读取失败'));
  });
  expect(screen.getByText('正在读取页面…')).toBeVisible();
  expect(screen.queryByRole('button', { name: /保存/ })).toBeNull();
  expect(screen.queryByText('旧页面读取失败')).toBeNull();
  await act(async () => current.resolve({ name: '页面 B', widgets: [], layout: 'grid' }));
  expect(await screen.findByRole('heading', { name: '页面设计器 · 页面 B', level: 1 })).toBeVisible();
});

it('retries a failed application detail read instead of remaining in loading indefinitely', async () => {
  vi.mocked(apps.getApp).mockRejectedValueOnce(new Error('应用读取失败')).mockResolvedValueOnce(app);
  vi.mocked(modules.listModules).mockResolvedValue(emptyPage);
  render(<MemoryRouter><AppDetailPage appId="app-real" /></MemoryRouter>);
  expect(await screen.findByText('应用读取失败')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(await screen.findByRole('heading', { name: '实际应用', level: 1 })).toBeVisible();
});

it('retries a failed lifecycle read before enabling application state actions', async () => {
  vi.mocked(apps.getApp).mockRejectedValueOnce(new Error('生命周期读取失败')).mockResolvedValueOnce(app);
  render(<MemoryRouter><AppLifecyclePage appId="app-real" /></MemoryRouter>);
  expect(await screen.findByText('生命周期读取失败')).toBeVisible();
  expect(screen.queryByRole('button', { name: /发布/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(await screen.findByRole('button', { name: /发布/ })).toBeVisible();
});

it('shows a failed version request separately from a verified empty version list', async () => {
  vi.mocked(apps.getApp).mockResolvedValue(app);
  vi.mocked(versions.listVersions).mockRejectedValueOnce(new Error('版本读取失败')).mockResolvedValueOnce(emptyPage);
  render(<MemoryRouter><VersionManagementPage appId="app-real" /></MemoryRouter>);
  expect(await screen.findByText('版本读取失败')).toBeVisible();
  expect(screen.queryByText('还没有版本快照')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(await screen.findByText('还没有版本快照')).toBeVisible();
});

it('retains a page read error and opens the actual editor after retrying', async () => {
  vi.mocked(pages.getPage).mockRejectedValueOnce(new Error('页面读取失败')).mockResolvedValueOnce({ name: '服务端页面', widgets: [], layout: 'grid' });
  render(<MemoryRouter><PageDesignerPage pageId="page-real" /></MemoryRouter>);
  expect(await screen.findByText('页面读取失败')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(await screen.findByRole('heading', { name: '页面设计器 · 服务端页面', level: 1 })).toBeVisible();
});

it('does not show a false empty release history when its read fails', async () => {
  vi.mocked(releases.listReleases).mockRejectedValueOnce(new Error('发布记录读取失败')).mockResolvedValueOnce(emptyPage);
  render(<MemoryRouter><ReleaseRecordPage appId="app-real" /></MemoryRouter>);
  expect(await screen.findByText('发布记录读取失败')).toBeVisible();
  expect(screen.queryByText('暂无发布记录')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(await screen.findByText('暂无发布记录')).toBeVisible();
});

it('retries a failed form definition before offering an editable blank form', async () => {
  vi.mocked(modules.getModule).mockResolvedValue(module);
  vi.mocked(forms.getFormDefinition).mockRejectedValueOnce(new Error('表单设置读取失败')).mockResolvedValueOnce({ formId: 'module-real', globalSettings: { title: '' }, linkageRules: [], scripts: {} });
  render(<MemoryRouter><FormDesignerPage appId="app-real" moduleId="module-real" /></MemoryRouter>);
  expect(await screen.findByText('表单设置读取失败')).toBeVisible();
  expect(screen.queryByRole('button', { name: /保存/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(await screen.findByRole('button', { name: /保存/ })).toBeVisible();
});

it('does not treat a failed flow read as an empty flow and can retry it', async () => {
  vi.mocked(modules.getModule).mockResolvedValue({ ...module, type: 'FLOW' });
  vi.mocked(flows.listFormModules).mockResolvedValue([]);
  vi.mocked(flows.getFlow).mockRejectedValueOnce(new Error('流程配置读取失败')).mockResolvedValueOnce({ name: '实际流程', nodes: [], edges: [] });
  render(<MemoryRouter><FlowDesignerPage appId="app-real" moduleId="module-real" /></MemoryRouter>);
  expect(await screen.findByText('流程配置读取失败')).toBeVisible();
  expect(screen.queryByRole('button', { name: /保存/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(await screen.findByRole('button', { name: /保存/ })).toBeVisible();
});

it.each([
  { templateId: 'tpl-actual-form', name: '实际表单模板', category: 'form', description: '实际表单说明', configSnapshot: '{"fields":[{"fieldKey":"confirmed","label":"实际确认字段"}]}', expectedContent: '实际确认字段' },
  { templateId: 'tpl-actual-workflow', name: '实际工作流模板', category: 'workflow', description: '实际流程说明', configSnapshot: '{"nodes":[{"type":"approval","name":"实际审批节点"}]}', expectedContent: '实际审批节点' },
])('previews $name from its actual configuration without fixed module counts or fabricated ratings', async ({ expectedContent, ...selected }) => {
  const template: TemplateItem = { ...selected, icon: '', tags: ['实际标签'], downloadCount: 0, rating: 0, createdAt: '' };
  vi.mocked(marketplace.listTemplates).mockResolvedValue([template]);
  vi.mocked(marketplace.listInstalled).mockResolvedValue([]);
  render(<MemoryRouter><MarketplacePage /></MemoryRouter>);
  await screen.findByText(selected.name);
  fireEvent.click(screen.getByRole('button', { name: /详情/ }));
  const dialog = await screen.findByRole('dialog');
  expect(dialog.textContent).not.toMatch(/表单（4 个）|流程（2 个）|仪表盘（1 个）|仪表盘组件（5\+）|权限规则（3 条）/);
  expect(dialog.textContent).not.toMatch(/评分：|安装 0 次/);
  expect(dialog).toHaveTextContent('模块清单未提供');
  expect(dialog).toHaveTextContent(selected.description);
  expect(dialog).toHaveTextContent(expectedContent);
});
