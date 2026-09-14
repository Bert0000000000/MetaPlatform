import { Outlet, useLocation } from 'react-router-dom';
import { AppstoreOutlined, ApiOutlined, TeamOutlined } from '@ant-design/icons';
import { AIAssistantTrigger, AIAssistantWorkspace, PageRoot, SubTabs, type SubTabItem, usePageAssistant } from '@mate/shared';

/**
 * MCP 服务中心：三 HUB 顶层 SubTabs + 当前 HUB 的二级细分 SubTabs。
 * 侧边栏只保留一级「MCP 中心」，HUB 内细分页导航全部移到此处（两层 SubTabs）。
 *
 * UI-P0 起本组件同时服务「知识与集成」域的两条路径：
 * `/ki/mcp`（MCP HUB 为主）与 `/ki/a2a`（A2A 注册中心为主），由 basePath / initialHub 区分。
 */
export interface McpCenterLayoutProps {
  /** 该挂载点的路径前缀 */
  basePath?: string;
  /** 路径未命中任何 HUB 时的兜底 HUB */
  initialHub?: 'skill' | 'mcp' | 'a2a';
}

const A2A_SEGMENTS = [
  'internal-agents',
  'external-agents',
  'a2a-guide',
  'integrations',
  'trusts',
  'collaborations',
  'external',
];

export default function McpCenterLayout({
  basePath = '/mcp',
  initialHub = 'mcp',
}: McpCenterLayoutProps = {}) {
  const location = useLocation();

  const hubGroups = [
    { key: 'skill', label: 'SKILL HUB', icon: <AppstoreOutlined />, path: `${basePath}/skill-hub` },
    { key: 'mcp', label: 'MCP HUB', icon: <ApiOutlined />, path: `${basePath}/overview` },
    { key: 'a2a', label: 'A2A 注册中心', icon: <TeamOutlined />, path: `${basePath}/internal-agents` },
  ];

  const hubSubTabs: Record<string, SubTabItem[]> = {
    mcp: [
      { label: '总览', path: `${basePath}/overview` },
      { label: '工具', path: `${basePath}/tools` },
      { label: '资源', path: `${basePath}/resources` },
      { label: '提示词', path: `${basePath}/prompts` },
      { label: '调试器', path: `${basePath}/debugger` },
      { label: 'IDE 配置', path: `${basePath}/ide-config` },
      { label: '服务端', path: `${basePath}/servers` },
      { label: '客户端', path: `${basePath}/clients` },
      { label: '权限', path: `${basePath}/permissions` },
      { label: '策略', path: `${basePath}/policies` },
      { label: '审计', path: `${basePath}/audit` },
      { label: '连接监控', path: `${basePath}/connection-monitor` },
    ],
    a2a: [
      { label: '内部 Agent', path: `${basePath}/internal-agents` },
      { label: '外部 Agent', path: `${basePath}/external-agents` },
      { label: '接入说明', path: `${basePath}/a2a-guide` },
    ],
    skill: [],
  };

  /** pathname → 所属 HUB */
  const groupForPath = (pathname: string): string => {
    if (A2A_SEGMENTS.some((seg) => pathname.includes(`/${seg}`))) return 'a2a';
    if (pathname.includes('/skill-hub')) return 'skill';
    if (pathname === basePath || pathname.startsWith(`${basePath}/`)) return 'mcp';
    return initialHub;
  };

  const assistant = usePageAssistant({
    employeeId: 'mcp-tool-specialist',
    employeeName: 'MCP 工具专家',
    employeeDescription: '帮助你管理 MCP 服务、工具、权限和连接状态',
    moduleLabel: 'MCP Center',
    welcomeMessage: '你好，我是 MCP 工具专家。可以协助你发现和治理工具能力。',
    suggestions: ['检查 MCP 服务健康状态', '分析工具权限配置', '查找最近的连接异常'],
  });
  const active = groupForPath(location.pathname);
  const activeHubPath = hubGroups.find((g) => g.key === active)?.path ?? `${basePath}/skill-hub`;
  const primaryItems: SubTabItem[] = hubGroups.map((g) => ({
    label: g.label,
    path: g.path,
    icon: g.icon,
    activePath: g.path,
  }));
  const secondary = hubSubTabs[active] ?? [];

  const header = (
    <div style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
      <div style={{ padding: '0 24px' }}>
        <SubTabs items={primaryItems} activePath={activeHubPath} embedded />
      </div>
      {secondary.length > 1 && (
        <div style={{ padding: '0 24px', borderTop: '1px solid var(--border)' }}>
          <SubTabs items={secondary} activePath={location.pathname} embedded />
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 24px 8px' }}>
        <AIAssistantTrigger open={assistant.isOpen} onClick={assistant.toggle} />
      </div>
    </div>
  );

  return (
    <PageRoot header={header}>
      <AIAssistantWorkspace assistant={assistant}>
        <Outlet />
      </AIAssistantWorkspace>
    </PageRoot>
  );
}
