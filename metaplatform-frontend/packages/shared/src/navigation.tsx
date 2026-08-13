import type { ReactNode } from 'react';
import {
  LayoutDashboard,
  Sparkles,
  GitBranch,
  Boxes,
  Database,
  BookOpen,
  Plug,
  Bot,
  Settings,
  Store,
} from './icons';

/** 菜单项：有 path 即页面入口；有 children 即分组（Semi Nav SubNav）；hidden 只用于面包屑不渲染菜单 */
export interface SubMenuItem {
  key: string;
  label: string;
  path?: string;
  children?: SubMenuItem[];
  hidden?: boolean;
}

export interface ModuleMenuItem {
  key: string;
  label: string;
  icon: ReactNode;
  /** 一级默认路由（进入模块时跳转） */
  path: string;
  /** 二级菜单（分组 + 页面项，与 App.tsx 路由保持一致） */
  children: SubMenuItem[];
}

/**
 * 平台导航结构（Semi Nav 模板：一级模块 + 二级分组 + 三级页面项）。
 * 二级项多的模块按业务语义分组分栏，避免单栏过长。
 */
export const MODULE_MENU: ModuleMenuItem[] = [
  {
    key: 'dashboard',
    label: '工作台',
    icon: <LayoutDashboard style={{ width: 18, height: 18, strokeWidth: 1.5 }} />,
    path: '/dashboard',
    // 工作台为纯一级菜单，子页面仅用于 Header 面包屑匹配（hidden 不渲染进菜单）
    children: [
      { key: 'dashboard', label: '工作台', path: '/dashboard', hidden: true },
      { key: 'my-apps', label: '我的应用', path: '/dashboard/my-apps', hidden: true },
      { key: 'my-agents', label: '我的数字员工', path: '/dashboard/my-agents', hidden: true },
      { key: 'messages', label: '消息中心', path: '/dashboard/messages', hidden: true },
      { key: 'portal', label: '门户', path: '/dashboard/portal', hidden: true },
      { key: 'notifications', label: '通知', path: '/dashboard/notifications', hidden: true },
      { key: 'deliverables', label: '交付材料', path: '/dashboard/deliverables', hidden: true },
      { key: 'aiops', label: '智能运维', path: '/dashboard/aiops', hidden: true },
      { key: 'settings', label: '设置', path: '/dashboard/settings', hidden: true },
    ],
  },
  {
    key: 'superai',
    label: 'SuperAI',
    icon: <Sparkles style={{ width: 18, height: 18, strokeWidth: 1.5 }} />,
    path: '/superai/chat',
    // 纯一级菜单，直接进入对话窗口；其余页面仅用于面包屑匹配（hidden）
    children: [
      { key: 'chat', label: 'AI 对话', path: '/superai/chat', hidden: true },
      { key: 'overview', label: '概览', path: '/superai', hidden: true },
      { key: 'a2a', label: 'A2A 协作', path: '/superai/a2a', hidden: true },
      { key: 'copilot', label: 'Copilot', path: '/superai/copilot', hidden: true },
      { key: 'execution', label: '执行计划', path: '/superai/execution', hidden: true },
      { key: 'schedule', label: '调度中心', path: '/superai/schedule', hidden: true },
      { key: 'tasks', label: '任务编排', path: '/superai/tasks', hidden: true },
      { key: 'templates', label: '任务模板', path: '/superai/templates', hidden: true },
      { key: 'cost', label: '成本优化', path: '/superai/cost', hidden: true },
      { key: 'data', label: '数据分析', path: '/superai/data', hidden: true },
      { key: 'employee-match', label: '员工匹配', path: '/superai/employee-match', hidden: true },
    ],
  },
  {
    key: 'arch',
    label: '架构中心',
    icon: <GitBranch style={{ width: 18, height: 18, strokeWidth: 1.5 }} />,
    path: '/arch/business',
    // 纯一级菜单，6 个 tab 子页面在内容区（ModuleTabsLayout）内导航；以下仅用于面包屑匹配（hidden）
    children: [
      { key: 'business', label: '业务架构', path: '/arch/business', hidden: true },
      { key: 'capabilities', label: '能力地图', path: '/arch/capabilities', hidden: true },
      { key: 'value-streams', label: '价值流', path: '/arch/value-streams', hidden: true },
      { key: 'processes', label: '业务流程', path: '/arch/processes', hidden: true },
      { key: 'org-roles', label: '组织角色', path: '/arch/org-roles', hidden: true },
      { key: 'applications', label: '应用全景', path: '/arch/applications', hidden: true },
      { key: 'tech-debt', label: '技术债务', path: '/arch/tech-debt', hidden: true },
      { key: 'data', label: '数据架构', path: '/arch/data', hidden: true },
      { key: 'data-flows', label: '数据流转', path: '/arch/data/flows', hidden: true },
      { key: 'data-assets', label: '资产目录', path: '/arch/data/assets', hidden: true },
      { key: 'data-standards', label: '数据标准', path: '/arch/data/standards', hidden: true },
      { key: 'tech', label: '技术架构', path: '/arch/tech', hidden: true },
      { key: 'tech-components', label: '技术组件', path: '/arch/tech-components', hidden: true },
      { key: 'tech-stacks', label: '技术栈', path: '/arch/tech-stacks', hidden: true },
      { key: 'deployment-topologies', label: '部署拓扑', path: '/arch/deployment-topologies', hidden: true },
      { key: 'tech-radar', label: '技术雷达', path: '/arch/tech-radar', hidden: true },
      { key: 'principles', label: '架构原则', path: '/arch/principles', hidden: true },
      { key: 'reviews', label: '架构评审', path: '/arch/reviews', hidden: true },
      { key: 'review-templates', label: '评审模板', path: '/arch/review-templates', hidden: true },
      { key: 'ontology-mapping', label: 'Ontology联动', path: '/arch/ontology-mapping', hidden: true },
    ],
  },
  {
    key: 'apps',
    label: '应用中心',
    icon: <Boxes style={{ width: 18, height: 18, strokeWidth: 1.5 }} />,
    path: '/apps',
    children: [
      { key: 'apps', label: '应用列表', path: '/apps' },
      { key: 'market', label: '模板市场', path: '/market' },
      { key: 'my-templates', label: '我的模板', path: '/my-templates' },
      { key: 'ai-designer', label: 'AI 设计器', path: '/ai-designer' },
    ],
  },
  {
    key: 'ontology',
    label: '本体引擎',
    icon: <Database style={{ width: 18, height: 18, strokeWidth: 1.5 }} />,
    path: '/ontology',
    children: [
      {
        key: 'modeling',
        label: '建模',
        children: [
          { key: 'concept', label: '概念建模', path: '/ontology' },
          { key: 'relationship-types', label: '关系类型', path: '/ontology/relationship-types' },
          { key: 'action-types', label: '动作类型', path: '/ontology/actions' },
        ],
      },
      {
        key: 'data-center',
        label: '数据',
        children: [
          { key: 'datacenter', label: '数据中心', path: '/ontology/datacenter' },
          { key: 'action', label: '动作', path: '/ontology/action' },
          { key: 'graph', label: '关系图谱', path: '/ontology/graph' },
        ],
      },
    ],
  },
  {
    key: 'marketplace',
    label: '云市场',
    icon: <Store style={{ width: 18, height: 18, strokeWidth: 1.5 }} />,
    path: '/marketplace',
    children: [
      { key: 'marketplace', label: '云市场', path: '/marketplace' },
      { key: 'market', label: '模板市场', path: '/market' },
      { key: 'my-templates', label: '我的模板', path: '/my-templates' },
      { key: 'template-submit', label: '提交模板', path: '/my-templates/submit' },
    ],
  },
  {
    key: 'knowledge',
    label: '知识库',
    icon: <BookOpen style={{ width: 18, height: 18, strokeWidth: 1.5 }} />,
    path: '/knowledge',
    children: [
      { key: 'kb-list', label: '知识库列表', path: '/knowledge' },
      { key: 'kb-docs', label: '文档管理', path: '/knowledge/docs' },
      { key: 'kb-test', label: '检索测试', path: '/knowledge/test' },
      { key: 'kb-config', label: '检索配置', path: '/knowledge/config' },
    ],
  },
  {
    key: 'mcp',
    label: 'MCP 中心',
    icon: <Plug style={{ width: 18, height: 18, strokeWidth: 1.5 }} />,
    path: '/mcp/skill-hub',
    children: [
      {
        key: 'hub',
        label: 'HUB',
        children: [
          { key: 'skill-hub', label: 'Skill Hub', path: '/mcp/skill-hub' },
        ],
      },
      {
        key: 'protocol',
        label: 'MCP 协议',
        children: [
          { key: 'overview', label: 'MCP 总览', path: '/mcp/overview' },
          { key: 'tools', label: '工具', path: '/mcp/tools' },
          { key: 'resources', label: '资源', path: '/mcp/resources' },
          { key: 'prompts', label: '提示词', path: '/mcp/prompts' },
          { key: 'debugger', label: '调试器', path: '/mcp/debugger' },
          { key: 'ide-config', label: 'IDE 配置', path: '/mcp/ide-config' },
        ],
      },
      {
        key: 'service-mgmt',
        label: '服务管理',
        children: [
          { key: 'servers', label: '服务端', path: '/mcp/servers' },
          { key: 'clients', label: '客户端', path: '/mcp/clients' },
          { key: 'permissions', label: '权限', path: '/mcp/permissions' },
          { key: 'policies', label: '策略', path: '/mcp/policies' },
        ],
      },
      {
        key: 'observability',
        label: '可观测',
        children: [
          { key: 'audit', label: '审计', path: '/mcp/audit' },
          { key: 'connection-monitor', label: '连接监控', path: '/mcp/connection-monitor' },
        ],
      },
      {
        key: 'a2a-registry',
        label: 'A2A 注册中心',
        children: [
          { key: 'internal-agents', label: '内部 Agent', path: '/mcp/internal-agents' },
          { key: 'external-agents', label: '外部 Agent', path: '/mcp/external-agents' },
        ],
      },
    ],
  },
  {
    key: 'agents',
    label: '数字员工',
    icon: <Bot style={{ width: 18, height: 18, strokeWidth: 1.5 }} />,
    path: '/agents',
    children: [
      {
        key: 'employees',
        label: '员工',
        children: [
          { key: 'list', label: '数字员工', path: '/agents' },
          { key: 'external', label: '外部 Agent', path: '/agents/external' },
        ],
      },
      {
        key: 'work',
        label: '工作',
        children: [
          { key: 'tasks', label: '任务', path: '/agents/tasks' },
          { key: 'collab', label: '协作', path: '/agents/collab' },
          { key: 'evaluation', label: '评估', path: '/agents/evaluation' },
        ],
      },
    ],
  },
  {
    key: 'admin',
    label: '后台管理',
    icon: <Settings style={{ width: 18, height: 18, strokeWidth: 1.5 }} />,
    path: '/admin',
    children: [
      {
        key: 'iam',
        label: '身份与组织',
        children: [
          { key: 'overview', label: '总览', path: '/admin' },
          { key: 'users', label: '用户', path: '/admin/users' },
          { key: 'permissions', label: '权限', path: '/admin/permissions' },
          { key: 'orgs', label: '组织', path: '/admin/orgs' },
        ],
      },
      {
        key: 'operations',
        label: '运维',
        children: [
          { key: 'logs', label: '日志', path: '/admin/logs' },
          { key: 'configs', label: '配置', path: '/admin/configs' },
          { key: 'ai-providers', label: 'AI 供应商', path: '/admin/ai-providers' },
          { key: 'ops', label: '运维', path: '/admin/operations' },
          { key: 'analytics', label: '分析', path: '/admin/analytics' },
        ],
      },
      {
        key: 'dev',
        label: '开发',
        children: [
          { key: 'components', label: '组件', path: '/admin/components' },
          { key: 'flowgram', label: 'Flowgram', path: '/admin/flowgram' },
        ],
      },
    ],
  },
];

export interface FlatMenuItem {
  key: string;
  label: string;
  path: string;
  moduleKey: string;
  groupKey: string;
}

/** 展平全部页面项（含三级），用于按 path 反查 */
export function flattenMenu(): FlatMenuItem[] {
  const out: FlatMenuItem[] = [];
  for (const module of MODULE_MENU) {
    for (const item of module.children) {
      if (item.children?.length) {
        for (const child of item.children) {
          if (child.path) {
            out.push({
              key: child.key,
              label: child.label,
              path: child.path,
              moduleKey: module.key,
              groupKey: item.key,
            });
          }
        }
      } else if (item.path) {
        out.push({
          key: item.key,
          label: item.label,
          path: item.path,
          moduleKey: module.key,
          groupKey: '',
        });
      }
    }
  }
  return out;
}
