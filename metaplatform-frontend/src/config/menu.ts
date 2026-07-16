/**
 * 菜单配置（基于《MetaPlatform 菜单产品设计 v3.1》）
 * - 一级菜单 12 项
 * - 5 类角色分发
 * - 每个菜单内 5-9 个 Tab
 *
 * icon 字段统一使用 Lucide React 图标组件
 */

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Sparkles,
  Building2,
  Smartphone,
  GitBranch,
  BarChart3,
  Dna,
  CheckCircle2,
  BookOpen,
  Cloud,
  Users,
  Settings2,
  Target,
  ClipboardList,
  Bell,
  Wrench,
  Zap,
  Scale,
  FileText,
  HeartPulse,
  AlertTriangle,
  TrendingUp,
  Hammer,
} from "lucide-react";

export type Role =
  | "super_admin"
  | "admin"
  | "executive"
  | "business"
  | "developer"
  | "architect"
  | "ops"
  // Aliases used in some pages for "executive+"-style views:
  | "leader"
  | "manager";

export type MenuKey =
  | "dashboard"
  | "superai"
  | "architecture"
  | "apps"
  | "process"
  | "data"
  | "ontology"
  | "quality"
  | "knowledge"
  | "market"
  | "agents"
  | "admin";

export interface MenuItem {
  key: MenuKey;
  icon: LucideIcon;
  label: string;
  path: string;
  description?: string;
}

export interface RoleConfig {
  id: Role;
  label: string;
  description: string;
}

/**
 * 7 类角色定义
 */
export const ROLES: RoleConfig[] = [
  {
    id: "super_admin",
    label: "超级管理员",
    description: "拥有全部系统权限",
  },
  {
    id: "admin",
    label: "管理员",
    description: "系统管理/配置管理",
  },
  {
    id: "executive",
    label: "领导用户",
    description: "高管/部门负责人",
  },
  {
    id: "business",
    label: "业务人员",
    description: "业务人员/产品经理",
  },
  {
    id: "developer",
    label: "开发人员",
    description: "建模师/全栈/低代码开发",
  },
  {
    id: "architect",
    label: "架构师",
    description: "EA 架构师",
  },
  {
    id: "ops",
    label: "运维人员",
    description: "系统管理员/SRE",
  },
];

/**
 * 12 个一级菜单定义
 */
export const MENU_ITEMS: MenuItem[] = [
  {
    key: "dashboard",
    icon: LayoutDashboard,
    label: "工作台",
    path: "/dashboard",
    description: "千人千面工作台 + 我的应用 + 数字员工 + 门户 + 自由页面",
  },
  {
    key: "superai",
    icon: Sparkles,
    label: "SuperAI",
    path: "/superai",
    description: "AI 对话入口",
  },
  {
    key: "architecture",
    icon: Building2,
    label: "架构中心",
    path: "/architecture",
    description: "4A 架构（业务/应用/数据/技术）",
  },
  {
    key: "apps",
    icon: Smartphone,
    label: "应用中心",
    path: "/apps",
    description: "应用构建（NoCode+LowCode+ProCode+VibeCoding）",
  },
  {
    key: "process",
    icon: GitBranch,
    label: "流程中心",
    path: "/process",
    description: "BPMN 2.0 + 业务流程 + 审批流程 + 服务编排",
  },
  {
    key: "data",
    icon: BarChart3,
    label: "数据中心",
    path: "/data",
    description: "智能问数 + 指标 + 数据湖仓",
  },
  {
    key: "ontology",
    icon: Dna,
    label: "本体引擎",
    path: "/ontology",
    description: "本体 8 要素",
  },
  {
    key: "quality",
    icon: CheckCircle2,
    label: "质量中心",
    path: "/quality",
    description: "AI 测试 + 自动化测试 + 流程测试",
  },
  {
    key: "knowledge",
    icon: BookOpen,
    label: "知识库",
    path: "/knowledge",
    description: "文档 + RAG + GraphRAG",
  },
  {
    key: "market",
    icon: Cloud,
    label: "云市场",
    path: "/market",
    description: "6 类模板分发",
  },
  {
    key: "agents",
    icon: Users,
    label: "数字员工",
    path: "/agents",
    description: "多智能体协作 + 决策会议",
  },
  {
    key: "admin",
    icon: Settings2,
    label: "后台管理",
    path: "/admin",
    description: "用户 + 权限 + 监控 + 部署 + 计费",
  },
];

/**
 * 7 类角色的一级菜单可见性
 */
const ALL_MENUS: MenuKey[] = [
  "dashboard", "superai", "architecture", "apps", "process", "data",
  "ontology", "quality", "knowledge", "market", "agents", "admin",
];

export const MENU_BY_ROLE: Record<Role, MenuKey[]> = {
  super_admin: ALL_MENUS,
  admin: ALL_MENUS,
  executive: [
    "dashboard",
    "superai",
    "apps",
    "process",
    "data",
    "knowledge",
    "market",
    "agents",
    "admin",
  ],
  business: [
    "dashboard",
    "superai",
    "apps",
    "process",
    "data",
    "ontology",
    "knowledge",
    "market",
    "agents",
  ],
  developer: [
    "dashboard",
    "superai",
    "architecture",
    "apps",
    "process",
    "data",
    "ontology",
    "quality",
    "knowledge",
    "market",
    "agents",
  ],
  architect: [
    "dashboard",
    "superai",
    "architecture",
    "apps",
    "process",
    "data",
    "ontology",
    "knowledge",
    "market",
    "agents",
  ],
  ops: [
    "dashboard",
    "superai",
    "apps",
    "process",
    "data",
    "ontology",
    "quality",
    "knowledge",
    "market",
    "agents",
    "admin",
  ],
  // leader/manager 是 executive 的 alias, 共用同一份菜单配置
  leader: [
    "dashboard",
    "superai",
    "apps",
    "process",
    "data",
    "knowledge",
    "market",
    "agents",
    "admin",
  ],
  manager: [
    "dashboard",
    "superai",
    "apps",
    "process",
    "data",
    "knowledge",
    "market",
    "agents",
    "admin",
  ],
};

/**
 * 根据角色获取可见菜单
 */
export function getMenusByRole(role: Role): MenuItem[] {
  const keys = MENU_BY_ROLE[role];
  return MENU_ITEMS.filter((item) => keys.includes(item.key));
}

/**
 * 每个一级菜单的 Tab 配置
 */
export interface TabConfig {
  key: string;
  label: string;
  path: string;
}

export const MENU_TABS: Record<MenuKey, TabConfig[]> = {
  dashboard: [
    { key: "workspace", label: "工作台", path: "" },
    { key: "myapps", label: "我的应用", path: "/myapps" },
    { key: "myagents", label: "我的数字员工", path: "/myagents" },
    { key: "messages", label: "消息", path: "/messages" },
    { key: "portal", label: "门户", path: "/portal" },
    { key: "freepage", label: "自由页面", path: "/freepage" },
  ],
  superai: [
    { key: "chat", label: "AI 对话", path: "" },
    { key: "agents", label: "智能体广场", path: "/agents" },
    { key: "tasks", label: "智能体任务", path: "/tasks" },
    { key: "knowledge", label: "知识中心", path: "/knowledge" },
  ],
  architecture: [
    { key: "business", label: "业务架构", path: "/business" },
    { key: "application", label: "应用架构", path: "/application" },
    { key: "data", label: "数据架构", path: "/data" },
    { key: "tech", label: "技术架构", path: "/tech" },
  ],
  apps: [
    { key: "list", label: "应用列表", path: "" },
    { key: "overview", label: "概览", path: "/overview" },
    { key: "datamodeling", label: "业务数据建模", path: "/datamodeling" },
    { key: "pages", label: "页面", path: "/pages" },
    { key: "workflows", label: "流程", path: "/workflows" },
    { key: "config", label: "应用配置", path: "/config" },
    { key: "publish", label: "应用发布", path: "/publish" },
    { key: "export", label: "应用导出", path: "/export" },
  ],
  process: [
    { key: "business", label: "业务流程", path: "/business" },
    { key: "approval", label: "审批流程", path: "/approval" },
    { key: "orchestration", label: "服务编排", path: "/orchestration" },
    { key: "instances", label: "流程实例", path: "/instances" },
    { key: "approvals", label: "审批中心", path: "/approvals" },
    { key: "triggers", label: "触发器", path: "/triggers" },
    { key: "analysis", label: "流程分析", path: "/analysis" },
    { key: "platform", label: "流程中台", path: "/platform" },
    { key: "export", label: "流程导出", path: "/export" },
  ],
  data: [
    { key: "dashboard", label: "指标看板", path: "/dashboard" },
    { key: "ask", label: "智能问数", path: "/ask" },
    { key: "metrics", label: "指标中心", path: "/metrics" },
    { key: "decision", label: "决策推送", path: "/decision" },
    { key: "sources", label: "数据源", path: "/sources" },
    { key: "lakehouse", label: "数据湖仓", path: "/lakehouse" },
    { key: "knowledge", label: "知识库", path: "/knowledge" },
  ],
  ontology: [
    { key: "objects", label: "对象", path: "/objects" },
    { key: "properties", label: "属性", path: "/properties" },
    { key: "links", label: "关系", path: "/links" },
    { key: "actions", label: "动作", path: "/actions" },
    { key: "functions", label: "函数", path: "/functions" },
    { key: "rules", label: "流程规则", path: "/rules" },
    { key: "orchestration", label: "业务流程编排", path: "/orchestration" },
    { key: "security", label: "安全", path: "/security" },
    { key: "governance", label: "治理与发布", path: "/governance" },
    { key: "instances", label: "数据实例", path: "/instances" },
    { key: "impact", label: "影响分析", path: "/impact" },
    { key: "diff", label: "版本对比", path: "/diff" },
    { key: "lint", label: "规范检查", path: "/lint" },
    { key: "events", label: "事件流", path: "/events" },
    { key: "graph", label: "知识图谱", path: "/graph" },
    { key: "reasoning", label: "本体推理", path: "/reasoning" },
    { key: "templates", label: "本体模板库", path: "/templates" },
    { key: "reverse", label: "反向工程", path: "/reverse" },
    { key: "io", label: "导入导出", path: "/io" },
  ],
  quality: [
    { key: "cases", label: "测试用例", path: "/cases" },
    { key: "ontology-test", label: "本体测试", path: "/ontology-test" },
    { key: "ai-ui", label: "AI UI 测试", path: "/ai-ui" },
    { key: "process-test", label: "流程测试", path: "/process-test" },
    { key: "bug-fix", label: "AI Bug 修复", path: "/bug-fix" },
    { key: "report", label: "测试报告", path: "/report" },
  ],
  knowledge: [
    { key: "documents", label: "文档管理", path: "/documents" },
    { key: "process", label: "知识加工", path: "/process" },
    { key: "search", label: "知识搜索", path: "/search" },
    { key: "subscribe", label: "知识订阅", path: "/subscribe" },
  ],
  market: [
    { key: "ontology-templates", label: "本体行业模板", path: "/ontology-templates" },
    { key: "skills", label: "Skill 市场", path: "/skills" },
    { key: "agents", label: "Agent 模板", path: "/agents" },
    { key: "workflows", label: "工作流模板", path: "/workflows" },
    { key: "knowledge", label: "知识包资源库", path: "/knowledge" },
    { key: "api", label: "API 动作库", path: "/api" },
    { key: "public", label: "公开应用市场", path: "/public" },
  ],
  agents: [
    { key: "mine", label: "我的数字员工", path: "/mine" },
    { key: "collaboration", label: "多智能体协作", path: "/collaboration" },
    { key: "identity", label: "身份与记忆", path: "/identity" },
    { key: "workspace", label: "工作空间", path: "/workspace" },
    { key: "permissions", label: "权限渠道", path: "/permissions" },
    { key: "model", label: "模型及用量", path: "/model" },
  ],
  admin: [
    { key: "users", label: "用户", path: "/users" },
    { key: "roles", label: "权限", path: "/roles" },
    { key: "org", label: "组织架构", path: "/org" },
    { key: "monitor", label: "监控日志", path: "/monitor" },
    { key: "backup", label: "备份恢复", path: "/backup" },
    { key: "deploy", label: "部署环境", path: "/deploy" },
    { key: "billing", label: "计费", path: "/billing" },
    { key: "plugins", label: "插件管理", path: "/plugins" },
  ],
};

/**
 * 超级管理员独享 tab（在标准 admin tabs 之上额外展示）
 * 与 MENU_TABS['admin'] 合并渲染：先列 admin 共用 tab，再追加
 * 这里的独有 tab 并用 Badge '仅超管' 标识。
 */
export const SUPER_ADMIN_EXTRA_TABS: TabConfig[] = [
  { key: "tenants", label: "全部租户", path: "/tenants" },
  { key: "clusters", label: "集群管理", path: "/clusters" },
  { key: "audit", label: "审计日志", path: "/audit" },
  { key: "license", label: "License", path: "/license" },
  { key: "runtimes", label: "运行时清单", path: "/runtimes" },
  { key: "flags", label: "平台开关", path: "/flags" },
];

/**
 * 工作台 4 类角色首页内容
 */
export interface DashboardCard {
  title: string;
  description: string;
  icon: LucideIcon;
  link?: string;
}

export const WORKSPACE_BY_ROLE: Record<Role, DashboardCard[]> = {
  super_admin: [
    {
      title: "平台健康",
      description: "跨 namespace 资源 / 错误率 / 延迟",
      icon: HeartPulse,
      link: "/admin/monitor",
    },
    {
      title: "全部租户",
      description: "所有 workspace / 配额 / 计费",
      icon: Users,
      link: "/admin/users",
    },
    {
      title: "集群 / 部署",
      description: "K8s 集群 / Helm release / 灰度",
      icon: Hammer,
      link: "/admin/deploy",
    },
    {
      title: "审计日志",
      description: "全平台操作审计 / 数据导出",
      icon: FileText,
      link: "/admin/monitor",
    },
    {
      title: "全平台告警",
      description: "Critical / Warning 告警实时",
      icon: AlertTriangle,
    },
    {
      title: "License & 计费",
      description: "License 用量 / 续费 / 发票",
      icon: TrendingUp,
      link: "/admin/billing",
    },
    {
      title: "运行时清单",
      description: "所有 PublishedApp 运行时实例",
      icon: Cloud,
    },
    {
      title: "平台配置",
      description: "全局开关 / 黑白名单 / 灰度",
      icon: Settings2,
      link: "/admin",
    },
  ],
  admin: [
    {
      title: "系统监控",
      description: "服务运行状态 / 错误率",
      icon: HeartPulse,
      link: "/admin/monitor",
    },
    {
      title: "用户管理",
      description: "用户 / 组织 / 邀请",
      icon: Users,
      link: "/admin/users",
    },
    {
      title: "权限配置",
      description: "角色 / 菜单 / 数据权限",
      icon: ClipboardList,
      link: "/admin/roles",
    },
    {
      title: "备份恢复",
      description: "数据库快照 / 恢复演练",
      icon: Hammer,
      link: "/admin/backup",
    },
    {
      title: "插件管理",
      description: "已安装 / 启用 / 升级",
      icon: Wrench,
      link: "/admin/plugins",
    },
    {
      title: "资源使用",
      description: "CPU / 内存 / 存储",
      icon: TrendingUp,
      link: "/admin/monitor",
    },
  ],
  executive: [
    {
      title: "AI 看板",
      description: "关键指标 + 趋势图",
      icon: BarChart3,
      link: "/data/dashboard",
    },
    {
      title: "战略指标",
      description: "战略指标进度",
      icon: Target,
    },
    {
      title: "待审批",
      description: "需要决策的事项",
      icon: ClipboardList,
      link: "/process/approvals",
    },
    {
      title: "团队数字员工",
      description: "数字员工总览",
      icon: Users,
      link: "/agents",
    },
  ],
  business: [
    {
      title: "我的待办",
      description: "流程/审批/工单",
      icon: ClipboardList,
      link: "/process/approvals",
    },
    {
      title: "最近应用",
      description: "最近使用的应用",
      icon: Smartphone,
      link: "/dashboard/myapps",
    },
    {
      title: "我的数字员工",
      description: "已分配的数字员工",
      icon: Users,
      link: "/dashboard/myagents",
    },
    {
      title: "消息通知",
      description: "系统通知 + @ 我",
      icon: Bell,
      link: "/dashboard/messages",
    },
  ],
  developer: [
    {
      title: "开发中的应用",
      description: "正在开发的应用",
      icon: Wrench,
      link: "/apps",
    },
    {
      title: "开发中的智能体",
      description: "智能体开发进度",
      icon: Sparkles,
      link: "/agents",
    },
    {
      title: "FDE 工作台",
      description: "快速应用构建",
      icon: Zap,
      link: "/apps",
    },
    {
      title: "VibeCoding",
      description: "AI 生成代码",
      icon: Sparkles,
    },
  ],
  architect: [
    {
      title: "4A 架构",
      description: "业务/应用/数据/技术架构",
      icon: Building2,
      link: "/architecture",
    },
    {
      title: "本体地图",
      description: "本体 8 要素全景",
      icon: Dna,
      link: "/ontology",
    },
    {
      title: "架构决策",
      description: "设计态/运行态",
      icon: Scale,
    },
    {
      title: "架构文档",
      description: "技术选型矩阵",
      icon: FileText,
    },
  ],
  ops: [
    {
      title: "系统健康",
      description: "服务运行状态",
      icon: HeartPulse,
      link: "/admin/monitor",
    },
    {
      title: "告警中心",
      description: "待处理告警",
      icon: AlertTriangle,
    },
    {
      title: "资源使用",
      description: "CPU/内存/磁盘",
      icon: TrendingUp,
    },
    {
      title: "运维操作",
      description: "重启/扩容/备份",
      icon: Hammer,
      link: "/admin",
    },
  ],
  // leader/manager 是 executive 的 alias, 共用同一份 dashboard cards
  leader: [],
  manager: [],
};
