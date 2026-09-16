import { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';
import KiDomainShell from '@/pages/ki/KiDomainShell';

/**
 * 知识与集成域（8 域 IA 第 6 域）路由表。
 *
 * 主 tab（知识库 / MCP 工具 / A2A / 检索测试）+ MCP·A2A 的 segmented 子 tab
 * 由壳的 PageTabs 渲染（见 components/shell/domains.tsx 的 ki 配置）。
 * 过渡期的 KnowledgeLayout（4 tab）与 McpCenterLayout（三 HUB + 二级 SubTabs）
 * 不再包在这些页面外面，免得与壳的 tab 行重复。
 *
 * 页面组件与 src/api/kb/*、src/api/mcphub/* 本批不动，只换外壳。
 */

// ---------- 知识库 ----------
const KnowledgeBasePage = lazy(() => import('@/pages/knowledge/KnowledgeBasePage'));
const KnowledgeDocsPage = lazy(() => import('@/pages/knowledge/KnowledgeDocsPage'));
const KnowledgeTestPage = lazy(() => import('@/pages/knowledge/KnowledgeTestPage'));
const KnowledgeConfigPage = lazy(() => import('@/pages/knowledge/KnowledgeConfigPage'));
const KnowledgeKbDetailPage = lazy(() => import('@/pages/knowledge/KnowledgeKbDetailPage'));

// ---------- MCP ----------
const McpToolsPage = lazy(() => import('@/pages/mcp/McpToolsPage'));
const McpServerPage = lazy(() => import('@/pages/mcp/McpServerPage'));
const McpClientPage = lazy(() => import('@/pages/mcp/McpClientPage'));
const McpDebuggerPage = lazy(() => import('@/pages/mcp/McpDebuggerPage'));
const McpPermissionsPage = lazy(() => import('@/pages/mcp/McpPermissionsPage'));
const McpAuditPage = lazy(() => import('@/pages/mcp/McpAuditPage'));
const McpOverviewPage = lazy(() => import('@/pages/mcp/OverviewPage'));
const McpSkillHubPage = lazy(() => import('@/pages/mcp/SkillHubPage'));
const McpConnectionMonitorPage = lazy(() => import('@/pages/mcp/ConnectionMonitorPage'));
const McpToolDetailPage = lazy(() => import('@/pages/mcp/ToolDetailPage'));
const McpServerDetailPage = lazy(() => import('@/pages/mcp/ServerDetailPage'));
const McpClientDetailPage = lazy(() => import('@/pages/mcp/ClientDetailPage'));
const McpResourceListPage = lazy(() => import('@/pages/mcp/ResourceListPage'));
const McpPromptTemplatePage = lazy(() => import('@/pages/mcp/PromptTemplatePage'));
const McpPermissionRulePage = lazy(() => import('@/pages/mcp/PermissionRulePage'));
const McpPolicyManagementPage = lazy(() => import('@/pages/mcp/PolicyManagementPage'));
const McpIdeConfigPage = lazy(() => import('@/pages/mcp/IdeConfigPage'));
const McpAuditDetailPage = lazy(() => import('@/pages/mcp/AuditDetailPage'));
const McpAuditStatisticsPage = lazy(() => import('@/pages/mcp/AuditStatisticsPage'));

// ---------- A2A ----------
const A2aInternalAgentsPage = lazy(() => import('@/pages/mcp/A2aInternalAgentsPage'));
const McpExternalAgentListPage = lazy(() => import('@/pages/mcp/ExternalAgentListPage'));
const McpTrustManagementPage = lazy(() => import('@/pages/mcp/TrustManagementPage'));
const A2aIntegrationGuidePage = lazy(() => import('@/pages/mcp/A2aIntegrationGuidePage'));

export const kiRoutes = (
  <Route path="ki" element={<KiDomainShell />}>
    <Route index element={<Navigate to="/ki/kb" replace />} />

    {/* ---------- 知识库 ---------- */}
    <Route path="kb" element={<KnowledgeBasePage />} />
    <Route path="kb/docs" element={<KnowledgeDocsPage />} />
    <Route path="kb/config" element={<KnowledgeConfigPage />} />
    <Route path="kb/test" element={<KnowledgeTestPage />} />
    <Route path="kb/:kbId" element={<KnowledgeKbDetailPage />} />
    <Route path="test" element={<KnowledgeTestPage />} />

    {/* ---------- MCP ---------- */}
    <Route path="mcp" element={<Navigate to="/ki/mcp/tools" replace />} />
    <Route path="mcp/overview" element={<McpOverviewPage />} />
    <Route path="mcp/skill-hub" element={<McpSkillHubPage />} />
    <Route path="mcp/tools" element={<McpToolsPage />} />
    <Route path="mcp/tools/new" element={<McpToolsPage />} />
    <Route path="mcp/tools/:id" element={<McpToolDetailPage />} />
    <Route path="mcp/tools/:id/edit" element={<McpToolsPage />} />
    <Route path="mcp/resources" element={<McpResourceListPage />} />
    <Route path="mcp/resources/new" element={<McpResourceListPage />} />
    <Route path="mcp/resources/:id" element={<McpResourceListPage />} />
    <Route path="mcp/prompts" element={<McpPromptTemplatePage />} />
    <Route path="mcp/debugger" element={<McpDebuggerPage />} />
    <Route path="mcp/ide-config" element={<McpIdeConfigPage />} />
    <Route path="mcp/servers" element={<McpServerPage />} />
    <Route path="mcp/servers/new" element={<McpServerPage />} />
    <Route path="mcp/servers/:id" element={<McpServerDetailPage />} />
    <Route path="mcp/servers/:id/edit" element={<McpServerPage />} />
    <Route path="mcp/clients" element={<McpClientPage />} />
    <Route path="mcp/clients/new" element={<McpClientPage />} />
    <Route path="mcp/clients/:id" element={<McpClientDetailPage />} />
    <Route path="mcp/clients/:id/edit" element={<McpClientPage />} />
    <Route path="mcp/permissions" element={<McpPermissionsPage />} />
    <Route path="mcp/permissions/rules" element={<McpPermissionRulePage />} />
    <Route path="mcp/policies" element={<McpPolicyManagementPage />} />
    <Route path="mcp/matrix" element={<McpPolicyManagementPage />} />
    <Route path="mcp/audit" element={<McpAuditPage />} />
    <Route path="mcp/audit/detail/:id" element={<McpAuditDetailPage />} />
    <Route path="mcp/audit/stats" element={<McpAuditStatisticsPage />} />
    <Route path="mcp/connection-monitor" element={<McpConnectionMonitorPage />} />

    {/* ---------- A2A（旧链接保留 internal-agents / a2a-guide） ---------- */}
    <Route path="a2a" element={<Navigate to="/ki/a2a/external-agents" replace />} />
    <Route path="a2a/external-agents" element={<McpExternalAgentListPage />} />
    <Route path="a2a/trusts" element={<McpTrustManagementPage />} />
    <Route path="a2a/internal-agents" element={<A2aInternalAgentsPage />} />
    <Route path="a2a/a2a-guide" element={<A2aIntegrationGuidePage />} />
    <Route path="a2a/overview" element={<Navigate to="/ki/mcp/overview" replace />} />
    <Route path="a2a/skill-hub" element={<Navigate to="/ki/mcp/skill-hub" replace />} />
  </Route>
);
