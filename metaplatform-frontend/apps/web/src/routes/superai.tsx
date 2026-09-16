import { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';

/**
 * SuperAI 域（8 域 IA 第 4 域）路由表。
 *
 * 域内 5 个 tab：会话 / 执行计划 / 意图与调度 / 成本优化 / 任务模板。
 * 子路由（结果聚合、并行执行、员工匹配等）作为域内深链保留，不占 tab。
 *
 * 注：`/superai/plans/exec/:id` 已下线——原 ExecutionDetailPage 是纯静态占位
 * （写死的步骤、无任何 API 调用），而 plans 接口没有「按 executionId 取详情」，
 * 因此把它并回计划页（计划详情已含每步起止与状态）。
 */
const SuperaiChatPage = lazy(() => import('@/pages/superai/ChatPage'));
const SuperaiExecutionPlanPage = lazy(() => import('@/pages/superai/ExecutionPlanPage'));
const SuperaiA2ACollaborationPage = lazy(() => import('@/pages/superai/A2ACollaborationPage'));
const SuperaiOrchestrationConsolePage = lazy(() => import('@/pages/superai/OrchestrationConsolePage'));
const SuperaiManualSelectEmployeePage = lazy(() => import('@/pages/superai/ManualSelectEmployeePage'));
const SuperaiParallelExecutionPage = lazy(() => import('@/pages/superai/ParallelExecutionPage'));
const SuperaiResultAggregationPage = lazy(() => import('@/pages/superai/ResultAggregationPage'));
const SuperaiResultSummaryPage = lazy(() => import('@/pages/superai/ResultSummaryPage'));
const SuperaiEmployeeMatchingPage = lazy(() => import('@/pages/superai/EmployeeMatchingPage'));
const ActionOrchestrationPage = lazy(() => import('@/pages/wfe/ActionOrchestrationPage'));
const SuperaiScheduleIntentPage = lazy(() => import('@/pages/superai/ScheduleIntentPage'));
const SuperaiScheduleExecutionPage = lazy(() => import('@/pages/superai/ScheduleExecutionPage'));
const SuperaiSchedulePlanCardPage = lazy(() => import('@/pages/superai/SchedulePlanCardPage'));
const SuperaiCostOptimizationPage = lazy(() => import('@/pages/superai/CostOptimizationPage'));
const SuperaiDataAnalysisPage = lazy(() => import('@/pages/superai/DataAnalysisPage'));
const SuperaiReportExportPage = lazy(() => import('@/pages/superai/ReportExportPage'));
const SuperaiTaskTemplatePage = lazy(() => import('@/pages/superai/TaskTemplatePage'));
const AgentTeamRunPage = lazy(() => import('@/pages/superai/AgentTeamRunPage'));

export const superaiRoutes = (
  <>
    {/* /superai 的入口转发在 routes/legacy-redirects.tsx */}

    {/* 会话 */}
    <Route path="superai/chat" element={<SuperaiChatPage />} />
    {/* 原「本体原生 Agent Run」独立页已下线：它打的 /api/v1/agent/runs/stream
        后端并不存在。证据 + 提案确认已并入主聊天，旧链接转发过去。 */}
    <Route path="superai/chat/copilot" element={<Navigate to="/superai/chat" replace />} />

    {/* 执行计划 */}
    <Route path="superai/plans" element={<SuperaiExecutionPlanPage />} />
    <Route path="superai/plans/a2a" element={<SuperaiA2ACollaborationPage />} />
    <Route path="superai/plans/orchestration" element={<SuperaiOrchestrationConsolePage />} />
    <Route path="superai/plans/manual-select" element={<SuperaiManualSelectEmployeePage />} />
    <Route path="superai/plans/parallel" element={<SuperaiParallelExecutionPage />} />
    <Route path="superai/plans/result-aggregation" element={<SuperaiResultAggregationPage />} />
    <Route path="superai/plans/result-summary" element={<SuperaiResultSummaryPage />} />
    <Route path="superai/plans/employee-match" element={<SuperaiEmployeeMatchingPage />} />
    <Route path="superai/plans/exec/:id" element={<Navigate to="/superai/plans" replace />} />
    {/* Action 编排详情：参数名保持 definitionId，页面按该 key 读取路由参数 */}
    <Route path="superai/plans/:definitionId" element={<ActionOrchestrationPage />} />

    {/* 意图与调度 */}
    <Route path="superai/schedules" element={<SuperaiScheduleIntentPage />} />
    <Route path="superai/schedules/execute" element={<SuperaiScheduleExecutionPage />} />
    <Route path="superai/schedules/plan" element={<SuperaiSchedulePlanCardPage />} />

    {/* 成本优化 */}
    <Route path="superai/cost" element={<SuperaiCostOptimizationPage />} />
    <Route path="superai/cost/data" element={<SuperaiDataAnalysisPage />} />
    <Route path="superai/cost/report" element={<SuperaiReportExportPage />} />

    {/* 任务模板 */}
    <Route path="superai/templates" element={<SuperaiTaskTemplatePage />} />

    {/* Agent 产品层：超级大脑 + 数字员工一条主链（只读演示） */}
    <Route path="superai/team" element={<AgentTeamRunPage />} />
  </>
);
