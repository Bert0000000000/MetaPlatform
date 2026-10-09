import '@testing-library/jest-dom/vitest';
import '@douyinfe/semi-ui/react19-adapter';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getServer, getServerStatus, listServers } from '@/api/mcphub/servers';
import ServerDetailPage from './ServerDetailPage';
import ServerListPage from './McpServerPage';
import ServerDrawer from './components/ServerDrawer';

const transport = vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  return { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
});
// Only HTTP and user settings are external; the adapters, pages and Semi forms stay real.
vi.mock('@mate/shared/api', () => ({ createApiClient: () => transport, apiPath: () => '/api/v1/mcp' }));
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => ({ resolvedTheme: 'light' }) }));

// The exact DTO fields emitted by extras_routes.get_server/get_server_status.
const catalogServer = {
  id: 'srv-ontology-engine', name: 'Ontology Engine', description: 'registered agent',
  transportType: 'MCP', status: 'online', endpoint: 'http://ontology-engine/mcp',
  lastConnectedAt: '', createdAt: '2026-10-09T00:00:00Z',
};
const unknownStatus = {
  id: catalogServer.id, status: 'unknown', lastCheckedAt: '2026-10-09T01:00:00Z',
  uptimeSec: 0, requestCount: 0, errorRate: 0,
};
const registeredTools = [{ name: 'ontology_get_class', description: 'registry tool', inputSchema: {} }];
// Preserve compatibility with records that actually provide the old management fields.
const managedServer = {
  ...catalogServer, code: 'ontology_engine', transport: 'sse', toolIds: ['ontology_get_class'],
  enabled: true, authType: 'apikey', authConfig: '{"keyRef":"source-ref"}',
};
const measuredStatus = {
  status: 'ACTIVE', connectionStatus: 'online', lastHeartbeatAt: '2026-10-09T01:00:00Z',
  responseTimeMs: 12,
};

let serverResponse: typeof catalogServer | typeof managedServer;
let statusResponse: typeof unknownStatus | typeof measuredStatus;

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {} }));
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  serverResponse = catalogServer;
  statusResponse = unknownStatus;
  transport.get.mockImplementation(async (path: string) => {
    if (path === '/servers') return { data: { items: [serverResponse], total: 1 } };
    if (path === `/servers/${catalogServer.id}`) return { data: serverResponse };
    if (path === `/servers/${catalogServer.id}/status`) return { data: statusResponse };
    if (path === '/tools') return { data: { tools: registeredTools } };
    throw new Error(`Unexpected GET ${path}`);
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function renderDetail() {
  await act(async () => {
    render(<MemoryRouter initialEntries={[`/ki/mcp/servers/${catalogServer.id}`]}>
      <Routes><Route path="/ki/mcp/servers/:id" element={<ServerDetailPage />} /></Routes>
    </MemoryRouter>);
  });
}
async function selectTab(name: string) {
  await act(async () => { fireEvent.click(screen.getByRole('tab', { name })); });
}
function RouteLocation() {
  return <output data-testid="route-location">{useLocation().pathname}</output>;
}
async function renderList(path = '/ki/mcp/servers') {
  await act(async () => {
    render(<MemoryRouter initialEntries={[path]}><ServerListPage /><RouteLocation /></MemoryRouter>);
  });
}
function expectNoWrites() {
  expect(transport.post).not.toHaveBeenCalled();
  expect(transport.put).not.toHaveBeenCalled();
  expect(transport.delete).not.toHaveBeenCalled();
}

describe('MCP server directory DTO boundaries', () => {
  it('preserves list/detail/status fields without fabricating management data or measurements', async () => {
    expect((await listServers()).items).toEqual([catalogServer]);
    const server = await getServer(catalogServer.id);
    expect(server).toEqual(catalogServer);
    for (const field of ['code', 'transport', 'toolIds', 'toolCount', 'enabled', 'authType']) {
      expect(server).not.toHaveProperty(field);
    }
    const status = await getServerStatus(catalogServer.id);
    expect(status).toEqual(unknownStatus);
    expect(status).not.toHaveProperty('connectionStatus');
    expect(status).not.toHaveProperty('lastHeartbeatAt');
    expect(status).not.toHaveProperty('responseTimeMs');
  });

  it('renders the real agent protocol and marks omitted configuration instead of crashing or inventing it', async () => {
    await renderDetail();
    expect(screen.getByRole('heading', { name: catalogServer.name })).toBeVisible();
    expect(screen.getByText('MCP')).toBeVisible();
    expect(screen.getByText(catalogServer.endpoint)).toBeVisible();
    expect(screen.getByText('在线')).toBeVisible();
    expect(screen.queryByText('none')).not.toBeInTheDocument();
    expect(screen.queryByText('未启用')).not.toBeInTheDocument();
    expect(screen.getAllByText('未提供').length).toBeGreaterThanOrEqual(4);
  });

  it('distinguishes absent tool associations from a confirmed empty association', async () => {
    await renderDetail();
    await selectTab('工具列表');
    expect(screen.queryByText('工具关联未提供')).toBeVisible();
    expect(screen.queryByText('该 Server 未暴露任何工具')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('ontology_get_class')).not.toBeInTheDocument();
  });

  it('renders the real unknown status without assuming a connection state or absent heartbeat', async () => {
    // Isolate the status contract from the independently tested missing-association case.
    serverResponse = { ...managedServer, toolIds: [] };
    await renderDetail();
    await selectTab('连接状态 / 日志');
    expect(screen.queryByText('实时连接状态未知')).toBeVisible();
    expect(screen.getByText('unknown')).toBeVisible();
    expect(screen.queryByText('无')).not.toBeInTheDocument();
    expect(within(screen.getByRole('tabpanel')).queryByText('0')).not.toBeInTheDocument();
    expect(screen.getAllByText('未提供').length).toBeGreaterThanOrEqual(2);
  });

  it('continues to show provided associations and real connection measurements', async () => {
    serverResponse = managedServer;
    statusResponse = measuredStatus;
    await renderDetail();
    expect(screen.getByText('sse')).toBeVisible();
    expect(screen.getByText('apikey')).toBeVisible();
    expect(screen.getByText('已启用')).toBeVisible();
    await selectTab('工具列表');
    expect(screen.getAllByText('ontology_get_class')[0]).toBeVisible();
    expect(screen.queryByText('工具关联未提供')).not.toBeInTheDocument();
    await selectTab('连接状态 / 日志');
    expect(screen.getByText('12')).toBeVisible();
    expect(screen.queryByText('实时连接状态未知')).not.toBeInTheDocument();
  });

  it('shows an empty association only when toolIds is explicitly empty', async () => {
    serverResponse = { ...managedServer, toolIds: [] };
    await renderDetail();
    await selectTab('工具列表');
    expect(screen.getByText('该 Server 未暴露任何工具')).toBeVisible();
    expect(screen.queryByText('工具关联未提供')).not.toBeInTheDocument();
  });

  it('keeps the edit drawer readable while blocking save of incomplete management configuration', async () => {
    await act(async () => {
      render(<ServerDrawer open serverId={catalogServer.id} availableTools={[]} onClose={vi.fn()} onSaved={vi.fn()} />);
    });
    expect(screen.getByDisplayValue(catalogServer.name)).toBeVisible();
    expect(screen.getByDisplayValue(catalogServer.endpoint)).toBeVisible();
    expect(screen.queryByText('服务目录未提供完整管理配置，暂不能保存。')).toBeVisible();
    expect(screen.queryByText('目录协议：MCP')).toBeVisible();
    expect(screen.queryByText('目录未提供工具关联')).toBeVisible();
    expect(screen.queryByText('目录未提供启用配置')).toBeVisible();
    expect(screen.queryByText('无')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    const save = screen.getByRole('button', { name: '保存' });
    expect(save).toBeDisabled();
    await act(async () => { fireEvent.click(save); });
    expect(transport.put).not.toHaveBeenCalled();
    expect(transport.post).not.toHaveBeenCalled();
  });

  it('preserves explicit creation defaults and replaces them when switching to an incomplete directory record', async () => {
    let view!: ReturnType<typeof render>;
    const props = { open: true, availableTools: [], onClose: vi.fn(), onSaved: vi.fn() };
    await act(async () => { view = render(<ServerDrawer {...props} serverId={null} />); });
    expect(screen.getByRole('switch')).toBeChecked();
    expect(screen.getByText('无')).toBeVisible();
    expect(screen.getByRole('button', { name: '创建' })).toBeDisabled();
    expect(screen.queryByText('Server 表单仅供审阅，尚未接入保存。')).toBeVisible();
    await act(async () => { view.rerender(<ServerDrawer {...props} serverId={catalogServer.id} />); });
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByText('无')).not.toBeInTheDocument();
    expect(screen.queryByText('目录未提供工具关联')).toBeVisible();
  });

  it('keeps complete management records readable without enabling unsupported writes or overwriting their configuration', async () => {
    serverResponse = managedServer;
    await act(async () => {
      render(<ServerDrawer open serverId={catalogServer.id}
        availableTools={[{ id: 'ontology_get_class', name: 'ontology_get_class' }]}
        onClose={vi.fn()} onSaved={vi.fn()} />);
    });
    const save = screen.getByRole('button', { name: '保存' });
    expect(save).toBeDisabled();
    await act(async () => { fireEvent.click(save); });
    expectNoWrites();
    expect(screen.getByDisplayValue(managedServer.code)).toBeVisible();
    expect(screen.getByText('API Key')).toBeVisible();
    expect(screen.getByDisplayValue(managedServer.authConfig)).toBeVisible();
    expect(screen.getByText('ontology_get_class')).toBeVisible();
    expect(screen.getByRole('switch')).toBeChecked();
    expect(screen.queryByText('服务目录未提供完整管理配置，暂不能保存。')).not.toBeInTheDocument();
  });

  it.each(['online', 'offline'])('keeps directory detail %s readable while disabling every unsupported write', async (status) => {
    serverResponse = { ...catalogServer, status };
    await renderDetail();
    expect(screen.queryByText('服务目录管理未接入')).toBeVisible();
    const stateAction = screen.getByRole('button', { name: status === 'offline' ? /启动$/ : /停止$/ });
    const restart = screen.getByRole('button', { name: /重启$/ });
    const remove = screen.getByRole('button', { name: /删除$/ });
    expect(stateAction).toBeDisabled();
    expect(restart).toBeDisabled();
    expect(remove).toBeDisabled();
    await act(async () => { fireEvent.click(stateAction); fireEvent.click(restart); fireEvent.click(remove); });
    expect(screen.queryByText('确定重启该 Server？')).not.toBeInTheDocument();
    expect(screen.queryByText('确定删除？')).not.toBeInTheDocument();
    expectNoWrites();
  });

  it.each(['online', 'offline'])('shows an omitted directory tool count as unknown and blocks list %s writes', async (status) => {
    serverResponse = { ...catalogServer, status };
    await renderList();
    const row = screen.getByText(catalogServer.name).closest('tr')!;
    expect(within(row).getByText('未提供')).toBeVisible();
    expect(within(row).queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByText('服务目录管理未接入')).toBeVisible();
    const create = screen.getByRole('button', { name: /创建 Server$/ });
    const stateAction = within(row).getByRole('button', { name: status === 'offline' ? /启动$/ : /停止$/ });
    const remove = within(row).getByRole('button', { name: /删除$/ });
    expect(create).toBeDisabled();
    expect(stateAction).toBeDisabled();
    expect(remove).toBeDisabled();
    await act(async () => { fireEvent.click(create); fireEvent.click(stateAction); fireEvent.click(remove); });
    expect(screen.getByTestId('route-location')).toHaveTextContent('/ki/mcp/servers');
    expect(screen.getByTestId('route-location')).not.toHaveTextContent('/new');
    expect(screen.queryByText('确定删除？')).not.toBeInTheDocument();
    expectNoWrites();
  });

  it('preserves an explicitly returned zero tool count', async () => {
    serverResponse = { ...managedServer, toolCount: 0 } as typeof managedServer;
    await renderList();
    const row = screen.getByText(catalogServer.name).closest('tr')!;
    expect(within(row).getByText('0')).toBeVisible();
    expect(within(row).queryByText('未提供')).not.toBeInTheDocument();
  });

  it('keeps the direct new-server form reviewable without posting to an unregistered endpoint', async () => {
    await renderList('/ki/mcp/servers/new');
    expect(screen.queryByText('Server 表单仅供审阅，尚未接入保存。')).toBeVisible();
    const create = screen.getByRole('button', { name: '创建' });
    expect(create).toBeDisabled();
    await act(async () => {
      fireEvent.change(screen.getByRole('textbox', { name: /名称/ }), { target: { value: 'Review Server' } });
      fireEvent.change(screen.getByRole('textbox', { name: /编码/ }), { target: { value: 'review_server' } });
      fireEvent.change(screen.getByRole('textbox', { name: /访问端点/ }), { target: { value: 'https://example.test/mcp' } });
    });
    await act(async () => { fireEvent.click(create); });
    expectNoWrites();
    expect(screen.getByTestId('route-location')).toHaveTextContent('/ki/mcp/servers/new');
  });
});
