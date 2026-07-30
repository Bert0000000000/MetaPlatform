/** MCP module routes. */
import { lazy } from 'react';
import { ErrorBoundary } from '@mate/shared';

const McpToolsPage = lazy(() => import('../pages/mcp/ToolsPage'));
const McpServerPage = lazy(() => import('../pages/mcp/ServerPage'));
const McpClientPage = lazy(() => import('../pages/mcp/ClientPage'));
const McpDebuggerPage = lazy(() => import('../pages/mcp/DebuggerPage'));
const McpPermissionsPage = lazy(() => import('../pages/mcp/PermissionsPage'));
const McpExternalPage = lazy(() => import('../pages/mcp/ExternalPage'));
const McpAuditPage = lazy(() => import('../pages/mcp/AuditPage'));
const McpAuditDetailPage = lazy(() => import('../pages/mcp/AuditDetailPage'));
const McpAuditStatisticsPage = lazy(() => import('../pages/mcp/AuditStatisticsPage'));
const McpOverviewPage = lazy(() => import('../pages/mcp/OverviewPage'));
const McpConnectionMonitorPage = lazy(() => import('../pages/mcp/ConnectionMonitorPage'));
const McpToolDetailPage = lazy(() => import('../pages/mcp/ToolDetailPage'));
const McpToolEditPage = lazy(() => import('../pages/mcp/ToolEditPage'));
const McpServerDetailPage = lazy(() => import('../pages/mcp/ServerDetailPage'));
const McpClientFormPage = lazy(() => import('../pages/mcp/ClientFormPage'));
const McpClientDetailPage = lazy(() => import('../pages/mcp/ClientDetailPage'));
const McpResourceListPage = lazy(() => import('../pages/mcp/ResourceListPage'));
const McpResourceEditPage = lazy(() => import('../pages/mcp/ResourceEditPage'));
const McpPromptTemplatePage = lazy(() => import('../pages/mcp/PromptTemplatePage'));
const McpPermissionRulePage = lazy(() => import('../pages/mcp/PermissionRulePage'));
const McpPolicyManagementPage = lazy(() => import('../pages/mcp/PolicyManagementPage'));
const McpIdeConfigPage = lazy(() => import('../pages/mcp/IdeConfigPage'));
const McpExternalAgentListPage = lazy(() => import('../pages/mcp/ExternalAgentListPage'));
const McpTrustManagementPage = lazy(() => import('../pages/mcp/TrustManagementPage'));

function withBoundary(name: string, element: React.ReactNode) {
  return <ErrorBoundary moduleName={name}>{element}</ErrorBoundary>;
}

export const mcpRouteElements = {
  McpToolsPage: withBoundary('mcp.tools', <McpToolsPage />),
  McpServerPage: withBoundary('mcp.server', <McpServerPage />),
  McpClientPage: withBoundary('mcp.client', <McpClientPage />),
  McpDebuggerPage: withBoundary('mcp.debugger', <McpDebuggerPage />),
  McpPermissionsPage: withBoundary('mcp.permissions', <McpPermissionsPage />),
  McpExternalPage: withBoundary('mcp.external', <McpExternalPage />),
  McpAuditPage: withBoundary('mcp.audit', <McpAuditPage />),
  McpAuditDetailPage: withBoundary('mcp.audit.detail', <McpAuditDetailPage />),
  McpAuditStatisticsPage: withBoundary('mcp.audit.stats', <McpAuditStatisticsPage />),
  McpOverviewPage: withBoundary('mcp.overview', <McpOverviewPage />),
  McpConnectionMonitorPage: withBoundary('mcp.connection-monitor', <McpConnectionMonitorPage />),
  McpToolDetailPage: withBoundary('mcp.tools.detail', <McpToolDetailPage />),
  McpToolEditPage: withBoundary('mcp.tools.edit', <McpToolEditPage />),
  McpServerDetailPage: withBoundary('mcp.servers.detail', <McpServerDetailPage />),
  McpClientFormPage: withBoundary('mcp.clients.new', <McpClientFormPage />),
  McpClientDetailPage: withBoundary('mcp.clients.detail', <McpClientDetailPage />),
  McpResourceListPage: withBoundary('mcp.resources', <McpResourceListPage />),
  McpResourceEditPage: withBoundary('mcp.resources.edit', <McpResourceEditPage />),
  McpPromptTemplatePage: withBoundary('mcp.prompts', <McpPromptTemplatePage />),
  McpPermissionRulePage: withBoundary('mcp.permissions.rules', <McpPermissionRulePage />),
  McpPolicyManagementPage: withBoundary('mcp.policies', <McpPolicyManagementPage />),
  McpIdeConfigPage: withBoundary('mcp.ide-config', <McpIdeConfigPage />),
  McpExternalAgentListPage: withBoundary('mcp.external-agents', <McpExternalAgentListPage />),
  McpTrustManagementPage: withBoundary('mcp.trusts', <McpTrustManagementPage />),
} as const;
