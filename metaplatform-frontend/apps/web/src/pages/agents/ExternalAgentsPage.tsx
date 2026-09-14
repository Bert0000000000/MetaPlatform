import ExternalAgentsPanel from './components/ExternalAgentsPanel';

/**
 * 外部员工 · A2A（/agents/external）。
 *
 * 页面结构（页头 + 筛选栏 + 卡片网格 + 委托表格）全部由 ExternalAgentsPanel 承载；
 * 本页只做路由出口。外层 AppShell / AgentsLayout 已提供页面容器与滚动，
 * 因此这里不再套 PageRoot（与同域的 EmployeeListPage 保持一致）。
 */
export default function ExternalAgentsPage() {
  return <ExternalAgentsPanel />;
}
