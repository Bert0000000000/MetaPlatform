import { lazy } from 'react';
import { Route } from 'react-router-dom';

/**
 * 工作台域（8 域 IA 第 1 域）路由表。
 * 一个域一个文件：并行批次只改自己域的注册点。
 *
 *   /home            概览（A 骨架 bento）
 *   /home/todos      待办
 *   /home/messages   消息
 *   /home/deliverables 交付物
 *   /home/apps       我的应用
 *   /home/me         我的（主题/语言/令牌/会话）
 *   /home/portal     门户（保留）
 *   /home/aiops      智能运维（保留）
 */
const OverviewPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const NotificationsPage = lazy(() => import('@/pages/dashboard/NotificationsPage'));
const MessagesPage = lazy(() => import('@/pages/dashboard/MessagesPage'));
const DeliverablesPage = lazy(() => import('@/pages/dashboard/DeliverablesPage'));
const MyAppsPage = lazy(() => import('@/pages/dashboard/MyAppsPage'));
const SettingsPage = lazy(() => import('@/pages/dashboard/SettingsPage'));
const PortalPage = lazy(() => import('@/pages/dashboard/PortalPage'));
const AiOpsPage = lazy(() => import('@/pages/dashboard/AiOpsPage'));

export const homeRoutes = (
  <>
    <Route path="home" element={<OverviewPage />} />
    <Route path="home/todos" element={<NotificationsPage />} />
    <Route path="home/messages" element={<MessagesPage />} />
    <Route path="home/deliverables" element={<DeliverablesPage />} />
    <Route path="home/apps" element={<MyAppsPage />} />
    <Route path="home/me" element={<SettingsPage />} />
    <Route path="home/portal" element={<PortalPage />} />
    <Route path="home/aiops" element={<AiOpsPage />} />
  </>
);
