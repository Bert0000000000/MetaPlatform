/**
 * Dashboard routes (workbench + admin area).
 *
 * Module-local lazy imports; the default export is the inner element tree
 * so callers can compose them under the authenticated layout.
 */
import { lazy } from 'react';
import { ErrorBoundary, Navigate } from '@mate/shared';

const DashboardDashboardPage = lazy(() => import('../pages/dashboard/DashboardPage'));
const DashboardNotificationsPage = lazy(() => import('../pages/dashboard/NotificationsPage'));
const DashboardAiOpsPage = lazy(() => import('../pages/dashboard/AiOpsPage'));
const DashboardSettingsPage = lazy(() => import('../pages/dashboard/SettingsPage'));
const DashboardDeliverablesPage = lazy(() => import('../pages/dashboard/DeliverablesPage'));
const DashboardAdminOverviewPage = lazy(() => import('../pages/dashboard/admin/OverviewPage'));
const DashboardAdminUsersPage = lazy(() => import('../pages/dashboard/admin/UsersPage'));
const DashboardAdminPermissionsPage = lazy(() => import('../pages/dashboard/admin/PermissionsPage'));
const DashboardAdminOrgsPage = lazy(() => import('../pages/dashboard/admin/OrgsPage'));
const DashboardAdminLogsPage = lazy(() => import('../pages/dashboard/admin/LogsPage'));
const DashboardAdminConfigsPage = lazy(() => import('../pages/dashboard/admin/ConfigsPage'));
const DashboardAdminOperationsPage = lazy(() => import('../pages/dashboard/admin/OperationsPage'));

export const dashboardIndex = <Navigate to="/dashboard" replace />;

export const dashboardRouteElements = {
  DashboardDashboardPage: withBoundary('dashboard.workbench', <DashboardDashboardPage />),
  DashboardNotificationsPage: withBoundary('dashboard.notifications', <DashboardNotificationsPage />),
  DashboardAiOpsPage: withBoundary('dashboard.aiops', <DashboardAiOpsPage />),
  DashboardSettingsPage: withBoundary('dashboard.settings', <DashboardSettingsPage />),
  DashboardDeliverablesPage: withBoundary('dashboard.deliverables', <DashboardDeliverablesPage />),
  DashboardAdminOverviewPage: withBoundary('dashboard.admin', <DashboardAdminOverviewPage />),
  DashboardAdminUsersPage: withBoundary('dashboard.admin.users', <DashboardAdminUsersPage />),
  DashboardAdminPermissionsPage: withBoundary('dashboard.admin.permissions', <DashboardAdminPermissionsPage />),
  DashboardAdminOrgsPage: withBoundary('dashboard.admin.orgs', <DashboardAdminOrgsPage />),
  DashboardAdminLogsPage: withBoundary('dashboard.admin.logs', <DashboardAdminLogsPage />),
  DashboardAdminConfigsPage: withBoundary('dashboard.admin.configs', <DashboardAdminConfigsPage />),
  DashboardAdminOperationsPage: withBoundary('dashboard.admin.operations', <DashboardAdminOperationsPage />),
} as const;

function withBoundary(name: string, element: React.ReactNode) {
  return <ErrorBoundary moduleName={name}>{element}</ErrorBoundary>;
}
