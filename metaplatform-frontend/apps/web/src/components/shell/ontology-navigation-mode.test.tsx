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
    expect(within(nav).getByRole('link', { name: '总览' })).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('tab', { name: '语义模型' })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '本体上下文' })).toHaveTextContent('语义模型');
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
    const firstLink = within(nav).getByRole('link', { name: '总览' });
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
});
