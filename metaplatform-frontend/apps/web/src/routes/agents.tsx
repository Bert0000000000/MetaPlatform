import { lazy } from 'react';
import { Route } from 'react-router-dom';
import type { ModuleTab } from '@mate/shared';

/**
 * 数字员工域（8 域 IA 第 3 域）路由表。
 * 一个域一个文件：并行批次只改自己域的注册点。
 *
 * 域内 6 个 tab（由 AgentsLayout 渲染，见 DomainDef.ownsTabs）：
 *   员工 / 外部员工 · A2A / 任务中心 / 协作编排 / 能力评估 / 文档处理
 * 另外保留 DW API 消费页（GOVERN-08）与学习/抽取/可观测等既有子页为域内子路由。
 */
const AgentsLayout = lazy(() => import('@/pages/agents/AgentsLayout'));
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

/** 域内二级 tab（/gov、/ki 同款做法：交给域内布局渲染）。 */
export const AGENTS_TABS_V2: ModuleTab[] = [
  {
    key: 'employees',
    label: '员工',
    path: '/agents',
    matchPaths: ['/agents/employees', '/agents/learning', '/agents/obs', '/agents/extraction'],
  },
  { key: 'external', label: '外部员工 · A2A', path: '/agents/external' },
  { key: 'tasks', label: '任务中心', path: '/agents/tasks', matchPaths: ['/agents/dw-tasks'] },
  { key: 'collab', label: '协作编排', path: '/agents/collab', matchPaths: ['/agents/dw-collaborations'] },
  { key: 'evaluation', label: '能力评估', path: '/agents/evaluation', matchPaths: ['/agents/dw-evaluations'] },
  { key: 'documents', label: '文档处理', path: '/agents/documents' },
];

export const agentsRoutes = (
  <>
    <Route path="agents" element={<AgentsLayout tabs={AGENTS_TABS_V2} />}>
      <Route index element={<EmployeeListPage />} />
      <Route path="create" element={<EmployeeCreatePage />} />
      <Route path="external" element={<ExternalAgentsPage />} />
      <Route path="tasks" element={<TaskListPage />} />
      <Route path="tasks/:taskId" element={<TaskDetailPage />} />
      <Route path="collab" element={<CollaborationListPage />} />
      <Route path="collab/create" element={<CollaborationCreatePage />} />
      <Route path="collab/:id" element={<CollaborationMonitorPage />} />
      <Route path="evaluation" element={<EvaluationPage />} />
      <Route path="documents" element={<DwDocumentsPage />} />
      {/* DW API consumption pages (GOVERN-08) */}
      <Route path="employees" element={<DwEmployeesPage />} />
      <Route path="dw-tasks" element={<DwTasksPage />} />
      <Route path="dw-collaborations" element={<DwCollaborationsPage />} />
      <Route path="dw-evaluations" element={<DwEvaluationsPage />} />
      <Route path="learning" element={<DwLearningPage />} />
      <Route path="extraction" element={<DwExtractionPage />} />
      <Route path="obs" element={<DwObsPage />} />
      {/* 详情/配置：注意放在动态段之后，静态段优先 */}
      <Route path=":employeeId" element={<EmployeeDetailPage />} />
      <Route path=":employeeId/capabilities" element={<CapabilityConfigPage />} />
    </Route>
  </>
);
