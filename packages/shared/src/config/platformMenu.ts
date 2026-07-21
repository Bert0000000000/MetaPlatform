export interface PlatformMenuItem {
  key: string;
  label: string;
  icon?: string;
  path?: string;
  appUrl?: string;
  children?: PlatformMenuItem[];
}

export const PLATFORM_MENU: PlatformMenuItem[] = [
  {
    key: 'dashboard',
    label: '工作台',
    icon: 'DashboardOutlined',
    path: '/dashboard',
    appUrl: 'http://localhost:9202',
    children: [
      { key: 'dashboard-home', label: '工作台', path: '/dashboard' },
      { key: 'dashboard-aiops', label: '智能运维', path: '/aiops' },
      { key: 'dashboard-notifications', label: '消息中心', path: '/notifications' },
      { key: 'dashboard-deliverables', label: '历史交付物', path: '/deliverables' },
      { key: 'dashboard-settings', label: '个性化设置', path: '/settings' },
    ],
  },
  {
    key: 'superai',
    label: '超级 AI',
    icon: 'MessageOutlined',
    path: '/chat',
    appUrl: 'http://localhost:9301',
    children: [
      { key: 'superai-chat', label: '智能对话', path: '/chat' },
      { key: 'superai-analysis', label: '数据分析', path: '/analysis' },
      { key: 'superai-cost-optimization', label: '成本优化', path: '/cost-optimization' },
      { key: 'superai-schedule', label: '任务编排', path: '/schedule/orchestration' },
      { key: 'superai-plan', label: '执行计划', path: '/schedule/plan' },
      { key: 'superai-parallel', label: '并行执行监控', path: '/schedule/parallel' },
      { key: 'superai-aggregate', label: '结果汇聚', path: '/schedule/aggregate' },
      { key: 'superai-templates', label: '任务模板', path: '/schedule/templates' },
      { key: 'superai-intent', label: '意图识别', path: '/schedule/intent' },
      { key: 'superai-match', label: '员工匹配', path: '/schedule/match' },
      { key: 'superai-plan-card', label: '计划卡片', path: '/schedule/plan-card' },
      { key: 'superai-execution', label: '执行面板', path: '/schedule/execution' },
      { key: 'superai-execution-detail', label: '执行详情', path: '/schedule/execution/detail' },
      { key: 'superai-result', label: '结果汇总', path: '/schedule/result' },
      { key: 'superai-export', label: '报告导出', path: '/schedule/export' },
      { key: 'superai-manual-select', label: '手动选员', path: '/schedule/manual-select' },
      { key: 'superai-a2a', label: 'A2A 协作', path: '/schedule/a2a' },
    ],
  },
  {
    key: 'dw',
    label: '数字员工',
    icon: 'RobotOutlined',
    path: '/dw/employees',
    appUrl: 'http://localhost:9401',
    children: [
      { key: 'dw-employees', label: '数字员工', path: '/dw/employees' },
      { key: 'dw-tasks', label: '任务中心', path: '/dw/tasks' },
      { key: 'dw-evaluation', label: '效果评估', path: '/dw/evaluation' },
      { key: 'dw-collaborations', label: '多员工协作', path: '/dw/collaborations' },
      { key: 'dw-external-agents', label: 'A2A 外部协作', path: '/dw/external-agents' },
    ],
  },
  {
    key: 'apphub',
    label: '应用中心',
    icon: 'AppstoreOutlined',
    path: '/apps',
    appUrl: 'http://localhost:9201',
    children: [
      { key: 'apphub-apps', label: '应用管理', path: '/apps' },
      { key: 'apphub-market', label: '应用市场', path: '/market' },
      { key: 'apphub-my-templates', label: '我的模板', path: '/my-templates' },
    ],
  },
  {
    key: 'ontstudio',
    label: '本体论引擎',
    icon: 'ApartmentOutlined',
    path: '/concepts',
    appUrl: 'http://localhost:9101',
    children: [
      { key: 'ontstudio-concepts', label: '本体管理', path: '/concepts' },
      { key: 'ontstudio-entities', label: '实体管理', path: '/entities' },
      { key: 'ontstudio-relations', label: '关系类型', path: '/relations' },
      { key: 'ontstudio-relation-instances', label: '关系实例', path: '/relation-instances' },
      { key: 'ontstudio-rules', label: '规则管理', path: '/rules' },
      { key: 'ontstudio-versions', label: '版本管理', path: '/versions' },
      { key: 'ontstudio-datasources', label: '数据源', path: '/datasources' },
      { key: 'ontstudio-mappings', label: '数据映射', path: '/mappings' },
      { key: 'ontstudio-quality', label: '数据质量', path: '/quality' },
      { key: 'ontstudio-lineage', label: '数据血缘', path: '/lineage' },
      { key: 'ontstudio-actions', label: 'Action 定义', path: '/actions' },
      { key: 'ontstudio-orchestrations', label: 'Action 编排', path: '/orchestrations' },
      { key: 'ontstudio-triggers', label: '触发器', path: '/triggers' },
      { key: 'ontstudio-executions', label: '执行监控', path: '/executions' },
      { key: 'ontstudio-graph', label: '知识图谱', path: '/graph' },
    ],
  },
  {
    key: 'arch',
    label: '架构中心',
    icon: 'PartitionOutlined',
    path: '/arch',
    appUrl: 'http://localhost:9206',
    children: [
      {
        key: 'arch-business',
        label: '业务架构',
        children: [
          { key: 'arch-overview', label: '架构总览', path: '/arch' },
          { key: 'arch-capabilities', label: '能力地图', path: '/arch/capabilities' },
          { key: 'arch-applications', label: '应用系统', path: '/arch/applications' },
          { key: 'arch-value-streams', label: '价值流', path: '/arch/value-streams' },
          { key: 'arch-processes', label: '业务流程', path: '/arch/processes' },
          { key: 'arch-org-roles', label: '组织与角色', path: '/arch/org-roles' },
        ],
      },
      {
        key: 'arch-data',
        label: '数据架构',
        children: [
          { key: 'arch-data-overview', label: '数据域/实体', path: '/arch/data' },
          { key: 'arch-data-flows', label: '数据流', path: '/arch/data/flows' },
          { key: 'arch-data-standards', label: '数据标准', path: '/arch/data/standards' },
          { key: 'arch-data-assets', label: '资产目录', path: '/arch/data/assets' },
        ],
      },
      {
        key: 'arch-tech',
        label: '技术架构',
        children: [
          { key: 'arch-tech-overview', label: '技术架构总览', path: '/arch/tech' },
          { key: 'arch-tech-components', label: '技术组件库', path: '/arch/tech-components' },
          { key: 'arch-tech-stacks', label: '技术栈画像', path: '/arch/tech-stacks' },
          { key: 'arch-deployment-topologies', label: '部署拓扑', path: '/arch/deployment-topologies' },
          { key: 'arch-tech-radar', label: '技术雷达', path: '/arch/tech-radar' },
        ],
      },
      {
        key: 'arch-governance',
        label: '架构治理',
        children: [
          { key: 'arch-principles', label: '原则与标准', path: '/arch/principles' },
          { key: 'arch-review-templates', label: '评审模板', path: '/arch/review-templates' },
          { key: 'arch-reviews', label: '评审流程', path: '/arch/reviews' },
          { key: 'arch-tech-debt', label: '技术债务', path: '/arch/tech-debt' },
        ],
      },
      {
        key: 'arch-integration',
        label: '集成',
        children: [
          { key: 'arch-ontology-mapping', label: '本体映射', path: '/arch/ontology-mapping' },
        ],
      },
    ],
  },
  {
    key: 'mcphub',
    label: 'MCP 服务中心',
    icon: 'ApiOutlined',
    path: '/',
    appUrl: 'http://localhost:9501',
    children: [
      { key: 'mcphub-overview', label: '概览', path: '/' },
      { key: 'mcphub-tools', label: '工具注册中心', path: '/tools' },
      { key: 'mcphub-servers', label: 'MCP Server', path: '/servers' },
      { key: 'mcphub-debugger', label: '调试器', path: '/debugger' },
      { key: 'mcphub-clients', label: 'MCP Client', path: '/clients' },
      {
        key: 'mcphub-permissions',
        label: '权限控制',
        children: [
          { key: 'mcphub-permissions-rules', label: '规则管理', path: '/permissions' },
          { key: 'mcphub-policies', label: 'ABAC 策略', path: '/policies' },
          { key: 'mcphub-matrix', label: '权限矩阵', path: '/matrix' },
        ],
      },
      { key: 'mcphub-resources', label: '资源配置', path: '/resources' },
      { key: 'mcphub-prompts', label: 'Prompt 模板', path: '/prompts' },
      { key: 'mcphub-audit', label: '调用审计', path: '/audit' },
      { key: 'mcphub-integrations', label: '外部对接', path: '/integrations' },
      {
        key: 'mcphub-external',
        label: '外部 Agent 对接',
        children: [
          { key: 'mcphub-external-agents', label: '外部 Agent 目录', path: '/external-agents' },
          { key: 'mcphub-trusts', label: '信任管理', path: '/trusts' },
          { key: 'mcphub-collaborations', label: '协作审计', path: '/collaborations' },
        ],
      },
      { key: 'mcphub-ide-config', label: 'IDE 配置', path: '/ide-config' },
      { key: 'mcphub-connection-monitor', label: '连接监控', path: '/connection-monitor' },
    ],
  },
];
