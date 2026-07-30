/**
 * SuperAI module routes. Per-route lazy boundaries ensure one page failure
 * never blanks the whole workspace.
 */
import { lazy } from 'react';
import { ErrorBoundary } from '@mate/shared';

const SuperaiOverviewPage = lazy(() => import('../pages/superai/ChatPage'));
const SuperaiChatPage = lazy(() => import('../pages/superai/SuperAIChatPage'));
const SuperaiA2ACollaborationPage = lazy(() => import('../pages/superai/A2ACollaborationPage'));
const SuperaiAgentCopilotPage = lazy(() => import('../pages/superai/AgentCopilotPage'));
const SuperaiCostOptimizationPage = lazy(() => import('../pages/superai/CostOptimizationPage'));
const SuperaiDataAnalysisPage = lazy(() => import('../pages/superai/DataAnalysisPage'));
const SuperaiEmployeeMatchingPage = lazy(() => import('../pages/superai/EmployeeMatchingPage'));
const SuperaiExecutionDetailPage = lazy(() => import('../pages/superai/ExecutionDetailPage'));
const SuperaiExecutionPlanPage = lazy(() => import('../pages/superai/ExecutionPlanPage'));
const SuperaiManualSelectEmployeePage = lazy(() => import('../pages/superai/ManualSelectEmployeePage'));
const SuperaiParallelExecutionPage = lazy(() => import('../pages/superai/ParallelExecutionPage'));
const SuperaiReportExportPage = lazy(() => import('../pages/superai/ReportExportPage'));
const SuperaiResultAggregationPage = lazy(() => import('../pages/superai/ResultAggregationPage'));
const SuperaiResultSummaryPage = lazy(() => import('../pages/superai/ResultSummaryPage'));
const SuperaiScheduleExecutionPage = lazy(() => import('../pages/superai/ScheduleExecutionPage'));
const SuperaiScheduleIntentPage = lazy(() => import('../pages/superai/ScheduleIntentPage'));
const SuperaiSchedulePlanCardPage = lazy(() => import('../pages/superai/SchedulePlanCardPage'));
const SuperaiTaskOrchestrationPage = lazy(() => import('../pages/superai/TaskOrchestrationPage'));
const SuperaiTaskTemplatePage = lazy(() => import('../pages/superai/TaskTemplatePage'));

function withBoundary(name: string, element: React.ReactNode) {
  return <ErrorBoundary moduleName={name}>{element}</ErrorBoundary>;
}

export const superaiRouteElements = {
  SuperaiOverviewPage: withBoundary('superai.overview', <SuperaiOverviewPage />),
  SuperaiChatPage: withBoundary('superai.chat', <SuperaiChatPage />),
  SuperaiA2ACollaborationPage: withBoundary('superai.a2a', <SuperaiA2ACollaborationPage />),
  SuperaiAgentCopilotPage: withBoundary('superai.copilot', <SuperaiAgentCopilotPage />),
  SuperaiCostOptimizationPage: withBoundary('superai.cost', <SuperaiCostOptimizationPage />),
  SuperaiDataAnalysisPage: withBoundary('superai.data', <SuperaiDataAnalysisPage />),
  SuperaiEmployeeMatchingPage: withBoundary('superai.employee-match', <SuperaiEmployeeMatchingPage />),
  SuperaiExecutionPlanPage: withBoundary('superai.execution', <SuperaiExecutionPlanPage />),
  SuperaiExecutionDetailPage: withBoundary('superai.execution.detail', <SuperaiExecutionDetailPage />),
  SuperaiManualSelectEmployeePage: withBoundary('superai.manual-select', <SuperaiManualSelectEmployeePage />),
  SuperaiParallelExecutionPage: withBoundary('superai.parallel', <SuperaiParallelExecutionPage />),
  SuperaiReportExportPage: withBoundary('superai.report', <SuperaiReportExportPage />),
  SuperaiResultAggregationPage: withBoundary('superai.result-aggregation', <SuperaiResultAggregationPage />),
  SuperaiResultSummaryPage: withBoundary('superai.result-summary', <SuperaiResultSummaryPage />),
  SuperaiScheduleIntentPage: withBoundary('superai.schedule', <SuperaiScheduleIntentPage />),
  SuperaiScheduleExecutionPage: withBoundary('superai.schedule.execute', <SuperaiScheduleExecutionPage />),
  SuperaiSchedulePlanCardPage: withBoundary('superai.schedule.plan', <SuperaiSchedulePlanCardPage />),
  SuperaiTaskOrchestrationPage: withBoundary('superai.tasks', <SuperaiTaskOrchestrationPage />),
  SuperaiTaskTemplatePage: withBoundary('superai.templates', <SuperaiTaskTemplatePage />),
} as const;
