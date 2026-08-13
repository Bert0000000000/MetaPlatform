import { Outlet, useLocation } from 'react-router-dom';
import { AppstoreOutlined, ApiOutlined, TeamOutlined } from '@ant-design/icons';
import { PageRoot, SubTabs, type SubTabItem } from '@mate/shared';

/**
 * MCP 服务中心：三 HUB 顶层 SubTabs + 当前 HUB 的二级细分 SubTabs。
 * 侧边栏只保留一级「MCP 中心」，HUB 内细分页导航全部移到此处（两层 SubTabs）。
 */
const HUB_GROUPS: Array<{ key: string; label: string; icon: React.ReactNode; path: string }> = [
  { key: 'skill', label: 'SKILL HUB', icon: <AppstoreOutlined />, path: '/mcp/skill-hub' },
  { key: 'mcp', label: 'MCP HUB', icon: <ApiOutlined />, path: '/mcp/overview' },
  { key: 'a2a', label: 'A2A 注册中心', icon: <TeamOutlined />, path: '/mcp/internal-agents' },
];

const HUB_SUBTABS: Record<string, SubTabItem[]> = {
  mcp: [
    { label: '总览', path: '/mcp/overview' },
    { label: '工具', path: '/mcp/tools' },
    { label: '资源', path: '/mcp/resources' },
    { label: '提示词', path: '/mcp/prompts' },
    { label: '调试器', path: '/mcp/debugger' },
    { label: 'IDE 配置', path: '/mcp/ide-config' },
    { label: '服务端', path: '/mcp/servers' },
    { label: '客户端', path: '/mcp/clients' },
    { label: '权限', path: '/mcp/permissions' },
    { label: '策略', path: '/mcp/policies' },
    { label: '审计', path: '/mcp/audit' },
    { label: '连接监控', path: '/mcp/connection-monitor' },
  ],
  a2a: [
    { label: '内部 Agent', path: '/mcp/internal-agents' },
    { label: '外部 Agent', path: '/mcp/external-agents' },
  ],
  skill: [],
};

/** pathname → 所属 HUB */
function groupForPath(pathname: string): string {
  if (
    pathname.startsWith('/mcp/internal-agents') ||
    pathname.startsWith('/mcp/external-agents') ||
    pathname.startsWith('/mcp/integrations') ||
    pathname.startsWith('/mcp/trusts') ||
    pathname.startsWith('/mcp/collaborations') ||
    pathname.startsWith('/mcp/external')
  ) {
    return 'a2a';
  }
  if (pathname.startsWith('/mcp/skill-hub')) return 'skill';
  return 'mcp';
}

export default function McpCenterLayout() {
  const location = useLocation();
  const active = groupForPath(location.pathname);
  const activeHubPath = HUB_GROUPS.find((g) => g.key === active)?.path ?? '/mcp/skill-hub';
  const primaryItems: SubTabItem[] = HUB_GROUPS.map((g) => ({
    label: g.label,
    path: g.path,
    icon: g.icon,
    activePath: g.path,
  }));
  const secondary = HUB_SUBTABS[active] ?? [];

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
    </div>
  );

  return (
    <PageRoot header={header}>
      <Outlet />
    </PageRoot>
  );
}
