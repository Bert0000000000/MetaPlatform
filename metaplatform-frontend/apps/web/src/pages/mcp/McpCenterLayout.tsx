import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppstoreOutlined, ApiOutlined, TeamOutlined } from '@ant-design/icons';
import { PageRoot, SubTabs } from '@mate/shared';

/**
 * MCP 服务中心三 HUB 布局：SKILL HUB / MCP HUB / A2A 注册中心。
 *
 * - SKILL HUB：公开 SKILL 上传/下载/安装
 * - MCP HUB：MCP Server 状态与调度（工具/权限/审计/监控）
 * - A2A 注册中心：内部数字员工 + 外部 Agent 发现
 *
 * 归组与 `platformMenu.ts` 的 mcphub.group 保持一致（skill / mcp / a2a）。
 */
const GROUPS = [
  { key: 'skill', label: 'SKILL HUB', icon: <AppstoreOutlined />, path: '/mcp/skill-hub' },
  { key: 'mcp', label: 'MCP HUB', icon: <ApiOutlined />, path: '/mcp/overview' },
  { key: 'a2a', label: 'A2A 注册中心', icon: <TeamOutlined />, path: '/mcp/internal-agents' },
];

/** 根据当前 pathname 反查所属 tab。 */
function groupForPath(pathname: string): string {
  if (
    pathname.startsWith('/mcp/overview') ||
    pathname.startsWith('/mcp/tools') ||
    pathname.startsWith('/mcp/servers') ||
    pathname.startsWith('/mcp/clients') ||
    pathname.startsWith('/mcp/debugger') ||
    pathname.startsWith('/mcp/resources') ||
    pathname.startsWith('/mcp/prompts') ||
    pathname.startsWith('/mcp/permissions') ||
    pathname.startsWith('/mcp/policies') ||
    pathname.startsWith('/mcp/matrix') ||
    pathname.startsWith('/mcp/audit') ||
    pathname.startsWith('/mcp/connection-monitor') ||
    pathname.startsWith('/mcp/ide-config')
  ) {
    return 'mcp';
  }
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
  return 'skill'; // /mcp/skill-hub + anything else
}

export default function McpCenterLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const active = groupForPath(location.pathname);

  const subTabs = GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    icon: g.icon,
    path: g.path,
    activePath: g.path,
  }));

  const stickyHeader = (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        height: 64,
        padding: '0 24px',
        background: 'var(--background)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      <div style={{ flex: 1, minWidth: 0, overflowX: 'auto', overflowY: 'hidden' }}>
        <SubTabs items={subTabs} activePath={subTabs.find((t) => t.key === active)?.path ?? '/mcp/skill-hub'} embedded />
      </div>
    </div>
  );

  return (
    <PageRoot header={stickyHeader}>
      <Outlet />
    </PageRoot>
  );
}
