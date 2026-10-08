import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import AppShell from './AppShell';
import OntologyTabLayout from '@/pages/ontology/layout/OntologyTabLayout';
import { getOntologyContextSnapshot } from '@/pages/ontology/hooks/assistantContext';

// Semi imports its animation driver eagerly; jsdom has no canvas implementation.
vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

// Authentication/settings are external providers; navigation and Semi rendering stay real.
vi.mock('@mate/shared', () => ({ useAuth: () => ({ user: { username: 'test-user' }, logout: vi.fn() }) }));
vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({ resolvedTheme: 'light', setTheme: vi.fn().mockResolvedValue(undefined) }),
}));

beforeEach(() => {
  vi.stubGlobal('localStorage', window.localStorage);
  localStorage.clear();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function renderShell(path: string) {
  const router = createMemoryRouter([{
    element: <AppShell />,
    children: [
      { path: '/ontology', element: <OntologyTabLayout />, children: [
        { index: true, element: <h1>总览内容</h1> },
        { path: '*', element: <h1>本体资源内容</h1> },
      ] },
      { path: '/home', element: <h1>工作台内容</h1> },
      { path: '/apps/*', element: <h1>业务应用内容</h1> },
      { path: '/gov/*', element: <h1>治理内容</h1> },
      { path: '/admin/*', element: <h1>管理内容</h1> },
      { path: '/superai/*', element: <h1>完整 SuperAI 会话</h1> },
      { path: '/agents/*', element: <h1>员工内容</h1> },
      { path: '/ki/*', element: <h1>连接内容</h1> },
    ],
  }], { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('本体建设工作区导航', () => {
  it('对象详情深链高亮对象类型，保留上下文且不显示平台 PageTabs', () => {
    renderShell('/ontology/model/object-types/ont.t.obj.customer.v1/properties');
    const nav = screen.getByRole('navigation', { name: '本体工作区导航' });
    expect(within(nav).getByRole('link', { name: '对象类型' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: '概览' })).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('tab', { name: '业务模型' })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '本体上下文' })).toHaveTextContent('业务模型');
    expect(getOntologyContextSnapshot().navigation).toMatchObject({
      view: 'ontology-model', tab: 'model', url: '/ontology/model/object-types/ont.t.obj.customer.v1/properties',
    });
    expect(within(nav).queryByText('保存的查询')).not.toBeInTheDocument();
    expect(within(nav).queryByText('审批策略')).not.toBeInTheDocument();
  });

  it('点击关系类型和浏览器返回更新 URL、高亮与上下文', async () => {
    const router = renderShell('/ontology/model/graph');
    const nav = screen.getByRole('navigation', { name: '本体工作区导航' });
    fireEvent.click(within(nav).getByRole('link', { name: '关系类型' }));
    expect(router.state.location.pathname).toBe('/ontology/model/link-types');
    expect(within(nav).getByRole('link', { name: '关系类型' })).toHaveAttribute('aria-current', 'page');
    await act(() => router.navigate(-1));
    expect(router.state.location.pathname).toBe('/ontology/model/graph');
    expect(within(nav).getByRole('link', { name: '模型工作台' })).toHaveAttribute('aria-current', 'page');
    expect(getOntologyContextSnapshot().navigation?.url).toBe('/ontology/model/graph');
  });

  it('键盘展开进入导航，选择后返回可见按钮，Escape 也恢复焦点', () => {
    const router = renderShell('/ontology/model/graph');
    const toggle = screen.getByRole('button', { name: '展开本体导航' });
    const nav = screen.getByRole('navigation', { name: '本体工作区导航' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    toggle.focus();
    // jsdom does not perform native button/link activation after keydown;
    // dispatch the keyboard-generated click. Actual Tab traversal is covered by Playwright.
    fireEvent.keyDown(toggle, { key: 'Enter' });
    fireEvent.click(toggle, { detail: 0 });
    expect(screen.getByRole('button', { name: '收起本体导航' })).toHaveAttribute('aria-expanded', 'true');
    const firstLink = within(nav).getByRole('link', { name: '概览' });
    expect(firstLink).toHaveFocus();
    fireEvent.keyDown(firstLink, { key: 'Enter' });
    fireEvent.click(firstLink, { detail: 0 });
    expect(router.state.location.pathname).toBe('/ontology');
    expect(screen.getByRole('button', { name: '展开本体导航' })).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
    expect(toggle).toBeVisible();
    fireEvent.click(toggle, { detail: 0 });
    expect(firstLink).toHaveFocus();
    fireEvent.keyDown(firstLink, { key: 'Escape' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
  });

  it('其他域继续呈现可点击 PageTabs，离开本体清空上下文', async () => {
    const router = renderShell('/ontology/model/graph');
    await act(() => router.navigate('/home'));
    expect(screen.getByRole('tab', { name: '概览' })).toBeVisible();
    expect(screen.getByRole('tab', { name: '待办' })).toBeVisible();
    expect(screen.queryByRole('navigation', { name: '本体工作区导航' })).not.toBeInTheDocument();
    expect(getOntologyContextSnapshot().navigation).toBeNull();
  });

  it('七入口在 side/top 同序可点击，对象探索不套建设导航且保留上下文', () => {
    const router = renderShell('/ontology/model/graph');
    const labels = ['工作台', '业务应用', '对象探索', '本体工作室', '数字员工', '连接与知识', '治理与管理'];
    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual(labels);
    fireEvent.click(screen.getByRole('menuitem', { name: '对象探索' }));
    expect(router.state.location.pathname).toBe('/ontology/explore/objects');
    expect(screen.queryByRole('navigation', { name: '本体工作区导航' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '对象浏览', selected: true })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'ObjectSet 构建器' })).toBeVisible();
    expect(getOntologyContextSnapshot().navigation).toMatchObject({ view: 'ontology-explore', tab: 'explore' });
    fireEvent.click(screen.getByRole('button', { name: '切换导航布局' }));
    const topNav = document.querySelector('.mp-topnav') as HTMLElement;
    expect(within(topNav).getAllByRole('tab').map(tab => tab.textContent)).toEqual(labels);
    fireEvent.click(within(topNav).getByRole('tab', { name: '治理与管理' }));
    expect(router.state.location.pathname).toBe('/gov/business');
    expect(screen.getByRole('tab', { name: '组织' })).toBeVisible();
  });

  it('SuperAI 常驻控件可打开 Copilot 和完整会话，不占产品菜单', () => {
    const router = renderShell('/home');
    expect(screen.queryByRole('menuitem', { name: 'SuperAI' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '打开 SuperAI Copilot' }));
    expect(document.getElementById('app')).toHaveAttribute('data-copilot', 'open');
    fireEvent.click(screen.getByRole('button', { name: '打开 SuperAI 会话' }));
    expect(router.state.location.pathname).toBe('/superai/chat');
    expect(screen.getByRole('heading', { name: '完整 SuperAI 会话' })).toBeVisible();
    expect(screen.getByRole('tab', { name: '会话', selected: true })).toBeVisible();
  });

  it('对象详情深链仍发布打开记录，统一策略页保留域壳但无建设侧栏', async () => {
    const router = renderShell('/ontology/explore/objects/ont.t.obj.customer.1?class=ont.t.obj.customer.v1');
    expect(screen.queryByRole('navigation', { name: '本体工作区导航' })).not.toBeInTheDocument();
    expect(getOntologyContextSnapshot().navigation).toMatchObject({
      view: 'ontology-explore', openRecordIds: ['ont.t.obj.customer.1'],
      url: '/ontology/explore/objects/ont.t.obj.customer.1?class=ont.t.obj.customer.v1',
    });
    await act(() => router.navigate('/ontology/governance/security'));
    expect(screen.queryByRole('navigation', { name: '本体工作区导航' })).not.toBeInTheDocument();
    expect(getOntologyContextSnapshot().navigation).toMatchObject({ view: 'ontology-governance' });
    expect(screen.getByRole('tab', { name: '权限策略', selected: true })).toBeVisible();
  });
});
