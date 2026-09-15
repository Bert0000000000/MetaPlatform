import { lazy } from 'react';
import { Route } from 'react-router-dom';

/**
 * 数字员工域（8 域 IA 第 3 域）路由表。
 * 一个域一个文件：并行批次只改自己域的注册点。
 *
 * 域内 6 个 tab（员工 / 外部员工 · A2A / 任务中心 / 协作编排 / 能力评估 / 文档处理）
 * 由壳的 PageTabs 渲染（见 components/shell/domains.tsx 的 agents 配置）；
 * 过渡期的 AgentsLayout（自带 ModuleTabsLayout）已不再包在这些页面外面。
 * 另外保留 DW API 消费页（GOVERN-08）与学习/抽取/可观测等既有子页为域内子路由。
 */
const EmployeeListPage = lazy(() => import('@/pages/agents/EmployeeListPage'));
const EmployeeCreatePage = lazy(() => import('@/pages/agents/EmployeeCreatePage'));
const EmployeeDetailPage = lazy(() => import('@/pages/agents/EmployeeDetailPage'));
const CapabilityConfigPage = lazy(() => import('@/pages/agents/CapabilityConfigPage'));
const TaskListPage = lazy(() => import('@/pages/agents/TaskListPage'));
const TaskDetailPage = lazy(() => import('@/pages/agents/TaskDetailPage'));
const CollaborationListPage = lazy(() => import('@/pages/agents/CollaborationListPage'));
const CollaborationCreatePage = lazy(() => import('@/pages/agents/CollaborationCreatePage'));
const CollaborationMonitorPage = lazy(() => import('@/pages/agents/CollaborationMonitorPage'));
const EvaluationPage = lazy(() => import('@/pages/agents/EvaluationPage'));
const ExternalAgentsPage = lazy(() => import('@/pages/agents/ExternalAgentsPage'));

const DwEmployeesPage = lazy(() => import('@/pages/dw/EmployeesPage'));
const DwTasksPage = lazy(() => import('@/pages/dw/TasksPage'));
const DwCollaborationsPage = lazy(() => import('@/pages/dw/CollaborationsPage'));
const DwEvaluationsPage = lazy(() => import('@/pages/dw/EvaluationsPage'));
const DwLearningPage = lazy(() => import('@/pages/dw/LearningPage'));
const DwDocumentsPage = lazy(() => import('@/pages/dw/DocumentsPage'));
const DwExtractionPage = lazy(() => import('@/pages/dw/ExtractionPage'));
const DwObsPage = lazy(() => import('@/pages/dw/ObsPage'));

export const agentsRoutes = (
  <>
    <Route path="agents" element={<EmployeeListPage />} />
    <Route path="agents/create" element={<EmployeeCreatePage />} />
    <Route path="agents/external" element={<ExternalAgentsPage />} />
    <Route path="agents/tasks" element={<TaskListPage />} />
    <Route path="agents/tasks/:taskId" element={<TaskDetailPage />} />
    <Route path="agents/collab" element={<CollaborationListPage />} />
    <Route path="agents/collab/create" element={<CollaborationCreatePage />} />
    <Route path="agents/collab/:id" element={<CollaborationMonitorPage />} />
    <Route path="agents/evaluation" element={<EvaluationPage />} />
    <Route path="agents/documents" element={<DwDocumentsPage />} />
    {/* DW API consumption pages (GOVERN-08) */}
    <Route path="agents/employees" element={<DwEmployeesPage />} />
    <Route path="agents/dw-tasks" element={<DwTasksPage />} />
    <Route path="agents/dw-collaborations" element={<DwCollaborationsPage />} />
    <Route path="agents/dw-evaluations" element={<DwEvaluationsPage />} />
    <Route path="agents/learning" element={<DwLearningPage />} />
    <Route path="agents/extraction" element={<DwExtractionPage />} />
    <Route path="agents/obs" element={<DwObsPage />} />
    {/* 详情/配置：注意放在动态段之后，静态段优先 */}
    <Route path="agents/:employeeId" element={<EmployeeDetailPage />} />
    <Route path="agents/:employeeId/capabilities" element={<CapabilityConfigPage />} />
  </>
);
