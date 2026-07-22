/**
 * 平台统一菜单配置
 *
 * 所有子应用共享同一份菜单元数据，保证侧边栏结构一致。
 * 当前应用内菜单通过 path 做路由跳转；跨应用跳转通过 appUrl 实现。
 */

export interface PlatformMenuItem {
  key: string;
  label: string;
  path: string;
  appUrl?: string;
}

export interface PlatformModuleMenu {
  key: string;
  label: string;
  appUrl?: string;
  items: PlatformMenuItem[];
}

export const PLATFORM_MENU: Record<string, PlatformModuleMenu> = {
  portal: {
    key: 'portal',
    label: '统一入口',
    items: [{ key: 'home', label: '首页', path: '/' }],
  },
  dashboard: {
    key: 'dashboard',
    label: '工作台',
    appUrl: 'http://localhost:9202',
    items: [
      { key: 'dashboard', label: '工作台', path: '/dashboard' },
      { key: 'my-apps', label: '我的应用', path: '/my-apps' },
      { key: 'my-agents', label: '我的数字员工', path: '/my-agents' },
      { key: 'notifications', label: '消息', path: '/notifications' },
      { key: 'portal', label: '门户', path: '/portal' },
      { key: 'deliverables', label: '交付材料', path: '/deliverables' },
    ],
  },
  superai: {
    key: 'superai',
    label: '超级 AI',
    appUrl: 'http://localhost:9301',
    items: [
      { key: 'chat', label: 'AI 对话', path: '/chat' },
      { key: 'schedule', label: '任务编排', path: '/schedule/orchestration' },
      { key: 'schedule-plan', label: '执行计划', path: '/schedule/plan' },
      { key: 'schedule-parallel', label: '并行执行', path: '/schedule/parallel' },
      { key: 'schedule-aggregate', label: '结果聚合', path: '/schedule/aggregate' },
      { key: 'schedule-templates', label: '任务模板', path: '/schedule/templates' },
      { key: 'schedule-intent', label: '意图调度', path: '/schedule/intent' },
      { key: 'schedule-match', label: '员工匹配', path: '/schedule/match' },
      { key: 'schedule-plan-card', label: '计划卡片', path: '/schedule/plan-card' },
      { key: 'schedule-execution', label: '执行监控', path: '/schedule/execution' },
      { key: 'schedule-result', label: '结果总结', path: '/schedule/result' },
      { key: 'schedule-export', label: '报告导出', path: '/schedule/export' },
      { key: 'schedule-manual-select', label: '人工选择', path: '/schedule/manual-select' },
      { key: 'schedule-a2a', label: 'A2A 协作', path: '/schedule/a2a' },
      { key: 'analysis', label: '数据分析', path: '/analysis' },
      { key: 'cost-optimization', label: '成本优化', path: '/cost-optimization' },
    ],
  },
  ontstudio: {
    key: 'ontstudio',
    label: '本体论引擎',
    appUrl: 'http://localhost:9101',
    items: [
      { key: 'concepts', label: '概念管理', path: '/concepts' },
      { key: 'entities', label: '实体管理', path: '/entities' },
      { key: 'relations', label: '关系类型', path: '/relations' },
      { key: 'relation-instances', label: '关系实例', path: '/relation-instances' },
      { key: 'rules', label: '规则管理', path: '/rules' },
      { key: 'versions', label: '版本管理', path: '/versions' },
      { key: 'datasources', label: '数据源', path: '/datasources' },
      { key: 'mappings', label: '数据映射', path: '/mappings' },
      { key: 'actions', label: '动作定义', path: '/actions' },
      { key: 'orchestrations', label: '编排', path: '/orchestrations' },
      { key: 'triggers', label: '触发器', path: '/triggers' },
      { key: 'executions', label: '执行监控', path: '/executions' },
      { key: 'graph', label: '知识图谱', path: '/graph' },
      { key: 'quality', label: '数据质量', path: '/quality' },
      { key: 'lineage', label: '数据血缘', path: '/lineage' },
      { key: 'discovery', label: '本体发现', path: '/discovery' },
    ],
  },
  dw: {
    key: 'dw',
    label: '数字员工',
    appUrl: 'http://localhost:9401',
    items: [
      { key: 'dw-employees', label: '数字员工', path: '/dw/employees' },
      { key: 'dw-tasks', label: '任务中心', path: '/dw/tasks' },
      { key: 'dw-evaluation', label: '效果评估', path: '/dw/evaluation' },
      { key: 'dw-collaborations', label: '多员工协作', path: '/dw/collaborations' },
      { key: 'dw-external-agents', label: 'A2A 外部协作', path: '/dw/external-agents' },
    ],
  },
  apphub: {
    key: 'apphub',
    label: '应用中心',
    appUrl: 'http://localhost:9201',
    items: [
      { key: 'apphub-apps', label: '应用管理', path: '/apps' },
      { key: 'apphub-market', label: '应用市场', path: '/market' },
      { key: 'apphub-my-templates', label: '我的模板', path: '/my-templates' },
    ],
  },
  arch: {
    key: 'arch',
    label: '架构中心',
    appUrl: 'http://localhost:9206',
    items: [
      { key: 'arch-overview', label: '架构总览', path: '/arch' },
      { key: 'arch-capabilities', label: '能力地图', path: '/arch/capabilities' },
      { key: 'arch-applications', label: '应用系统', path: '/arch/applications' },
      { key: 'arch-value-streams', label: '价值流', path: '/arch/value-streams' },
      { key: 'arch-processes', label: '业务流程', path: '/arch/processes' },
      { key: 'arch-org-roles', label: '组织与角色', path: '/arch/org-roles' },
      { key: 'arch-data', label: '数据域/实体', path: '/arch/data' },
      { key: 'arch-data-flows', label: '数据流', path: '/arch/data/flows' },
      { key: 'arch-data-standards', label: '数据标准', path: '/arch/data/standards' },
      { key: 'arch-data-assets', label: '资产目录', path: '/arch/data/assets' },
      { key: 'arch-tech', label: '技术架构总览', path: '/arch/tech' },
      { key: 'arch-tech-components', label: '技术组件库', path: '/arch/tech-components' },
      { key: 'arch-tech-stacks', label: '技术栈画像', path: '/arch/tech-stacks' },
      { key: 'arch-deployment-topologies', label: '部署拓扑', path: '/arch/deployment-topologies' },
      { key: 'arch-tech-radar', label: '技术雷达', path: '/arch/tech-radar' },
      { key: 'arch-principles', label: '原则与标准', path: '/arch/principles' },
      { key: 'arch-review-templates', label: '评审模板', path: '/arch/review-templates' },
      { key: 'arch-reviews', label: '评审流程', path: '/arch/reviews' },
      { key: 'arch-tech-debt', label: '技术债务', path: '/arch/tech-debt' },
      { key: 'arch-ontology-mapping', label: '本体映射', path: '/arch/ontology-mapping' },
    ],
  },
  mcphub: {
    key: 'mcphub',
    label: 'MCP 服务中心',
    appUrl: 'http://localhost:9501',
    items: [
      { key: 'mcphub-overview', label: '概览', path: '/' },
      { key: 'mcphub-tools', label: '工具注册中心', path: '/tools' },
      { key: 'mcphub-servers', label: 'MCP Server', path: '/servers' },
      { key: 'mcphub-debugger', label: '调试器', path: '/debugger' },
      { key: 'mcphub-clients', label: 'MCP Client', path: '/clients' },
      { key: 'mcphub-permissions', label: '权限控制', path: '/permissions' },
      { key: 'mcphub-policies', label: 'ABAC 策略', path: '/policies' },
      { key: 'mcphub-matrix', label: '权限矩阵', path: '/matrix' },
      { key: 'mcphub-resources', label: '资源配置', path: '/resources' },
      { key: 'mcphub-prompts', label: 'Prompt 模板', path: '/prompts' },
      { key: 'mcphub-audit', label: '调用审计', path: '/audit' },
      { key: 'mcphub-integrations', label: '外部对接', path: '/integrations' },
      { key: 'mcphub-external-agents', label: '外部 Agent 目录', path: '/external-agents' },
      { key: 'mcphub-trusts', label: '信任管理', path: '/trusts' },
      { key: 'mcphub-collaborations', label: '协作审计', path: '/collaborations' },
      { key: 'mcphub-ide-config', label: 'IDE 配置', path: '/ide-config' },
      { key: 'mcphub-connection-monitor', label: '连接监控', path: '/connection-monitor' },
    ],
  },
};
