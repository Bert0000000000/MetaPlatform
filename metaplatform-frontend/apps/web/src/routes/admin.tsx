import { lazy } from 'react';
import { Route } from 'react-router-dom';

/**
 * 平台管理域（8 域 IA 第 8 域）路由表。
 * 一个域一个文件：并行批次只改自己域的注册点。
 *
 *   /admin/org/*       组织：用户与权限 / 角色 / 组织与租户
 *   /admin/platform/*  平台：平台配置 / AI Provider / 组件演示（新设计系统演示页）
 *   /admin/ops/*       运维：审计日志 / 运营监控 / 使用分析
 *   /admin/flowgram    既有 FlowGram 演示（保留）
 *   /admin/demo        UI-P0 五骨架组件演示页（保留）
 *
 * 页面全部 lazy：admin 各页体量大，不进入口 chunk。
 */
const UsersPage = lazy(() => import('@/pages/dashboard/admin/UsersPage'));
const PermissionsPage = lazy(() => import('@/pages/dashboard/admin/PermissionsPage'));
const OrgsPage = lazy(() => import('@/pages/dashboard/admin/OrgsPage'));
const ConfigsPage = lazy(() => import('@/pages/dashboard/admin/ConfigsPage'));
const AIProvidersPage = lazy(() => import('@/pages/dashboard/admin/AIProvidersPage'));
const LogsPage = lazy(() => import('@/pages/dashboard/admin/LogsPage'));
const OperationsPage = lazy(() => import('@/pages/dashboard/admin/OperationsPage'));
const AnalyticsPage = lazy(() => import('@/pages/dashboard/admin/AnalyticsPage'));
const FlowgramDemoPage = lazy(() => import('@/pages/dashboard/admin/FlowgramDemoPage'));
const UiP0DemoPage = lazy(() => import('@/routes/demo'));

export const adminRoutes = (
  <>
    {/* /admin（含三个分组根）的入口转发在 routes/legacy-redirects.tsx */}
    <Route path="admin/org/users" element={<UsersPage />} />
    <Route path="admin/org/roles" element={<PermissionsPage />} />
    <Route path="admin/org/tenants" element={<OrgsPage />} />

    <Route path="admin/platform/configs" element={<ConfigsPage />} />
    <Route path="admin/platform/ai-providers" element={<AIProvidersPage />} />
    {/* 原「模型与组件」挂的是旧设计系统的组件画廊（ComponentDemoPage）；
        它的独有能力（skill 上传/编辑）已在 /ki/mcp/skill-hub，模型面由 AI Provider 页覆盖，
        因此这里改挂新的设计系统演示页。旧文件留给 P2d 清理。 */}
    <Route path="admin/platform/components" element={<UiP0DemoPage />} />

    <Route path="admin/ops/logs" element={<LogsPage />} />
    <Route path="admin/ops/operations" element={<OperationsPage />} />
    <Route path="admin/ops/analytics" element={<AnalyticsPage />} />

    <Route path="admin/flowgram" element={<FlowgramDemoPage />} />
    <Route path="admin/demo" element={<UiP0DemoPage />} />
  </>
);
