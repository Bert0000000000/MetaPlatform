import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import AppShell from './AppShell';
import OntologyTabLayout, { ModelValidationAliasRoute } from '@/pages/ontology/layout/OntologyTabLayout';
import { getOntologyContextSnapshot } from '@/pages/ontology/hooks/assistantContext';
import { streamAgentChat } from '@/api/superai/chat';
import { buildNavigationIndex } from './domains';

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
vi.mock('@/api/superai/chat', () => ({ streamAgentChat: vi.fn().mockResolvedValue(undefined) }));

beforeEach(() => {
  vi.stubGlobal('localStorage', window.localStorage);
  localStorage.clear();
  vi.clearAllMocks();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  Range.prototype.getBoundingClientRect = () => new DOMRect();
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
        { path: 'governance/lint', element: <ModelValidationAliasRoute /> },
        { path: '*', element: <h1>本体资源内容</h1> },
      ] },
      { path: '/home/*', element: <h1>工作台内容</h1> },
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
    expect(within(nav).queryByRole('link', { name: '概览' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '业务模型' })).toHaveAttribute('aria-current', 'true');
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
    const firstLink = within(nav).getByRole('link', { name: '模型工作台' });
    expect(firstLink).toHaveFocus();
    fireEvent.keyDown(firstLink, { key: 'Enter' });
    fireEvent.click(firstLink, { detail: 0 });
    expect(router.state.location.pathname).toBe('/ontology/model/graph');
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
    expect(screen.getByRole('link', { name: '概览' })).toBeVisible();
    expect(screen.getByRole('link', { name: '待办' })).toBeVisible();
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
    expect(screen.getByRole('link', { name: '对象浏览' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'ObjectSet 构建器' })).toBeVisible();
    expect(getOntologyContextSnapshot().navigation).toMatchObject({ view: 'ontology-explore', tab: 'explore' });
    fireEvent.click(screen.getByRole('button', { name: '切换导航布局' }));
    const topNav = document.querySelector('.mp-topnav') as HTMLElement;
    expect(within(topNav).getAllByRole('tab').map(tab => tab.textContent)).toEqual(labels);
    fireEvent.click(within(topNav).getByRole('tab', { name: '治理与管理' }));
    expect(router.state.location.pathname).toBe('/gov/business');
    expect(screen.getByRole('link', { name: '组织' })).toBeVisible();
  });

  it('SuperAI 常驻控件可打开 Copilot 和完整会话，不占产品菜单', () => {
    const router = renderShell('/home');
    expect(screen.queryByRole('menuitem', { name: 'SuperAI' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '打开 SuperAI Copilot' }));
    expect(document.getElementById('app')).toHaveAttribute('data-copilot', 'open');
    fireEvent.click(screen.getByRole('button', { name: '打开 SuperAI 会话' }));
    expect(router.state.location.pathname).toBe('/superai/chat');
    expect(screen.getByRole('heading', { name: '完整 SuperAI 会话' })).toBeVisible();
    expect(screen.getByRole('link', { name: '会话' })).toHaveAttribute('aria-current', 'page');
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
    const pages = screen.getByRole('navigation', { name: '工作区页面导航' });
    expect(within(pages).getByRole('link', { name: '权限策略' })).toHaveAttribute('aria-current', 'page');
  });

  it('对象探索的全局 Copilot 请求保留域壳语义与打开记录', async () => {
    renderShell('/ontology/explore/objects/ont.t.obj.customer.1?class=ont.t.obj.customer.v1');
    fireEvent.click(screen.getByRole('button', { name: '打开 SuperAI Copilot' }));
    fireEvent.change(screen.getByRole('textbox', { name: '向 SuperAI 提问' }), { target: { value: '解释当前对象' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '发送' })); });
    expect(vi.mocked(streamAgentChat).mock.calls[0]?.[3]).toMatchObject({ context: {
      navigation: { view: 'ontology-explore', tab: 'explore',
        url: '/ontology/explore/objects/ont.t.obj.customer.1?class=ont.t.obj.customer.v1',
        openRecordIds: ['ont.t.obj.customer.1'] },
    } });
  });

  it('命令搜索可直接进入完整 SuperAI 会话', async () => {
    const router = renderShell('/ontology/model/graph');
    fireEvent.click(screen.getByRole('textbox', { name: '打开命令面板' }));
    const search = await screen.findByPlaceholderText('搜索对象、数字员工、应用，或输入命令…');
    fireEvent.change(search, { target: { value: '会话' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(router.state.location.pathname).toBe('/superai/chat');
  });

  it('旧模型检查路径通过真实别名组件进入同一校验页并保留查询与片段', async () => {
    const router = renderShell('/ontology/governance/lint?typeRef=ont.t.obj.customer.v1&class=legacy#findings');
    await act(async () => {});
    expect(router.state.location.pathname).toBe('/ontology/model/validation');
    expect(router.state.location.search).toBe('?typeRef=ont.t.obj.customer.v1&class=legacy');
    expect(router.state.location.hash).toBe('#findings');
    expect(screen.getByRole('navigation', { name: '本体上下文' })).toHaveTextContent('运行与质量');
    expect(screen.getByRole('link', { name: '模型校验' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('全平台同源功能组与页面导航', () => {
  it.each([
    ['/home/aiops', '我的工作', '智能运维'],
    ['/apps/order-review?order=one#report', '应用建设', '订单评审'],
    ['/ontology/explore/objects/ont.t.obj.one?class=type#record', '对象探索', '对象浏览'],
    ['/ontology/model/object-types/ont.t.obj.customer.v1/properties', '业务模型', '对象类型'],
    ['/ontology/data/sync', '运行与质量', '同步任务'],
    ['/ontology/governance/lint?class=type#findings', '运行与质量', '模型校验'],
    ['/agents/dw-tasks', '任务与协作', '员工任务'],
    ['/agents/learning', '学习与运行', '学习管理'],
    ['/ki/mcp/resources/one', 'MCP 工具', '资源'],
    ['/ki/a2a/internal-agents', 'A2A', '内部智能体'],
    ['/gov/business/applications', '业务架构', '应用系统'],
    ['/admin/platform/ai-providers', '平台', 'AI Provider'],
    ['/ontology/governance/security', '权限策略', '权限策略'],
    ['/superai/plans/result-summary', '执行计划', '结果汇总'],
    ['/superai/schedules/plan', '意图与调度', '调度计划'],
    ['/superai/cost/report', '成本优化', '报告导出'],
    ['/superai/team', '目标与会话', '团队运行'],
  ])('深链 %s 选择真实组 %s 与页面 %s，不跳首项', async (path, group, page) => {
    const router = renderShell(path);
    await act(async () => {});
    const groups = screen.getByRole('navigation', { name: '工作区功能组' });
    expect(within(groups).getByRole('link', { name: group })).toHaveAttribute('aria-current', 'true');
    const pages = screen.getByRole('navigation', { name: /工作区导航|工作区页面导航/ });
    expect(within(pages).getByRole('link', { name: page })).toHaveAttribute('aria-current', 'page');
    if (!path.includes('/lint')) {
      expect(`${router.state.location.pathname}${router.state.location.search}${router.state.location.hash}`).toBe(path);
    }
    expect(document.querySelectorAll('.mp-workspace-pages')).toHaveLength(1);
    expect(document.querySelector('.mp-onto-sidenav')).not.toBeInTheDocument();
  });

  it('组切换打开真实首个页面，页面导航只呈现当前组，返回恢复深链', async () => {
    const router = renderShell('/ontology/model/object-types/one/properties?typeRef=one#properties');
    const groups = screen.getByRole('navigation', { name: '工作区功能组' });
    fireEvent.click(within(groups).getByRole('link', { name: '运行与质量' }));
    expect(router.state.location.pathname).toBe('/ontology/data/sync');
    const pages = screen.getByRole('navigation', { name: '本体工作区导航' });
    expect(within(pages).queryByRole('link', { name: '对象类型' })).not.toBeInTheDocument();
    expect(within(pages).getByRole('link', { name: '模型校验' })).toBeVisible();
    await act(() => router.navigate(-1));
    expect(within(pages).getByRole('link', { name: '对象类型' })).toHaveAttribute('aria-current', 'page');
    expect(router.state.location.search).toBe('?typeRef=one');
    expect(router.state.location.hash).toBe('#properties');
  });

  it('治理组入口直接打开真实页面，避免不存在的组根', () => {
    const router = renderShell('/gov/business');
    fireEvent.click(within(screen.getByRole('navigation', { name: '工作区功能组' })).getByRole('link', { name: '平台' }));
    expect(router.state.location.pathname).toBe('/admin/platform/configs');
  });

  it('窄导航展开、Escape 与选择恢复按钮；桌面选择不偷走焦点', () => {
    renderShell('/ki/mcp/tools');
    const toggle = screen.getByRole('button', { name: '展开页面导航' });
    fireEvent.click(toggle);
    const nav = screen.getByRole('navigation', { name: '工作区页面导航' });
    const first = within(nav).getAllByRole('link')[0];
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: 'Escape' });
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    fireEvent.click(within(nav).getByRole('link', { name: '服务器' }));
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const page = within(nav).getByRole('link', { name: '客户端' });
    page.focus();
    fireEvent.click(page);
    expect(page).toHaveFocus();
  });

  it('单组仍可发现全部真实页面；命令索引含长尾页面与组关键词', () => {
    renderShell('/home');
    expect(within(screen.getByRole('navigation', { name: '工作区功能组' })).getAllByRole('link')).toHaveLength(1);
    const pages = screen.getByRole('navigation', { name: '工作区页面导航' });
    expect(within(pages).getByRole('link', { name: '门户' })).toHaveAttribute('href', '/home/portal');
    const index = buildNavigationIndex();
    for (const path of ['/home/aiops', '/apps/order-review', '/agents/extraction', '/ki/mcp/resources', '/ki/mcp/skill-hub', '/superai/plans/result-summary', '/superai/team', '/admin/flowgram']) {
      expect(index.some(entry => entry.path === path), path).toBe(true);
    }
    expect(index.find(entry => entry.path === '/superai/plans/result-summary')?.keywords).toContain('执行计划');
  });
});
