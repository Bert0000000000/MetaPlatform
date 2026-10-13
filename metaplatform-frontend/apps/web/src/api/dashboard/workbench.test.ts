import { afterEach, expect, it, vi } from 'vitest';
const wire = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@mate/shared/api', () => ({ createApiClient: () => wire, apiPath: () => '/api/v1/dashboard' }));
import { getDashboardSummary } from './workbench';
afterEach(() => vi.resetAllMocks());

it('renders the deployed summary contract as employee status, task counts and metric trends', async () => {
  wire.get.mockResolvedValue({ data: {
    stats: [{ label: '今日任务', value: 234, delta: '+18%', trend: 'up' }],
    recentTasks: [{ name: '审核', type: '审批', agent: '审核员', status: 'failed', time: '刚刚' }],
    activeAgents: [{ name: '审核员', type: '审核型', taskCount: 8, status: 'busy' }],
    quickLinks: [{ label: '本体引擎', icon: 'ApartmentOutlined', link: '/ontology' }],
    systemHealth: [],
  } });
  const summary = await getDashboardSummary();
  expect(summary.activeAgents[0]).toMatchObject({ tasks: 8, status_label: '忙碌' });
  expect(summary.stats[0]).toMatchObject({ value: '234', trend_value: '+18%', trend_up: true });
  expect(summary.recentTasks[0].type_label).toBe('审批');
  expect(summary.quickLinks[0].label).toBe('本体工作室');
});

it('renders an unknown employee status explicitly instead of an empty badge', async () => {
  wire.get.mockResolvedValue({ data: { stats: [], recentTasks: [], activeAgents: [{ name: '未连接员工', type: '审核型' }], quickLinks: [], systemHealth: [] } });
  expect((await getDashboardSummary()).activeAgents[0].status_label).toBe('状态未知');
});
