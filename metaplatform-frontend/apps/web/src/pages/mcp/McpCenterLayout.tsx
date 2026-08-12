import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Tabs } from '@douyinfe/semi-ui';
import { ApiOutlined, AppstoreOutlined, TeamOutlined } from '@ant-design/icons';

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

  const onTabChange = (key: string) => {
    const group = GROUPS.find((g) => g.key === key);
    if (group && group.path !== location.pathname) {
      navigate(group.path);
    }
  };

  return (
    <div className="mcp-center-layout">
      <Tabs
        activeKey={active}
        onChange={onTabChange}
        tabList={GROUPS.map((g) => ({
          itemKey: g.key,
          tab: (
            <span>
              {g.icon} {g.label}
            </span>
          ),
        }))}
        style={{ marginBottom: 16 }}
      />
      <Outlet />
    </div>
  );
}
