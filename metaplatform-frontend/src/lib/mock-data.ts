/**
 * Mock 数据中心 —— 模拟后端 API 响应
 * 后续可逐步替换为真实 API 调用
 */

export type Priority = "P0" | "P1" | "P2";
export type Status = "active" | "inactive" | "draft" | "published" | "archived";
export type Severity = "high" | "medium" | "low" | "info";

// ============ 应用中心 ============
export interface Application {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: "传统应用" | "AI 原生" | "数字员工" | "VibeCoding";
  status: Status;
  objects: number;
  pages: number;
  flows: number;
  owner: string;
  updatedAt: string;
  version: string;
}

export const mockApplications: Application[] = [
  { id: "1", name: "客户管理 CRM", icon: "📋", description: "客户档案、商机、跟进", category: "传统应用", status: "published", objects: 3, pages: 12, flows: 5, owner: "张伟", updatedAt: "2026-07-01", version: "v2.3" },
  { id: "2", name: "报销审批", icon: "📝", description: "差旅报销、审批流", category: "传统应用", status: "published", objects: 2, pages: 8, flows: 3, owner: "李娜", updatedAt: "2026-07-02", version: "v1.5" },
  { id: "3", name: "销售看板", icon: "📊", description: "销售指标、可视化", category: "传统应用", status: "published", objects: 5, pages: 15, flows: 10, owner: "王强", updatedAt: "2026-06-30", version: "v3.0" },
  { id: "4", name: "智能体助手", icon: "🤖", description: "AI 智能问答 + 流程自动化", category: "AI 原生", status: "published", objects: 1, pages: 3, flows: 8, owner: "刘敏", updatedAt: "2026-07-03", version: "v1.2" },
  { id: "5", name: "数字员工小秘", icon: "👤", description: "数据查询助手", category: "数字员工", status: "active", objects: 0, pages: 2, flows: 6, owner: "陈昊", updatedAt: "2026-07-02", version: "v0.9" },
  { id: "6", name: "VibeCoding Demo", icon: "✨", description: "AI 生成代码示例", category: "VibeCoding", status: "draft", objects: 0, pages: 1, flows: 0, owner: "赵明", updatedAt: "2026-07-03", version: "v0.1" },
];

// ============ 本体引擎 ============
export interface OntologyObject {
  id: string;
  name: string;
  label: string;
  icon: string;
  properties: number;
  actions: number;
  rules: number;
  status: Status;
}

export const mockOntologyObjects: OntologyObject[] = [
  { id: "obj-1", name: "Customer", label: "客户", icon: "👤", properties: 18, actions: 6, rules: 4, status: "active" },
  { id: "obj-2", name: "Order", label: "订单", icon: "📦", properties: 24, actions: 8, rules: 6, status: "active" },
  { id: "obj-3", name: "Product", label: "产品", icon: "🏷️", properties: 16, actions: 5, rules: 3, status: "active" },
  { id: "obj-4", name: "Employee", label: "员工", icon: "👥", properties: 22, actions: 4, rules: 2, status: "active" },
  { id: "obj-5", name: "Contract", label: "合同", icon: "📄", properties: 30, actions: 7, rules: 5, status: "active" },
  { id: "obj-6", name: "Invoice", label: "发票", icon: "🧾", properties: 14, actions: 5, rules: 3, status: "active" },
];

// ============ 流程中心 ============
export interface ProcessDefinition {
  id: string;
  key: string;
  name: string;
  category: "业务流程" | "审批流程" | "服务编排";
  version: string;
  status: Status;
  instances: number;
  avgDuration: string;
  owner: string;
  updatedAt: string;
}

export const mockProcesses: ProcessDefinition[] = [
  { id: "p-1", key: "leave_apply", name: "请假申请", category: "审批流程", version: "v3.2", status: "published", instances: 1248, avgDuration: "1.5h", owner: "张伟", updatedAt: "2026-07-01" },
  { id: "p-2", key: "expense_claim", name: "报销审批", category: "审批流程", version: "v2.1", status: "published", instances: 892, avgDuration: "3.2h", owner: "李娜", updatedAt: "2026-06-28" },
  { id: "p-3", key: "order_to_cash", name: "订单到收款", category: "业务流程", version: "v4.0", status: "published", instances: 3210, avgDuration: "5.6h", owner: "王强", updatedAt: "2026-07-02" },
  { id: "p-4", key: "data_sync_nightly", name: "夜间数据同步", category: "服务编排", version: "v1.5", status: "active", instances: 90, avgDuration: "45min", owner: "运维", updatedAt: "2026-06-30" },
  { id: "p-5", key: "contract_sign", name: "合同签订", category: "审批流程", version: "v2.0", status: "published", instances: 234, avgDuration: "2.8h", owner: "陈昊", updatedAt: "2026-07-01" },
];

export interface ProcessInstance {
  id: string;
  processKey: string;
  processName: string;
  startTime: string;
  currentNode: string;
  initiator: string;
  status: "running" | "completed" | "suspended" | "terminated";
  duration?: string;
}

export const mockProcessInstances: ProcessInstance[] = [
  { id: "i-1", processKey: "leave_apply", processName: "请假申请", startTime: "2026-07-03 09:15", currentNode: "部门经理审批", initiator: "员工A", status: "running" },
  { id: "i-2", processKey: "expense_claim", processName: "报销审批", startTime: "2026-07-03 08:42", currentNode: "财务审批", initiator: "员工B", status: "running" },
  { id: "i-3", processKey: "order_to_cash", processName: "订单到收款", startTime: "2026-07-02 14:20", currentNode: "完成", initiator: "客户X", status: "completed", duration: "4.2h" },
  { id: "i-4", processKey: "contract_sign", processName: "合同签订", startTime: "2026-07-03 10:00", currentNode: "法务审核", initiator: "员工C", status: "suspended" },
  { id: "i-5", processKey: "leave_apply", processName: "请假申请", startTime: "2026-07-02 16:30", currentNode: "完成", initiator: "员工D", status: "completed", duration: "1.1h" },
];

// ============ 数据中心 ============
export interface DataSource {
  id: string;
  name: string;
  type: "MySQL" | "PostgreSQL" | "Oracle" | "MongoDB" | "ClickHouse" | "Doris" | "Kafka" | "API" | "CSV";
  host: string;
  status: "online" | "offline" | "syncing" | "error";
  records: number;
  lastSync: string;
}

export const mockDataSources: DataSource[] = [
  { id: "ds-1", name: "订单库 MySQL", type: "MySQL", host: "mysql-prod-01", status: "online", records: 12450000, lastSync: "5min ago" },
  { id: "ds-2", name: "客户库 PostgreSQL", type: "PostgreSQL", host: "pg-crm-01", status: "online", records: 320000, lastSync: "10min ago" },
  { id: "ds-3", name: "日志 MongoDB", type: "MongoDB", host: "mongo-log-01", status: "syncing", records: 8900000, lastSync: "syncing" },
  { id: "ds-4", name: "分析 Doris", type: "Doris", host: "doris-01", status: "online", records: 0, lastSync: "实时" },
  { id: "ds-5", name: "ERP Oracle", type: "Oracle", host: "oracle-erp", status: "online", records: 5400000, lastSync: "1h ago" },
  { id: "ds-6", name: "Kafka 事件流", type: "Kafka", host: "kafka-01", status: "online", records: 0, lastSync: "实时" },
];

export interface Metric {
  id: string;
  name: string;
  value: number;
  unit: string;
  trend: number;
  category: string;
}

export const mockMetrics: Metric[] = [
  { id: "m-1", name: "今日销售额", value: 1234567, unit: "¥", trend: 12.5, category: "销售" },
  { id: "m-2", name: "新增客户", value: 89, unit: "", trend: -3.2, category: "客户" },
  { id: "m-3", name: "订单数", value: 1248, unit: "", trend: 8.7, category: "订单" },
  { id: "m-4", name: "活跃用户", value: 5678, unit: "", trend: 15.3, category: "用户" },
];

// ============ 知识库 ============
export interface Document {
  id: string;
  title: string;
  category: "制度" | "技术" | "产品" | "项目" | "其他";
  author: string;
  updatedAt: string;
  views: number;
  size: string;
}

export const mockDocuments: Document[] = [
  { id: "d-1", title: "MetaPlatform 产品白皮书", category: "产品", author: "产品部", updatedAt: "2026-07-01", views: 1245, size: "2.4MB" },
  { id: "d-2", title: "本体引擎技术规范 v2.0", category: "技术", author: "架构组", updatedAt: "2026-06-28", views: 678, size: "1.8MB" },
  { id: "d-3", title: "2026 年度数字化战略", category: "制度", author: "高管办", updatedAt: "2026-06-15", views: 2341, size: "5.1MB" },
  { id: "d-4", title: "AI 低代码落地方法论", category: "产品", author: "咨询部", updatedAt: "2026-07-02", views: 945, size: "3.2MB" },
  { id: "d-5", title: "客户管理项目周报", category: "项目", author: "项目经理", updatedAt: "2026-07-03", views: 87, size: "0.5MB" },
];

// ============ 质量中心 ============
export interface TestCase {
  id: string;
  name: string;
  module: string;
  type: "单元" | "集成" | "UI" | "流程" | "性能";
  status: "passed" | "failed" | "running" | "skipped" | "draft";
  priority: Priority;
  lastRun: string;
  duration: string;
}

export const mockTestCases: TestCase[] = [
  { id: "t-1", name: "客户对象建模 CRUD", module: "本体引擎", type: "单元", status: "passed", priority: "P0", lastRun: "10min ago", duration: "2.3s" },
  { id: "t-2", name: "请假流程端到端", module: "流程引擎", type: "流程", status: "passed", priority: "P0", lastRun: "1h ago", duration: "12.4s" },
  { id: "t-3", name: "报销审批页面回归", module: "应用中心", type: "UI", status: "failed", priority: "P0", lastRun: "30min ago", duration: "45.2s" },
  { id: "t-4", name: "知识库 RAG 检索性能", module: "知识库", type: "性能", status: "passed", priority: "P1", lastRun: "2h ago", duration: "8.1s" },
  { id: "t-5", name: "数据中心 Doris SQL 集成", module: "数据中心", type: "集成", status: "running", priority: "P0", lastRun: "running", duration: "-" },
];

// ============ 数字员工 ============
export interface DigitalEmployee {
  id: string;
  name: string;
  role: string;
  avatar: string;
  model: string;
  skills: number;
  conversations: number;
  status: "online" | "offline" | "busy";
  owner: string;
}

export const mockAgents: DigitalEmployee[] = [
  { id: "a-1", name: "数据助手小秘", role: "数据查询", avatar: "🤖", model: "DeepSeek-V3", skills: 8, conversations: 1248, status: "online", owner: "数据中心" },
  { id: "a-2", name: "流程审批小审", role: "流程自动化", avatar: "🧠", model: "Qwen-Max", skills: 12, conversations: 892, status: "busy", owner: "流程中心" },
  { id: "a-3", name: "会议记录小记", role: "会议助手", avatar: "📝", model: "GPT-4o", skills: 6, conversations: 234, status: "online", owner: "数字员工" },
  { id: "a-4", name: "代码助手小码", role: "开发辅助", avatar: "💻", model: "Claude-3.5", skills: 15, conversations: 567, status: "offline", owner: "开发团队" },
  { id: "a-5", name: "客户助手小客", role: "客户服务", avatar: "💬", model: "Qwen-Plus", skills: 10, conversations: 3421, status: "online", owner: "客服部" },
];

// ============ 云市场 ============
export interface Template {
  id: string;
  name: string;
  type: "本体模板" | "Skill" | "Agent" | "工作流" | "知识包" | "API";
  industry: string;
  downloads: number;
  rating: number;
  price: "免费" | "付费" | "订阅";
  author: string;
}

export const mockTemplates: Template[] = [
  { id: "t-1", name: "CRM 通用模板", type: "本体模板", industry: "通用", downloads: 12480, rating: 4.8, price: "免费", author: "百特搭官方" },
  { id: "t-2", name: "HR 全套", type: "本体模板", industry: "通用", downloads: 8921, rating: 4.7, price: "免费", author: "百特搭官方" },
  { id: "t-3", name: "财务记账", type: "工作流", industry: "金融", downloads: 5430, rating: 4.6, price: "免费", author: "生态合作" },
  { id: "t-4", name: "销售智能体", type: "Agent", industry: "通用", downloads: 3210, rating: 4.9, price: "订阅", author: "ISV" },
  { id: "t-5", name: "OCR 文字识别", type: "Skill", industry: "通用", downloads: 9876, rating: 4.5, price: "免费", author: "百特搭官方" },
];

// ============ 后台管理 ============
export interface User {
  id: string;
  name: string;
  email: string;
  role: "executive" | "business" | "developer" | "architect" | "ops";
  department: string;
  status: "active" | "inactive";
  lastLogin: string;
}

export const mockUsers: User[] = [
  { id: "u-1", name: "张伟", email: "zhangwei@meta.com", role: "developer", department: "技术部", status: "active", lastLogin: "2h ago" },
  { id: "u-2", name: "李娜", email: "lina@meta.com", role: "business", department: "销售部", status: "active", lastLogin: "10min ago" },
  { id: "u-3", name: "王强", email: "wangqiang@meta.com", role: "architect", department: "技术部", status: "active", lastLogin: "1d ago" },
  { id: "u-4", name: "陈昊", email: "chenhao@meta.com", role: "ops", department: "运维部", status: "active", lastLogin: "5h ago" },
  { id: "u-5", name: "刘敏", email: "liumin@meta.com", role: "executive", department: "高管办", status: "active", lastLogin: "30min ago" },
];

// ============ 架构中心 ============
export interface ArchitectureItem {
  id: string;
  level: "L1" | "L2" | "L3" | "L4" | "L5" | "L6";
  name: string;
  type: "业务" | "应用" | "数据" | "技术";
  status: "active" | "deprecated" | "planning";
  children?: ArchitectureItem[];
}

export const mockArchitectureTree: ArchitectureItem[] = [
  { id: "l1-1", level: "L1", name: "客户价值链", type: "业务", status: "active" },
  { id: "l1-2", level: "L1", name: "运营价值链", type: "业务", status: "active" },
  { id: "l1-3", level: "L1", name: "管理价值链", type: "业务", status: "active" },
  { id: "l1-4", level: "L1", name: "IT 支撑价值链", type: "业务", status: "active" },
  { id: "l1-5", level: "L1", name: "战略价值链", type: "业务", status: "planning" },
];