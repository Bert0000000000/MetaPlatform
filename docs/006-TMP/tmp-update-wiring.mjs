import { readFileSync, writeFileSync } from 'fs';

const designFile = 'd:\\Hermes\\Workspace\\10_Projects\\2026-07-02-MetaPlatform\\metaplatform-design-draft\\metaplatform-design-draft.design';
const design = JSON.parse(readFileSync(designFile, 'utf-8'));

// Sidebar navigation (all pages, hideEdge)
const sidebarInteractions = [
  { domId: 'nav-dashboard', targetPageId: 'page-dashboard', hideEdge: true, transitionLabel: '工作台' },
  { domId: 'nav-superai', targetPageId: 'page-superai-dialogue', hideEdge: true, transitionLabel: 'SuperAI' },
  { domId: 'nav-arch', targetPageId: 'page-arch-business', hideEdge: true, transitionLabel: '架构中心' },
  { domId: 'nav-apps', targetPageId: 'page-apps-list', hideEdge: true, transitionLabel: '应用中心' },
  { domId: 'nav-ontology', targetPageId: 'page-ontology-modeling', hideEdge: true, transitionLabel: '本体引擎' },
  { domId: 'nav-mcp', targetPageId: 'page-mcp-tools', hideEdge: true, transitionLabel: 'MCP 中心' },
  { domId: 'nav-agents', targetPageId: 'page-agents-list', hideEdge: true, transitionLabel: '数字员工' },
  { domId: 'nav-admin', targetPageId: 'page-admin-users', hideEdge: true, transitionLabel: '后台管理' },
];

// Tab wiring per module
const tabWiring = {
  'page-dashboard': [
    { domId: 'tab-myapps', targetPageId: 'page-dashboard-myapps', hideEdge: true, transitionLabel: '我的应用' },
    { domId: 'tab-myagents', targetPageId: 'page-dashboard-myagents', hideEdge: true, transitionLabel: '我的数字员工' },
    { domId: 'tab-messages', targetPageId: 'page-dashboard-messages', hideEdge: true, transitionLabel: '消息' },
    { domId: 'tab-portal', targetPageId: 'page-dashboard-portal', hideEdge: true, transitionLabel: '门户' },
    { domId: 'tab-deliverables', targetPageId: 'page-dashboard-deliverables', hideEdge: true, transitionLabel: '交付材料' },
  ],
  'page-dashboard-myapps': [
    { domId: 'tab-dashboard', targetPageId: 'page-dashboard', hideEdge: true, transitionLabel: '工作台' },
    { domId: 'tab-myagents', targetPageId: 'page-dashboard-myagents', hideEdge: true, transitionLabel: '我的数字员工' },
    { domId: 'tab-messages', targetPageId: 'page-dashboard-messages', hideEdge: true, transitionLabel: '消息' },
    { domId: 'tab-portal', targetPageId: 'page-dashboard-portal', hideEdge: true, transitionLabel: '门户' },
    { domId: 'tab-deliverables', targetPageId: 'page-dashboard-deliverables', hideEdge: true, transitionLabel: '交付材料' },
  ],
  'page-dashboard-myagents': [
    { domId: 'tab-dashboard', targetPageId: 'page-dashboard', hideEdge: true, transitionLabel: '工作台' },
    { domId: 'tab-myapps', targetPageId: 'page-dashboard-myapps', hideEdge: true, transitionLabel: '我的应用' },
    { domId: 'tab-messages', targetPageId: 'page-dashboard-messages', hideEdge: true, transitionLabel: '消息' },
    { domId: 'tab-portal', targetPageId: 'page-dashboard-portal', hideEdge: true, transitionLabel: '门户' },
    { domId: 'tab-deliverables', targetPageId: 'page-dashboard-deliverables', hideEdge: true, transitionLabel: '交付材料' },
  ],
  'page-dashboard-messages': [
    { domId: 'tab-dashboard', targetPageId: 'page-dashboard', hideEdge: true, transitionLabel: '工作台' },
    { domId: 'tab-myapps', targetPageId: 'page-dashboard-myapps', hideEdge: true, transitionLabel: '我的应用' },
    { domId: 'tab-myagents', targetPageId: 'page-dashboard-myagents', hideEdge: true, transitionLabel: '我的数字员工' },
    { domId: 'tab-portal', targetPageId: 'page-dashboard-portal', hideEdge: true, transitionLabel: '门户' },
    { domId: 'tab-deliverables', targetPageId: 'page-dashboard-deliverables', hideEdge: true, transitionLabel: '交付材料' },
  ],
  'page-dashboard-portal': [
    { domId: 'tab-dashboard', targetPageId: 'page-dashboard', hideEdge: true, transitionLabel: '工作台' },
    { domId: 'tab-myapps', targetPageId: 'page-dashboard-myapps', hideEdge: true, transitionLabel: '我的应用' },
    { domId: 'tab-myagents', targetPageId: 'page-dashboard-myagents', hideEdge: true, transitionLabel: '我的数字员工' },
    { domId: 'tab-messages', targetPageId: 'page-dashboard-messages', hideEdge: true, transitionLabel: '消息' },
    { domId: 'tab-deliverables', targetPageId: 'page-dashboard-deliverables', hideEdge: true, transitionLabel: '交付材料' },
  ],
  'page-dashboard-deliverables': [
    { domId: 'tab-dashboard', targetPageId: 'page-dashboard', hideEdge: true, transitionLabel: '工作台' },
    { domId: 'tab-myapps', targetPageId: 'page-dashboard-myapps', hideEdge: true, transitionLabel: '我的应用' },
    { domId: 'tab-myagents', targetPageId: 'page-dashboard-myagents', hideEdge: true, transitionLabel: '我的数字员工' },
    { domId: 'tab-messages', targetPageId: 'page-dashboard-messages', hideEdge: true, transitionLabel: '消息' },
    { domId: 'tab-portal', targetPageId: 'page-dashboard-portal', hideEdge: true, transitionLabel: '门户' },
  ],
  // Arch
  'page-arch-business': [
    { domId: 'tab-app', targetPageId: 'page-arch-app', hideEdge: true, transitionLabel: '应用架构' },
    { domId: 'tab-data', targetPageId: 'page-arch-data', hideEdge: true, transitionLabel: '数据架构' },
    { domId: 'tab-tech', targetPageId: 'page-arch-tech', hideEdge: true, transitionLabel: '技术架构' },
    { domId: 'tab-governance', targetPageId: 'page-arch-governance', hideEdge: true, transitionLabel: '架构治理' },
  ],
  'page-arch-app': [
    { domId: 'tab-business', targetPageId: 'page-arch-business', hideEdge: true, transitionLabel: '业务架构' },
    { domId: 'tab-data', targetPageId: 'page-arch-data', hideEdge: true, transitionLabel: '数据架构' },
    { domId: 'tab-tech', targetPageId: 'page-arch-tech', hideEdge: true, transitionLabel: '技术架构' },
    { domId: 'tab-governance', targetPageId: 'page-arch-governance', hideEdge: true, transitionLabel: '架构治理' },
  ],
  'page-arch-data': [
    { domId: 'tab-business', targetPageId: 'page-arch-business', hideEdge: true, transitionLabel: '业务架构' },
    { domId: 'tab-app', targetPageId: 'page-arch-app', hideEdge: true, transitionLabel: '应用架构' },
    { domId: 'tab-tech', targetPageId: 'page-arch-tech', hideEdge: true, transitionLabel: '技术架构' },
    { domId: 'tab-governance', targetPageId: 'page-arch-governance', hideEdge: true, transitionLabel: '架构治理' },
  ],
  'page-arch-tech': [
    { domId: 'tab-business', targetPageId: 'page-arch-business', hideEdge: true, transitionLabel: '业务架构' },
    { domId: 'tab-app', targetPageId: 'page-arch-app', hideEdge: true, transitionLabel: '应用架构' },
    { domId: 'tab-data', targetPageId: 'page-arch-data', hideEdge: true, transitionLabel: '数据架构' },
    { domId: 'tab-governance', targetPageId: 'page-arch-governance', hideEdge: true, transitionLabel: '架构治理' },
  ],
  'page-arch-governance': [
    { domId: 'tab-business', targetPageId: 'page-arch-business', hideEdge: true, transitionLabel: '业务架构' },
    { domId: 'tab-app', targetPageId: 'page-arch-app', hideEdge: true, transitionLabel: '应用架构' },
    { domId: 'tab-data', targetPageId: 'page-arch-data', hideEdge: true, transitionLabel: '数据架构' },
    { domId: 'tab-tech', targetPageId: 'page-arch-tech', hideEdge: true, transitionLabel: '技术架构' },
  ],
  // Apps
  'page-apps-list': [
    { domId: 'tab-detail', targetPageId: 'page-apps-detail', hideEdge: true, transitionLabel: '应用详情' },
    { domId: 'tab-modeling', targetPageId: 'page-apps-modeling', hideEdge: true, transitionLabel: '数据建模' },
    { domId: 'tab-formdesigner', targetPageId: 'page-apps-formdesigner', hideEdge: true, transitionLabel: '表单设计器' },
    { domId: 'tab-processdesigner', targetPageId: 'page-apps-processdesigner', hideEdge: true, transitionLabel: '流程设计器' },
    { domId: 'tab-config', targetPageId: 'page-apps-config', hideEdge: true, transitionLabel: '应用配置' },
    { domId: 'tab-publish', targetPageId: 'page-apps-publish', hideEdge: true, transitionLabel: '发布管理' },
    { domId: 'tab-version', targetPageId: 'page-apps-version', hideEdge: true, transitionLabel: '版本管理' },
  ],
  'page-apps-detail': [
    { domId: 'tab-list', targetPageId: 'page-apps-list', hideEdge: true, transitionLabel: '应用列表' },
    { domId: 'tab-modeling', targetPageId: 'page-apps-modeling', hideEdge: true, transitionLabel: '数据建模' },
    { domId: 'tab-formdesigner', targetPageId: 'page-apps-formdesigner', hideEdge: true, transitionLabel: '表单设计器' },
    { domId: 'tab-processdesigner', targetPageId: 'page-apps-processdesigner', hideEdge: true, transitionLabel: '流程设计器' },
    { domId: 'tab-config', targetPageId: 'page-apps-config', hideEdge: true, transitionLabel: '应用配置' },
    { domId: 'tab-publish', targetPageId: 'page-apps-publish', hideEdge: true, transitionLabel: '发布管理' },
    { domId: 'tab-version', targetPageId: 'page-apps-version', hideEdge: true, transitionLabel: '版本管理' },
  ],
  'page-apps-modeling': [
    { domId: 'tab-list', targetPageId: 'page-apps-list', hideEdge: true, transitionLabel: '应用列表' },
    { domId: 'tab-detail', targetPageId: 'page-apps-detail', hideEdge: true, transitionLabel: '应用详情' },
    { domId: 'tab-formdesigner', targetPageId: 'page-apps-formdesigner', hideEdge: true, transitionLabel: '表单设计器' },
    { domId: 'tab-processdesigner', targetPageId: 'page-apps-processdesigner', hideEdge: true, transitionLabel: '流程设计器' },
    { domId: 'tab-config', targetPageId: 'page-apps-config', hideEdge: true, transitionLabel: '应用配置' },
    { domId: 'tab-publish', targetPageId: 'page-apps-publish', hideEdge: true, transitionLabel: '发布管理' },
    { domId: 'tab-version', targetPageId: 'page-apps-version', hideEdge: true, transitionLabel: '版本管理' },
  ],
  'page-apps-formdesigner': [
    { domId: 'tab-list', targetPageId: 'page-apps-list', hideEdge: true, transitionLabel: '应用列表' },
    { domId: 'tab-detail', targetPageId: 'page-apps-detail', hideEdge: true, transitionLabel: '应用详情' },
    { domId: 'tab-modeling', targetPageId: 'page-apps-modeling', hideEdge: true, transitionLabel: '数据建模' },
    { domId: 'tab-processdesigner', targetPageId: 'page-apps-processdesigner', hideEdge: true, transitionLabel: '流程设计器' },
    { domId: 'tab-config', targetPageId: 'page-apps-config', hideEdge: true, transitionLabel: '应用配置' },
    { domId: 'tab-publish', targetPageId: 'page-apps-publish', hideEdge: true, transitionLabel: '发布管理' },
    { domId: 'tab-version', targetPageId: 'page-apps-version', hideEdge: true, transitionLabel: '版本管理' },
  ],
  'page-apps-processdesigner': [
    { domId: 'tab-list', targetPageId: 'page-apps-list', hideEdge: true, transitionLabel: '应用列表' },
    { domId: 'tab-detail', targetPageId: 'page-apps-detail', hideEdge: true, transitionLabel: '应用详情' },
    { domId: 'tab-modeling', targetPageId: 'page-apps-modeling', hideEdge: true, transitionLabel: '数据建模' },
    { domId: 'tab-formdesigner', targetPageId: 'page-apps-formdesigner', hideEdge: true, transitionLabel: '表单设计器' },
    { domId: 'tab-config', targetPageId: 'page-apps-config', hideEdge: true, transitionLabel: '应用配置' },
    { domId: 'tab-publish', targetPageId: 'page-apps-publish', hideEdge: true, transitionLabel: '发布管理' },
    { domId: 'tab-version', targetPageId: 'page-apps-version', hideEdge: true, transitionLabel: '版本管理' },
  ],
  'page-apps-config': [
    { domId: 'tab-list', targetPageId: 'page-apps-list', hideEdge: true, transitionLabel: '应用列表' },
    { domId: 'tab-detail', targetPageId: 'page-apps-detail', hideEdge: true, transitionLabel: '应用详情' },
    { domId: 'tab-modeling', targetPageId: 'page-apps-modeling', hideEdge: true, transitionLabel: '数据建模' },
    { domId: 'tab-formdesigner', targetPageId: 'page-apps-formdesigner', hideEdge: true, transitionLabel: '表单设计器' },
    { domId: 'tab-processdesigner', targetPageId: 'page-apps-processdesigner', hideEdge: true, transitionLabel: '流程设计器' },
    { domId: 'tab-publish', targetPageId: 'page-apps-publish', hideEdge: true, transitionLabel: '发布管理' },
    { domId: 'tab-version', targetPageId: 'page-apps-version', hideEdge: true, transitionLabel: '版本管理' },
  ],
  'page-apps-publish': [
    { domId: 'tab-list', targetPageId: 'page-apps-list', hideEdge: true, transitionLabel: '应用列表' },
    { domId: 'tab-detail', targetPageId: 'page-apps-detail', hideEdge: true, transitionLabel: '应用详情' },
    { domId: 'tab-modeling', targetPageId: 'page-apps-modeling', hideEdge: true, transitionLabel: '数据建模' },
    { domId: 'tab-formdesigner', targetPageId: 'page-apps-formdesigner', hideEdge: true, transitionLabel: '表单设计器' },
    { domId: 'tab-processdesigner', targetPageId: 'page-apps-processdesigner', hideEdge: true, transitionLabel: '流程设计器' },
    { domId: 'tab-config', targetPageId: 'page-apps-config', hideEdge: true, transitionLabel: '应用配置' },
    { domId: 'tab-version', targetPageId: 'page-apps-version', hideEdge: true, transitionLabel: '版本管理' },
  ],
  'page-apps-version': [
    { domId: 'tab-list', targetPageId: 'page-apps-list', hideEdge: true, transitionLabel: '应用列表' },
    { domId: 'tab-detail', targetPageId: 'page-apps-detail', hideEdge: true, transitionLabel: '应用详情' },
    { domId: 'tab-modeling', targetPageId: 'page-apps-modeling', hideEdge: true, transitionLabel: '数据建模' },
    { domId: 'tab-formdesigner', targetPageId: 'page-apps-formdesigner', hideEdge: true, transitionLabel: '表单设计器' },
    { domId: 'tab-processdesigner', targetPageId: 'page-apps-processdesigner', hideEdge: true, transitionLabel: '流程设计器' },
    { domId: 'tab-config', targetPageId: 'page-apps-config', hideEdge: true, transitionLabel: '应用配置' },
    { domId: 'tab-publish', targetPageId: 'page-apps-publish', hideEdge: true, transitionLabel: '发布管理' },
  ],
  // Ontology
  'page-ontology-modeling': [
    { domId: 'tab-datacenter', targetPageId: 'page-ontology-datacenter', hideEdge: true, transitionLabel: '数据中心' },
    { domId: 'tab-action', targetPageId: 'page-ontology-action', hideEdge: true, transitionLabel: 'Action 编排' },
    { domId: 'tab-graph', targetPageId: 'page-ontology-graph', hideEdge: true, transitionLabel: '知识图谱' },
  ],
  'page-ontology-datacenter': [
    { domId: 'tab-modeling', targetPageId: 'page-ontology-modeling', hideEdge: true, transitionLabel: '本体论管理' },
    { domId: 'tab-action', targetPageId: 'page-ontology-action', hideEdge: true, transitionLabel: 'Action 编排' },
    { domId: 'tab-graph', targetPageId: 'page-ontology-graph', hideEdge: true, transitionLabel: '知识图谱' },
  ],
  'page-ontology-action': [
    { domId: 'tab-modeling', targetPageId: 'page-ontology-modeling', hideEdge: true, transitionLabel: '本体论管理' },
    { domId: 'tab-datacenter', targetPageId: 'page-ontology-datacenter', hideEdge: true, transitionLabel: '数据中心' },
    { domId: 'tab-graph', targetPageId: 'page-ontology-graph', hideEdge: true, transitionLabel: '知识图谱' },
  ],
  'page-ontology-graph': [
    { domId: 'tab-modeling', targetPageId: 'page-ontology-modeling', hideEdge: true, transitionLabel: '本体论管理' },
    { domId: 'tab-datacenter', targetPageId: 'page-ontology-datacenter', hideEdge: true, transitionLabel: '数据中心' },
    { domId: 'tab-action', targetPageId: 'page-ontology-action', hideEdge: true, transitionLabel: 'Action 编排' },
  ],
  // MCP
  'page-mcp-tools': [
    { domId: 'tab-server', targetPageId: 'page-mcp-server', hideEdge: true, transitionLabel: 'Server 管理' },
    { domId: 'tab-client', targetPageId: 'page-mcp-client', hideEdge: true, transitionLabel: 'Client 管理' },
    { domId: 'tab-debugger', targetPageId: 'page-mcp-debugger', hideEdge: true, transitionLabel: '调试器' },
    { domId: 'tab-permissions', targetPageId: 'page-mcp-permissions', hideEdge: true, transitionLabel: '权限管理' },
    { domId: 'tab-external', targetPageId: 'page-mcp-external', hideEdge: true, transitionLabel: '外部对接' },
    { domId: 'tab-audit', targetPageId: 'page-mcp-audit', hideEdge: true, transitionLabel: '审计日志' },
  ],
  'page-mcp-server': [
    { domId: 'tab-tools', targetPageId: 'page-mcp-tools', hideEdge: true, transitionLabel: '工具注册' },
    { domId: 'tab-client', targetPageId: 'page-mcp-client', hideEdge: true, transitionLabel: 'Client 管理' },
    { domId: 'tab-debugger', targetPageId: 'page-mcp-debugger', hideEdge: true, transitionLabel: '调试器' },
    { domId: 'tab-permissions', targetPageId: 'page-mcp-permissions', hideEdge: true, transitionLabel: '权限管理' },
    { domId: 'tab-external', targetPageId: 'page-mcp-external', hideEdge: true, transitionLabel: '外部对接' },
    { domId: 'tab-audit', targetPageId: 'page-mcp-audit', hideEdge: true, transitionLabel: '审计日志' },
  ],
  'page-mcp-client': [
    { domId: 'tab-tools', targetPageId: 'page-mcp-tools', hideEdge: true, transitionLabel: '工具注册' },
    { domId: 'tab-server', targetPageId: 'page-mcp-server', hideEdge: true, transitionLabel: 'Server 管理' },
    { domId: 'tab-debugger', targetPageId: 'page-mcp-debugger', hideEdge: true, transitionLabel: '调试器' },
    { domId: 'tab-permissions', targetPageId: 'page-mcp-permissions', hideEdge: true, transitionLabel: '权限管理' },
    { domId: 'tab-external', targetPageId: 'page-mcp-external', hideEdge: true, transitionLabel: '外部对接' },
    { domId: 'tab-audit', targetPageId: 'page-mcp-audit', hideEdge: true, transitionLabel: '审计日志' },
  ],
  'page-mcp-debugger': [
    { domId: 'tab-tools', targetPageId: 'page-mcp-tools', hideEdge: true, transitionLabel: '工具注册' },
    { domId: 'tab-server', targetPageId: 'page-mcp-server', hideEdge: true, transitionLabel: 'Server 管理' },
    { domId: 'tab-client', targetPageId: 'page-mcp-client', hideEdge: true, transitionLabel: 'Client 管理' },
    { domId: 'tab-permissions', targetPageId: 'page-mcp-permissions', hideEdge: true, transitionLabel: '权限管理' },
    { domId: 'tab-external', targetPageId: 'page-mcp-external', hideEdge: true, transitionLabel: '外部对接' },
    { domId: 'tab-audit', targetPageId: 'page-mcp-audit', hideEdge: true, transitionLabel: '审计日志' },
  ],
  'page-mcp-permissions': [
    { domId: 'tab-tools', targetPageId: 'page-mcp-tools', hideEdge: true, transitionLabel: '工具注册' },
    { domId: 'tab-server', targetPageId: 'page-mcp-server', hideEdge: true, transitionLabel: 'Server 管理' },
    { domId: 'tab-client', targetPageId: 'page-mcp-client', hideEdge: true, transitionLabel: 'Client 管理' },
    { domId: 'tab-debugger', targetPageId: 'page-mcp-debugger', hideEdge: true, transitionLabel: '调试器' },
    { domId: 'tab-external', targetPageId: 'page-mcp-external', hideEdge: true, transitionLabel: '外部对接' },
    { domId: 'tab-audit', targetPageId: 'page-mcp-audit', hideEdge: true, transitionLabel: '审计日志' },
  ],
  'page-mcp-external': [
    { domId: 'tab-tools', targetPageId: 'page-mcp-tools', hideEdge: true, transitionLabel: '工具注册' },
    { domId: 'tab-server', targetPageId: 'page-mcp-server', hideEdge: true, transitionLabel: 'Server 管理' },
    { domId: 'tab-client', targetPageId: 'page-mcp-client', hideEdge: true, transitionLabel: 'Client 管理' },
    { domId: 'tab-debugger', targetPageId: 'page-mcp-debugger', hideEdge: true, transitionLabel: '调试器' },
    { domId: 'tab-permissions', targetPageId: 'page-mcp-permissions', hideEdge: true, transitionLabel: '权限管理' },
    { domId: 'tab-audit', targetPageId: 'page-mcp-audit', hideEdge: true, transitionLabel: '审计日志' },
  ],
  'page-mcp-audit': [
    { domId: 'tab-tools', targetPageId: 'page-mcp-tools', hideEdge: true, transitionLabel: '工具注册' },
    { domId: 'tab-server', targetPageId: 'page-mcp-server', hideEdge: true, transitionLabel: 'Server 管理' },
    { domId: 'tab-client', targetPageId: 'page-mcp-client', hideEdge: true, transitionLabel: 'Client 管理' },
    { domId: 'tab-debugger', targetPageId: 'page-mcp-debugger', hideEdge: true, transitionLabel: '调试器' },
    { domId: 'tab-permissions', targetPageId: 'page-mcp-permissions', hideEdge: true, transitionLabel: '权限管理' },
    { domId: 'tab-external', targetPageId: 'page-mcp-external', hideEdge: true, transitionLabel: '外部对接' },
  ],
  // Agents
  'page-agents-list': [
    { domId: 'tab-detail', targetPageId: 'page-agents-detail', hideEdge: true, transitionLabel: '数字员工详情' },
    { domId: 'tab-knowledge', targetPageId: 'page-agents-knowledge', hideEdge: true, transitionLabel: '知识提炼' },
    { domId: 'tab-tasks', targetPageId: 'page-agents-tasks', hideEdge: true, transitionLabel: '任务管理' },
    { domId: 'tab-collab', targetPageId: 'page-agents-collab', hideEdge: true, transitionLabel: '协作中心' },
    { domId: 'tab-evaluation', targetPageId: 'page-agents-evaluation', hideEdge: true, transitionLabel: '效果评估' },
  ],
  'page-agents-detail': [
    { domId: 'tab-list', targetPageId: 'page-agents-list', hideEdge: true, transitionLabel: '数字员工列表' },
    { domId: 'tab-knowledge', targetPageId: 'page-agents-knowledge', hideEdge: true, transitionLabel: '知识提炼' },
    { domId: 'tab-tasks', targetPageId: 'page-agents-tasks', hideEdge: true, transitionLabel: '任务管理' },
    { domId: 'tab-collab', targetPageId: 'page-agents-collab', hideEdge: true, transitionLabel: '协作中心' },
    { domId: 'tab-evaluation', targetPageId: 'page-agents-evaluation', hideEdge: true, transitionLabel: '效果评估' },
  ],
  'page-agents-knowledge': [
    { domId: 'tab-list', targetPageId: 'page-agents-list', hideEdge: true, transitionLabel: '数字员工列表' },
    { domId: 'tab-detail', targetPageId: 'page-agents-detail', hideEdge: true, transitionLabel: '数字员工详情' },
    { domId: 'tab-tasks', targetPageId: 'page-agents-tasks', hideEdge: true, transitionLabel: '任务管理' },
    { domId: 'tab-collab', targetPageId: 'page-agents-collab', hideEdge: true, transitionLabel: '协作中心' },
    { domId: 'tab-evaluation', targetPageId: 'page-agents-evaluation', hideEdge: true, transitionLabel: '效果评估' },
  ],
  'page-agents-tasks': [
    { domId: 'tab-list', targetPageId: 'page-agents-list', hideEdge: true, transitionLabel: '数字员工列表' },
    { domId: 'tab-detail', targetPageId: 'page-agents-detail', hideEdge: true, transitionLabel: '数字员工详情' },
    { domId: 'tab-knowledge', targetPageId: 'page-agents-knowledge', hideEdge: true, transitionLabel: '知识提炼' },
    { domId: 'tab-collab', targetPageId: 'page-agents-collab', hideEdge: true, transitionLabel: '协作中心' },
    { domId: 'tab-evaluation', targetPageId: 'page-agents-evaluation', hideEdge: true, transitionLabel: '效果评估' },
  ],
  'page-agents-collab': [
    { domId: 'tab-list', targetPageId: 'page-agents-list', hideEdge: true, transitionLabel: '数字员工列表' },
    { domId: 'tab-detail', targetPageId: 'page-agents-detail', hideEdge: true, transitionLabel: '数字员工详情' },
    { domId: 'tab-knowledge', targetPageId: 'page-agents-knowledge', hideEdge: true, transitionLabel: '知识提炼' },
    { domId: 'tab-tasks', targetPageId: 'page-agents-tasks', hideEdge: true, transitionLabel: '任务管理' },
    { domId: 'tab-evaluation', targetPageId: 'page-agents-evaluation', hideEdge: true, transitionLabel: '效果评估' },
  ],
  'page-agents-evaluation': [
    { domId: 'tab-list', targetPageId: 'page-agents-list', hideEdge: true, transitionLabel: '数字员工列表' },
    { domId: 'tab-detail', targetPageId: 'page-agents-detail', hideEdge: true, transitionLabel: '数字员工详情' },
    { domId: 'tab-knowledge', targetPageId: 'page-agents-knowledge', hideEdge: true, transitionLabel: '知识提炼' },
    { domId: 'tab-tasks', targetPageId: 'page-agents-tasks', hideEdge: true, transitionLabel: '任务管理' },
    { domId: 'tab-collab', targetPageId: 'page-agents-collab', hideEdge: true, transitionLabel: '协作中心' },
  ],
  // Admin
  'page-admin-users': [
    { domId: 'tab-permissions', targetPageId: 'page-admin-permissions', hideEdge: true, transitionLabel: '权限管理' },
    { domId: 'tab-org', targetPageId: 'page-admin-org', hideEdge: true, transitionLabel: '组织管理' },
    { domId: 'tab-logs', targetPageId: 'page-admin-logs', hideEdge: true, transitionLabel: '日志管理' },
    { domId: 'tab-config', targetPageId: 'page-admin-config', hideEdge: true, transitionLabel: '系统配置' },
  ],
  'page-admin-permissions': [
    { domId: 'tab-users', targetPageId: 'page-admin-users', hideEdge: true, transitionLabel: '用户管理' },
    { domId: 'tab-org', targetPageId: 'page-admin-org', hideEdge: true, transitionLabel: '组织管理' },
    { domId: 'tab-logs', targetPageId: 'page-admin-logs', hideEdge: true, transitionLabel: '日志管理' },
    { domId: 'tab-config', targetPageId: 'page-admin-config', hideEdge: true, transitionLabel: '系统配置' },
  ],
  'page-admin-org': [
    { domId: 'tab-users', targetPageId: 'page-admin-users', hideEdge: true, transitionLabel: '用户管理' },
    { domId: 'tab-permissions', targetPageId: 'page-admin-permissions', hideEdge: true, transitionLabel: '权限管理' },
    { domId: 'tab-logs', targetPageId: 'page-admin-logs', hideEdge: true, transitionLabel: '日志管理' },
    { domId: 'tab-config', targetPageId: 'page-admin-config', hideEdge: true, transitionLabel: '系统配置' },
  ],
  'page-admin-logs': [
    { domId: 'tab-users', targetPageId: 'page-admin-users', hideEdge: true, transitionLabel: '用户管理' },
    { domId: 'tab-permissions', targetPageId: 'page-admin-permissions', hideEdge: true, transitionLabel: '权限管理' },
    { domId: 'tab-org', targetPageId: 'page-admin-org', hideEdge: true, transitionLabel: '组织管理' },
    { domId: 'tab-config', targetPageId: 'page-admin-config', hideEdge: true, transitionLabel: '系统配置' },
  ],
  'page-admin-config': [
    { domId: 'tab-users', targetPageId: 'page-admin-users', hideEdge: true, transitionLabel: '用户管理' },
    { domId: 'tab-permissions', targetPageId: 'page-admin-permissions', hideEdge: true, transitionLabel: '权限管理' },
    { domId: 'tab-org', targetPageId: 'page-admin-org', hideEdge: true, transitionLabel: '组织管理' },
    { domId: 'tab-logs', targetPageId: 'page-admin-logs', hideEdge: true, transitionLabel: '日志管理' },
  ],
};

for (const node of design.data) {
  if (node.type === 'page') {
    const tabs = tabWiring[node.id] || [];
    node.devMetadata.interactions = [...sidebarInteractions, ...tabs];
  }
}

writeFileSync(designFile, JSON.stringify(design, null, 2), 'utf-8');
console.log('Updated .design with sidebar + tab wiring for all pages');
console.log(`Total pages: ${design.data.filter(n => n.type === 'page').length}`);
const totalInteractions = design.data.reduce((sum, n) => sum + (n.type === 'page' ? n.devMetadata.interactions.length : 0), 0);
console.log(`Total interactions: ${totalInteractions}`);