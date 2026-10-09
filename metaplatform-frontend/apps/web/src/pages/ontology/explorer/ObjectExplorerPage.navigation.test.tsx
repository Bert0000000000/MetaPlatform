import '@douyinfe/semi-ui/react19-adapter';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode, Suspense, lazy } from 'react';
import type { ComponentType } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toast } from '@douyinfe/semi-ui';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AppShell from '@/components/shell/AppShell';
import OntologyTabLayout from '../layout/OntologyTabLayout';
import type { KernelIndividual, KernelObjectType } from '@/api/ont/kernel';
import ObjectExplorerPage from './ObjectExplorerPage';

const boundary = vi.hoisted(() => ({ get: vi.fn(), typeRead: vi.fn() }));
vi.hoisted(() => { HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) })) as never; });
vi.mock('@/api/client', () => ({ apiClient: { get: boundary.get } }));
vi.mock('@mate/shared', () => ({ useAuth: () => ({ user: { username: 'navigation-test' }, logout: vi.fn() }) }));
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }) }));

const customer: KernelObjectType = { rid: 'ont.test.obj.customer.v1', display_name: '客户', primary_key: [], properties: [], interfaces: [] };
const order: KernelObjectType = { rid: 'ont.test.obj.order.v1', display_name: '订单', primary_key: [], properties: [], interfaces: [] };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function rows(classRid: string): KernelIndividual[] {
  const prefix = classRid === order.rid ? 'order' : 'customer';
  return Array.from({ length: 25 }, (_, index) => ({ rid: `ont.test.obj.${prefix}.${index + 1}`, class_rid: classRid, primary_key: `${prefix}-${index + 1}`, props: {}, tenant_id: 'test-tenant' }));
}

beforeEach(() => {
  localStorage.clear();
  boundary.typeRead.mockReset().mockResolvedValue({ data: [customer, order] });
  boundary.get.mockReset().mockImplementation((url: string, options?: { params?: { class_rid?: string } }) => {
    if (url === '/ont/v2/object-types') return boundary.typeRead();
    if (url === '/ont/v2/individuals') return Promise.resolve({ data: rows(options?.params?.class_rid ?? customer.rid) });
    throw new Error(`Unexpected GET ${url}`);
  });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  // jsdom has no layout; give the real SplitPane a usable desktop measurement.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, 1000, 600));
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(async () => { cleanup(); await act(async () => Toast.destroyAll()); vi.restoreAllMocks(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });

function renderWorkspace(path = '/ontology/explore/objects', strict = false) {
  window.history.replaceState(null, '', path);
  const chat = deferred<{ default: ComponentType }>();
  let chatRequested = false;
  const Chat = lazy(() => { chatRequested = true; return chat.promise; });
  const tree = <BrowserRouter><Suspense fallback={<p>正在加载目标页面</p>}><Routes><Route element={<AppShell />}>
    <Route path="ontology" element={<OntologyTabLayout />}><Route path="explore/objects/:rid?" element={<ObjectExplorerPage />} /></Route>
    <Route path="superai/chat" element={<Chat />} />
  </Route></Routes></Suspense></BrowserRouter>;
  const view = render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  return { ...view, chat, chatRequested: () => chatRequested };
}

it('does not replace a pending lazy destination URL when the old Explorer receives its first type list', async () => {
  const typeRequest = deferred<{ data: KernelObjectType[] }>();
  boundary.typeRead.mockReturnValueOnce(typeRequest.promise);
  const view = renderWorkspace();
  await waitFor(() => expect(boundary.typeRead).toHaveBeenCalledTimes(1));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '打开 SuperAI 会话' })));
  expect(window.location.pathname).toBe('/superai/chat');
  expect(view.chatRequested()).toBe(true);
  expect(screen.getByRole('heading', { name: '对象浏览', level: 1 })).toBeVisible();
  await act(async () => typeRequest.resolve({ data: [customer, order] }));
  expect(window.location.pathname).toBe('/superai/chat');
  await act(async () => view.chat.resolve({ default: () => <h1>完整 SuperAI 会话</h1> }));
  expect(screen.getByRole('heading', { name: '完整 SuperAI 会话' })).toBeVisible();
  const navigation = screen.getByRole('navigation', { name: '工作区页面导航' });
  expect(within(navigation).getByRole('link', { name: /^会话$/ })).toHaveAttribute('aria-current', 'page');
  expect(window.location.pathname).toBe('/superai/chat');
});

it('resumes class and query synchronization when returning before the lazy destination commits', async () => {
  const typeRequest = deferred<{ data: KernelObjectType[] }>();
  boundary.typeRead.mockReturnValueOnce(typeRequest.promise);
  const view = renderWorkspace('/ontology/explore/objects?q=customer');
  await waitFor(() => expect(boundary.typeRead).toHaveBeenCalledTimes(1));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '打开 SuperAI 会话' })));
  expect(window.location.pathname).toBe('/superai/chat');
  expect(view.chatRequested()).toBe(true);
  await act(async () => typeRequest.resolve({ data: [customer, order] }));
  expect(window.location.pathname).toBe('/superai/chat');
  expect(screen.getByPlaceholderText('搜索「客户」：主键、属性值…')).toHaveValue('customer');
  expect(screen.getByRole('button', { name: '刷新类型清单' })).not.toBeDisabled();

  window.history.back();
  await waitFor(() => expect(window.location.pathname).toBe('/ontology/explore/objects'));
  await waitFor(() => expect(new URLSearchParams(window.location.search).get('class')).toBe(customer.rid));
  expect(new URLSearchParams(window.location.search).get('q')).toBe('customer');
  expect(screen.getByRole('heading', { name: '对象浏览', level: 1 })).toBeVisible();
  expect(screen.getByRole('button', { name: '刷新类型清单' })).not.toBeDisabled();
  expect(screen.getByText('customer-1')).toBeVisible();
  expect(boundary.typeRead).toHaveBeenCalledTimes(1);
});

it('synchronizes class, query and page, preserves the page on refresh and resets it only when selecting another type', async () => {
  renderWorkspace();
  const search = await screen.findByPlaceholderText('搜索「客户」：主键、属性值…');
  await waitFor(() => expect(new URLSearchParams(window.location.search).get('class')).toBe(customer.rid));
  fireEvent.change(search, { target: { value: 'customer' } });
  await waitFor(() => expect(new URLSearchParams(window.location.search).get('q')).toBe('customer'));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(await screen.findByText('customer-21')).toBeVisible();
  expect(new URLSearchParams(window.location.search).get('page')).toBe('2');
  fireEvent.click(screen.getByRole('button', { name: '刷新类型清单' }));
  await waitFor(() => expect(boundary.typeRead).toHaveBeenCalledTimes(2));
  expect(screen.getByPlaceholderText('搜索「客户」：主键、属性值…')).toHaveValue('customer');
  expect(new URLSearchParams(window.location.search).get('class')).toBe(customer.rid);
  expect(new URLSearchParams(window.location.search).get('page')).toBe('2');
  expect(boundary.get).toHaveBeenCalledWith('/ont/v2/individuals', { params: { class_rid: customer.rid, limit: 500, offset: 0 } });
  if (!screen.queryByText('订单')) {
    const tree = screen.getByRole('tree');
    for (const expand of within(tree).getAllByRole('button', { name: 'Collapse the tree item' })) fireEvent.click(expand);
  }
  const orderNode = await screen.findByText('订单');
  fireEvent.click(orderNode);
  await waitFor(() => expect(new URLSearchParams(window.location.search).get('class')).toBe(order.rid));
  expect(new URLSearchParams(window.location.search).get('page')).toBeNull();
  expect(screen.getByPlaceholderText('搜索「订单」：主键、属性值…')).toHaveValue('customer');
});

it('preserves an explicit class, query and page when reloading the Explorer and returning from a completed route', async () => {
  const path = `/ontology/explore/objects?class=${order.rid}&q=order&page=2`;
  const initial = renderWorkspace(path);
  expect(await screen.findByText('order-21')).toBeVisible();
  expect(new URLSearchParams(window.location.search).get('page')).toBe('2');
  initial.unmount();
  const view = renderWorkspace(`${window.location.pathname}${window.location.search}`);
  expect(await screen.findByText('order-21')).toBeVisible();
  expect(screen.getByPlaceholderText('搜索「订单」：主键、属性值…')).toHaveValue('order');
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '打开 SuperAI 会话' })));
  await act(async () => view.chat.resolve({ default: () => <h1>完整 SuperAI 会话</h1> }));
  expect(screen.getByRole('heading', { name: '完整 SuperAI 会话' })).toBeVisible();
  window.history.back();
  expect(await screen.findByText('order-21')).toBeVisible();
  expect(new URLSearchParams(window.location.search)).toEqual(new URLSearchParams(`class=${order.rid}&q=order&page=2`));
  expect(screen.getByPlaceholderText('搜索「订单」：主键、属性值…')).toHaveValue('order');
});

it.each(['resolve', 'reject'] as const)('ignores an obsolete initial type request that %ss after a newer lifecycle read succeeds', async (settlement) => {
  const older = deferred<{ data: KernelObjectType[] }>();
  boundary.typeRead.mockReturnValueOnce(older.promise).mockResolvedValue({ data: [order] });
  renderWorkspace(`/ontology/explore/objects?class=${order.rid}`, true);
  await screen.findByPlaceholderText('搜索「订单」：主键、属性值…');
  expect(boundary.typeRead).toHaveBeenCalledTimes(2);
  await act(async () => {
    if (settlement === 'resolve') older.resolve({ data: [customer] });
    else older.reject(new Error('旧类型请求失败'));
  });
  expect(screen.getByPlaceholderText('搜索「订单」：主键、属性值…')).toBeVisible();
  expect(screen.queryByText('旧类型请求失败')).toBeNull();
  expect(new URLSearchParams(window.location.search).get('class')).toBe(order.rid);
});
