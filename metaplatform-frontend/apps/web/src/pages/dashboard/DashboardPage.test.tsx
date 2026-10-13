import '@douyinfe/semi-ui/react19-adapter';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage';
import * as summary from '@/api/dashboard/workbench';
import * as approvals from '@/api/dashboard/approvals';
vi.hoisted(() => { HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) })) as never; });
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Range.prototype.getBoundingClientRect = () => new DOMRect();
vi.mock('@mate/shared', () => ({ useAuth: () => ({ user: { realName: '当前人' } }) }));
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => ({ resolvedTheme: 'light' }) }));
vi.mock('@/api/dashboard/workbench', () => ({ getDashboardSummary: vi.fn() }));
vi.mock('@/api/dashboard/approvals', () => ({ getPendingTasks: vi.fn(), completeTask: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it('uses the canonical quick-link destination as a stable React key when the source has no id', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(summary.getDashboardSummary).mockResolvedValue({
    stats: [], recentTasks: [], activeAgents: [], systemHealth: [],
    quickLinks: [
      { label: 'SuperAI', icon: 'Robot', link: '/superai/chat' },
      { label: '应用中心', icon: 'AppstoreOutlined', link: '/apps' },
    ],
  });
  vi.mocked(approvals.getPendingTasks).mockResolvedValue({ items: [], total: 0 } as never);
  try {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: 'SuperAI' })).toBeVisible();
    expect(screen.getByRole('button', { name: '应用中心' })).toBeVisible();
    expect(errors.mock.calls.filter((args) => args.some((value) => String(value).includes('unique "key"')))).toEqual([]);
  } finally {
    errors.mockRestore();
  }
});
it('keeps successful summary visible and independently retries failed approvals without claiming empty', async () => {
  vi.mocked(summary.getDashboardSummary).mockResolvedValue({ stats: [{ label: '实际统计', value: '7', icon: '', trend_label: null, trend_value: null, trend_up: false }], recentTasks: [], activeAgents: [], quickLinks: [] , systemHealth: [] });
  vi.mocked(approvals.getPendingTasks).mockRejectedValueOnce(new Error('审批暂不可用')).mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
  render(<MemoryRouter><DashboardPage /></MemoryRouter>);
  expect(await screen.findByText('审批暂不可用')).toBeVisible();
  expect(screen.getByText('实际统计')).toBeVisible();
  expect(screen.queryByText('没有待办审批')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '重试审批' }));
  expect(await screen.findByText('没有待办审批')).toBeVisible();
  expect(summary.getDashboardSummary).toHaveBeenCalledTimes(1);
});
it('keeps successful approvals actionable when summary fails', async () => {
  vi.mocked(summary.getDashboardSummary).mockRejectedValue(new Error('汇总暂不可用'));
  vi.mocked(approvals.getPendingTasks).mockResolvedValue({ items: [{ taskId: 'a1', title: '实际审批', applicant: '申请人' }], total: 1 } as never);
  render(<MemoryRouter><DashboardPage /></MemoryRouter>);
  expect(await screen.findByText('汇总暂不可用')).toBeVisible();
  expect(screen.getByText('实际审批')).toBeVisible();
  expect(screen.getByRole('button', { name: '通过' })).toBeEnabled();
});
it('renders successful empty approvals without waiting for a slow summary', async () => {
  vi.mocked(summary.getDashboardSummary).mockReturnValue(new Promise(() => {}));
  vi.mocked(approvals.getPendingTasks).mockResolvedValue({ items: [], total: 0 } as never);
  render(<MemoryRouter><DashboardPage /></MemoryRouter>);
  expect(await screen.findByText('没有待办审批')).toBeVisible();
});

it('labels seeded approvals as demonstration data and uses the matching list total', async () => {
  vi.mocked(summary.getDashboardSummary).mockResolvedValue({
    stats: [{ label: '待处理审批', value: '5', icon: '', trend_label: null, trend_value: null, trend_up: false }],
    recentTasks: [], activeAgents: [], quickLinks: [], systemHealth: [],
  });
  vi.mocked(approvals.getPendingTasks).mockResolvedValue({ items: [{ taskId: 'a1', title: '演示任务', applicant: '演示申请人' }], total: 1 } as never);
  render(<MemoryRouter><DashboardPage /></MemoryRouter>);
  await waitFor(() => expect(screen.getAllByText('演示待办审批')).toHaveLength(2));
  expect(screen.queryByText('5')).toBeNull();
  expect(screen.getByText(/1 项演示审批/)).toBeVisible();
  expect(screen.queryByText(/等待你确认/)).toBeNull();
  expect(screen.queryByText('没有待办审批')).toBeNull();
});

it('keeps the newest approval snapshot when refresh responses finish out of order', async () => {
  vi.mocked(summary.getDashboardSummary).mockResolvedValue({ stats: [], recentTasks: [], activeAgents: [], quickLinks: [], systemHealth: [] });
  vi.mocked(approvals.getPendingTasks).mockResolvedValueOnce({ items: [], total: 0 } as never);
  let older!: (page: never) => void;
  let newer!: (page: never) => void;
  vi.mocked(approvals.getPendingTasks).mockImplementationOnce(() => new Promise(resolve => { older = resolve; })).mockImplementationOnce(() => new Promise(resolve => { newer = resolve; }));
  render(<MemoryRouter><DashboardPage /></MemoryRouter>);
  await screen.findByText('没有待办审批');
  fireEvent.click(screen.getByRole('button', { name: '刷新' }));
  fireEvent.click(screen.getByRole('button', { name: '刷新' }));
  await act(async () => newer({ items: [{ taskId: 'latest', title: '最新审批', applicant: '申请人' }], total: 1 } as never));
  await screen.findByText('最新审批');
  await act(async () => older({ items: [{ taskId: 'old', title: '旧审批', applicant: '申请人' }], total: 2 } as never));
  expect(screen.queryByText('旧审批')).toBeNull();
  expect(screen.getByText(/1 项演示审批/)).toBeVisible();
});

it('blocks repeated submissions per task while other approvals are in flight and reloads the provider total', async () => {
  vi.mocked(summary.getDashboardSummary).mockResolvedValue({ stats: [], recentTasks: [], activeAgents: [], quickLinks: [], systemHealth: [] });
  const tasks = [{ taskId: 'a1', title: '审批 A', applicant: '申请人' }, { taskId: 'a2', title: '审批 B', applicant: '申请人' }];
  vi.mocked(approvals.getPendingTasks).mockResolvedValueOnce({ items: tasks, total: 2 } as never).mockResolvedValue({ items: [], total: 0 } as never);
  let finishA!: () => void;
  let finishB!: () => void;
  vi.mocked(approvals.completeTask).mockImplementation(id => new Promise<void>(resolve => { if (id === 'a1') finishA = resolve; else finishB = resolve; }));
  render(<MemoryRouter><DashboardPage /></MemoryRouter>);
  const rowA = (await screen.findByText('审批 A')).closest('.mp-home-todo') as HTMLElement;
  const rowB = screen.getByText('审批 B').closest('.mp-home-todo') as HTMLElement;
  fireEvent.click(within(rowA).getByRole('button', { name: '通过' }));
  fireEvent.click(within(rowB).getByRole('button', { name: '通过' }));
  fireEvent.click(within(rowA).getByRole('button', { name: '通过' }));
  expect(approvals.completeTask).toHaveBeenCalledTimes(2);
  await act(async () => { finishA(); finishB(); });
  await waitFor(() => expect(approvals.getPendingTasks).toHaveBeenCalledTimes(3));
  expect(await screen.findByText('没有待办审批')).toBeVisible();
  expect(screen.getByText(/暂无演示待办审批/)).toBeVisible();
});
