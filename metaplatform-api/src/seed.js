/**
 * MetaPlatform API — Seed script
 * Populates the database with sample data for development.
 */
import db from "./db.js";
import { v4 as uuid } from "uuid";

// Helper to generate a deterministic-looking UUID-like id from a prefix + number
const id = (prefix, n) => {
  // Use uuid() for unique ids, but keep a readable mapping
  return `${prefix}-${uuid()}`;
};

const now = new Date().toISOString();

// ════════════════════════════════════════════════════════
//  Clear existing data
// ════════════════════════════════════════════════════════
console.log("\n🌱 Seeding MetaPlatform database...\n");

db.exec(`
  DELETE FROM messages;
  DELETE FROM agent_tasks;
  DELETE FROM agents;
  DELETE FROM knowledge_documents;
  DELETE FROM audit_logs;
  DELETE FROM process_instances;
  DELETE FROM process_definitions;
  DELETE FROM ontology_relations;
  DELETE FROM ontology_properties;
  DELETE FROM ontology_objects;
  DELETE FROM data_sources;
  DELETE FROM app_pages;
  DELETE FROM app_configs;
  DELETE FROM applications;
  DELETE FROM users;
  DELETE FROM system_config;
`);

// ════════════════════════════════════════════════════════
//  Users (6)
// ════════════════════════════════════════════════════════
const users = [
  { id: "u-executive", name: "王总", email: "executive@metaplatform.com", role: "executive", department: "高管层" },
  { id: "u-business", name: "张经理", email: "business@metaplatform.com", role: "business", department: "销售部" },
  { id: "u-developer", name: "李开发", email: "developer@metaplatform.com", role: "developer", department: "技术部" },
  { id: "u-architect", name: "赵架构", email: "architect@metaplatform.com", role: "architect", department: "技术部" },
  { id: "u-ops", name: "钱运维", email: "ops@metaplatform.com", role: "ops", department: "技术部" },
  { id: "u-admin", name: "管理员", email: "admin@metaplatform.com", role: "admin", department: "技术部" },
];

const insertUser = db.prepare(
  `INSERT INTO users (id, name, email, role, department, status, avatar, last_login, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`
);
for (const u of users) {
  insertUser.run(u.id, u.name, u.email, u.role, u.department, null, now, now, now);
}
console.log(`  ✅ Users: ${users.length}`);

// ════════════════════════════════════════════════════════
//  Applications (6)
// ════════════════════════════════════════════════════════
const apps = [
  { id: "app-crm", name: "CRM", description: "客户关系管理系统，管理客户生命周期", category: "traditional", icon: "Users", status: "published", objects_count: 3, pages_count: 12, flows_count: 2 },
  { id: "app-expense", name: "报销审批", description: "企业费用报销与审批流程管理", category: "traditional", icon: "Receipt", status: "published", objects_count: 2, pages_count: 5, flows_count: 1 },
  { id: "app-dashboard", name: "销售看板", description: "销售数据可视化看板", category: "traditional", icon: "BarChart3", status: "published", objects_count: 1, pages_count: 3, flows_count: 0 },
  { id: "app-agent", name: "智能体助手", description: "AI 智能体管理与编排平台", category: "ai", icon: "Bot", status: "published", objects_count: 0, pages_count: 4, flows_count: 0 },
  { id: "app-secretary", name: "数字员工小秘", description: "AI 数字员工，自动化日常办公任务", category: "ai", icon: "Sparkles", status: "draft", objects_count: 0, pages_count: 2, flows_count: 0 },
  { id: "app-vibe", name: "VibeCoding Demo", description: "演示 Vibe Coding 能力的示例应用", category: "ai", icon: "Code", status: "draft", objects_count: 1, pages_count: 1, flows_count: 0 },
];

const insertApp = db.prepare(
  `INSERT INTO applications (id, name, description, category, status, icon, version, owner_id, objects_count, pages_count, flows_count, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, 'v0.1', ?, ?, ?, ?, ?, ?)`
);
for (const a of apps) {
  insertApp.run(a.id, a.name, a.description, a.category, a.status, a.icon, "u-admin", a.objects_count, a.pages_count, a.flows_count, now, now);
}
console.log(`  ✅ Applications: ${apps.length}`);

// ════════════════════════════════════════════════════════
//  App Pages (17)
// ════════════════════════════════════════════════════════
const pagesList = [
  // CRM (app-crm) — 4 pages
  { id: "page-crm-1", app_id: "app-crm", name: "客户列表", type: "list", icon: "Users", status: "published", sort_order: 0 },
  { id: "page-crm-2", app_id: "app-crm", name: "商机看板", type: "dashboard", icon: "Kanban", status: "published", sort_order: 1 },
  { id: "page-crm-3", app_id: "app-crm", name: "合同管理", type: "list", icon: "FileText", status: "published", sort_order: 2 },
  { id: "page-crm-4", app_id: "app-crm", name: "数据报表", type: "chart", icon: "BarChart3", status: "published", sort_order: 3 },
  // 报销审批 (app-expense) — 3 pages
  { id: "page-exp-1", app_id: "app-expense", name: "报销单", type: "list", icon: "Receipt", status: "published", sort_order: 0 },
  { id: "page-exp-2", app_id: "app-expense", name: "审批记录", type: "list", icon: "CheckSquare", status: "published", sort_order: 1 },
  { id: "page-exp-3", app_id: "app-expense", name: "统计报表", type: "chart", icon: "PieChart", status: "published", sort_order: 2 },
  // 销售看板 (app-dashboard) — 3 pages
  { id: "page-dash-1", app_id: "app-dashboard", name: "销售概览", type: "dashboard", icon: "LayoutDashboard", status: "published", sort_order: 0 },
  { id: "page-dash-2", app_id: "app-dashboard", name: "区域分析", type: "chart", icon: "Map", status: "published", sort_order: 1 },
  { id: "page-dash-3", app_id: "app-dashboard", name: "客户画像", type: "dashboard", icon: "UserCircle", status: "published", sort_order: 2 },
  // 智能体助手 (app-agent) — 2 pages
  { id: "page-agent-1", app_id: "app-agent", name: "对话界面", type: "text", icon: "MessageSquare", status: "published", sort_order: 0 },
  { id: "page-agent-2", app_id: "app-agent", name: "知识管理", type: "list", icon: "BookOpen", status: "published", sort_order: 1 },
  // 数字员工小秘 (app-secretary) — 2 pages
  { id: "page-sec-1", app_id: "app-secretary", name: "工作台", type: "dashboard", icon: "Monitor", status: "draft", sort_order: 0 },
  { id: "page-sec-2", app_id: "app-secretary", name: "任务管理", type: "list", icon: "ListTodo", status: "draft", sort_order: 1 },
  // VibeCoding Demo (app-vibe) — 1 page
  { id: "page-vibe-1", app_id: "app-vibe", name: "代码编辑器", type: "text", icon: "Code", status: "draft", sort_order: 0 },
];

const insertPage = db.prepare(
  `INSERT INTO app_pages (id, app_id, name, type, icon, status, config, sort_order, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
for (const p of pagesList) {
  insertPage.run(p.id, p.app_id, p.name, p.type, p.icon, p.status, null, p.sort_order, now, now);
}
console.log(`  ✅ App Pages: ${pagesList.length}`);

// ════════════════════════════════════════════════════════
//  Ontology Objects (6) with Properties
// ════════════════════════════════════════════════════════
const objects = [
  { id: "obj-customer", app_id: "app-crm", name: "Customer", label: "客户", icon: "User", properties: [
    { name: "name", label: "客户名称", type: "text", required: 1 },
    { name: "phone", label: "联系电话", type: "text", required: 0 },
    { name: "email", label: "邮箱", type: "text", required: 0 },
    { name: "company", label: "所属公司", type: "text", required: 0 },
    { name: "level", label: "客户等级", type: "select", required: 0 },
    { name: "address", label: "地址", type: "text", required: 0 },
  ]},
  { id: "obj-order", app_id: "app-crm", name: "Order", label: "订单", icon: "ShoppingCart", properties: [
    { name: "order_no", label: "订单编号", type: "text", required: 1 },
    { name: "amount", label: "金额", type: "number", required: 1 },
    { name: "status", label: "状态", type: "select", required: 1 },
    { name: "date", label: "下单日期", type: "date", required: 1 },
  ]},
  { id: "obj-product", app_id: "app-crm", name: "Product", label: "产品", icon: "Package", properties: [
    { name: "name", label: "产品名称", type: "text", required: 1 },
    { name: "price", label: "价格", type: "number", required: 1 },
    { name: "category", label: "分类", type: "text", required: 0 },
    { name: "stock", label: "库存", type: "number", required: 0 },
  ]},
  { id: "obj-employee", app_id: null, name: "Employee", label: "员工", icon: "UserCheck", properties: [
    { name: "name", label: "姓名", type: "text", required: 1 },
    { name: "department", label: "部门", type: "text", required: 1 },
    { name: "title", label: "职位", type: "text", required: 0 },
    { name: "hire_date", label: "入职日期", type: "date", required: 0 },
  ]},
  { id: "obj-contract", app_id: "app-crm", name: "Contract", label: "合同", icon: "FileText", properties: [
    { name: "title", label: "合同标题", type: "text", required: 1 },
    { name: "party_a", label: "甲方", type: "text", required: 1 },
    { name: "party_b", label: "乙方", type: "text", required: 1 },
    { name: "amount", label: "合同金额", type: "number", required: 0 },
    { name: "start_date", label: "开始日期", type: "date", required: 0 },
    { name: "end_date", label: "结束日期", type: "date", required: 0 },
  ]},
  { id: "obj-invoice", app_id: "app-expense", name: "Invoice", label: "发票", icon: "FileSpreadsheet", properties: [
    { name: "invoice_no", label: "发票号", type: "text", required: 1 },
    { name: "amount", label: "金额", type: "number", required: 1 },
    { name: "date", label: "开票日期", type: "date", required: 1 },
    { name: "type", label: "类型", type: "select", required: 0 },
  ]},
];

const insertObj = db.prepare(
  `INSERT INTO ontology_objects (id, app_id, name, label, description, icon, status, properties_count, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`
);
const insertProp = db.prepare(
  `INSERT INTO ontology_properties (id, object_id, name, label, type, required, sort_order, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);

for (const obj of objects) {
  insertObj.run(obj.id, obj.app_id, obj.name, obj.label, `${obj.label}数据对象`, obj.icon, obj.properties.length, now, now);
  for (let i = 0; i < obj.properties.length; i++) {
    const p = obj.properties[i];
    insertProp.run(uuid(), obj.id, p.name, p.label, p.type, p.required, i, now);
  }
}
console.log(`  ✅ Ontology Objects: ${objects.length} (${objects.reduce((s, o) => s + o.properties.length, 0)} properties)`);

// Ontology Relations
const relations = [
  { source: "obj-customer", target: "obj-order", type: "1:N", label: "客户-订单" },
  { source: "obj-order", target: "obj-product", type: "N:N", label: "订单-产品" },
  { source: "obj-customer", target: "obj-contract", type: "1:N", label: "客户-合同" },
];
const insertRel = db.prepare(
  `INSERT INTO ontology_relations (id, source_object_id, target_object_id, type, label, description, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);
for (const r of relations) {
  insertRel.run(uuid(), r.source, r.target, r.type, r.label, `${r.label}关系`, now);
}
console.log(`  ✅ Ontology Relations: ${relations.length}`);

// ════════════════════════════════════════════════════════
//  Process Definitions (3)
// ════════════════════════════════════════════════════════
const processes = [
  { id: "proc-purchase", app_id: "app-crm", name: "采购审批", type: "business", status: "active", description: "企业采购审批流程，包含需求提交、主管审批、采购执行等环节" },
  { id: "proc-expense", app_id: "app-expense", name: "报销审批", type: "business", status: "active", description: "员工费用报销审批，支持多级审批和金额分级" },
  { id: "proc-contract", app_id: "app-crm", name: "合同审批", type: "business", status: "active", description: "合同签订前的法务与管理层审批流程" },
];

const insertProc = db.prepare(
  `INSERT INTO process_definitions (id, app_id, name, type, status, version, description, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`
);
for (const p of processes) {
  insertProc.run(p.id, p.app_id, p.name, p.type, p.status, p.description, now, now);
}

// Process Instances
const instances = [
  { id: "inst-1", definition_id: "proc-purchase", status: "approved", initiator_id: "u-business", variables: '{"amount": 50000, "item": "服务器设备"}' },
  { id: "inst-2", definition_id: "proc-expense", status: "running", initiator_id: "u-developer", variables: '{"amount": 2500, "type": "差旅费"}' },
  { id: "inst-3", definition_id: "proc-contract", status: "running", initiator_id: "u-business", variables: '{"contract_value": 200000, "client": "ABC公司"}' },
];

const insertInst = db.prepare(
  `INSERT INTO process_instances (id, definition_id, status, initiator_id, variables, started_at, ended_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);
for (const inst of instances) {
  insertInst.run(inst.id, inst.definition_id, inst.status, inst.initiator_id, inst.variables, now, inst.status === "approved" ? now : null);
}
console.log(`  ✅ Process Definitions: ${processes.length}, Instances: ${instances.length}`);

// ════════════════════════════════════════════════════════
//  Data Sources (4)
// ════════════════════════════════════════════════════════
const dataSources = [
  { id: "ds-mysql", name: "生产 MySQL", type: "mysql", host: "10.0.1.100", port: 3306, database_name: "production", username: "reader", status: "online", description: "主业务 MySQL 数据库" },
  { id: "ds-pg", name: "分析 PostgreSQL", type: "postgresql", host: "10.0.1.101", port: 5432, database_name: "analytics", username: "analyst", status: "online", description: "数据分析 PostgreSQL" },
  { id: "ds-api", name: "第三方 API", type: "api", host: "https://api.partner.com", port: null, database_name: null, username: null, status: "offline", description: "合作伙伴 REST API" },
  { id: "ds-csv", name: "CSV 导入源", type: "csv", host: null, port: null, database_name: null, username: null, status: "online", description: "CSV 文件数据导入" },
];

const insertDS = db.prepare(
  `INSERT INTO data_sources (id, name, type, host, port, database_name, username, password_encrypted, status, description, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
for (const ds of dataSources) {
  insertDS.run(ds.id, ds.name, ds.type, ds.host, ds.port, ds.database_name, ds.username, null, ds.status, ds.description, now, now);
}
console.log(`  ✅ Data Sources: ${dataSources.length}`);

// ════════════════════════════════════════════════════════
//  Knowledge Documents (4)
// ════════════════════════════════════════════════════════
const docs = [
  { id: "doc-1", title: "MetaPlatform 产品介绍", type: "text", category: "产品文档", content: "MetaPlatform 是新一代低代码+AI 融合平台，为企业提供从业务建模、流程自动化到 AI 智能体的全栈能力。核心特性包括：可视化对象建模、拖拽式页面构建、BPMN 流程引擎、RAG 知识管理和多智能体编排。", tags: '["产品","介绍","平台"]' },
  { id: "doc-2", title: "开发者快速入门指南", type: "text", category: "开发文档", content: "本指南帮助开发者快速上手 MetaPlatform API 开发。1. 安装 Node.js 18+；2. 克隆仓库并安装依赖；3. 运行 seed 脚本初始化数据；4. 启动 API 服务；5. 使用 Postman 或前端调用接口。", tags: '["开发","入门","API"]' },
  { id: "doc-3", title: "业务对象建模最佳实践", type: "text", category: "最佳实践", content: "业务对象建模是 MetaPlatform 的核心能力。建议：1. 先梳理业务领域模型；2. 识别核心实体与值对象；3. 定义属性时注意数据类型选择；4. 合理设计对象间关系（1:1, 1:N, N:N）；5. 使用规则引擎约束业务逻辑。", tags: '["建模","最佳实践","对象"]' },
  { id: "doc-4", title: "常见问题 FAQ", type: "text", category: "帮助中心", content: "Q: 如何创建新的业务对象？A: 进入对象管理页面，点击新建对象。Q: 流程引擎支持哪些节点？A: 支持开始、审批、条件、并行、通知、结束等节点。Q: AI 智能体如何接入？A: 在智能体管理页面配置模型和技能。", tags: '["FAQ","帮助","常见问题"]' },
];

const insertDoc = db.prepare(
  `INSERT INTO knowledge_documents (id, title, type, category, content, file_path, file_size, status, tags, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, null, ?, 'active', ?, ?, ?)`
);
for (const d of docs) {
  insertDoc.run(d.id, d.title, d.type, d.category, d.content, d.content.length, d.tags, now, now);
}
console.log(`  ✅ Knowledge Documents: ${docs.length}`);

// ════════════════════════════════════════════════════════
//  Agents (6)
// ════════════════════════════════════════════════════════
const agentsList = [
  { id: "agent-assistant", name: "通用助手", description: "通用 AI 对话助手，支持问答、写作、翻译等", type: "builtin", status: "online", model: "gpt-4o", skills: '["chat","writing","translation"]', config: '{"temperature": 0.7, "max_tokens": 4096}' },
  { id: "agent-analyst", name: "数据分析师", description: "数据分析与报表生成智能体", type: "builtin", status: "online", model: "gpt-4o", skills: '["sql","chart","report"]', config: '{"temperature": 0.3}' },
  { id: "agent-coder", name: "代码工程师", description: "代码生成、审查与重构智能体", type: "custom", status: "online", model: "gpt-4o", skills: '["code-gen","code-review","refactor"]', config: '{"temperature": 0.2, "language": ["javascript","python","go"]}' },
  { id: "agent-secretary", name: "数字小秘", description: "日程管理、邮件处理、会议纪要整理", type: "custom", status: "offline", model: "gpt-4o-mini", skills: '["calendar","email","minutes"]', config: '{"temperature": 0.5}' },
  { id: "agent-support", name: "客户支持", description: "自动回复客户咨询，处理工单", type: "builtin", status: "offline", model: "gpt-4o-mini", skills: '["faq","ticket","escalation"]', config: '{"temperature": 0.4}' },
  { id: "agent-monitor", name: "系统监控员", description: "监控系统健康状态，异常告警", type: "custom", status: "online", model: "gpt-4o-mini", skills: '["monitoring","alert","log-analysis"]', config: '{"temperature": 0.1}' },
];

const insertAgent = db.prepare(
  `INSERT INTO agents (id, name, description, type, status, model, skills, config, owner_id, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
for (const a of agentsList) {
  insertAgent.run(a.id, a.name, a.description, a.type, a.status, a.model, a.skills, a.config, "u-admin", now, now);
}

// Agent Tasks
const tasks = [
  { id: "task-1", agent_id: "agent-analyst", title: "生成本月销售报表", status: "completed", input: '{"period": "2026-06"}', output: '{"report_url": "/reports/june-2026.pdf"}' },
  { id: "task-2", agent_id: "agent-coder", title: "重构用户认证模块", status: "running", input: '{"module": "auth", "language": "javascript"}', output: null },
  { id: "task-3", agent_id: "agent-assistant", title: "翻译产品文档", status: "pending", input: '{"source": "zh", "target": "en", "doc_id": "doc-1"}', output: null },
];

const insertTask = db.prepare(
  `INSERT INTO agent_tasks (id, agent_id, title, status, input, output, started_at, ended_at, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
for (const t of tasks) {
  insertTask.run(t.id, t.agent_id, t.title, t.status, t.input, t.output, now, t.status === "completed" ? now : null, now);
}
console.log(`  ✅ Agents: ${agentsList.length}, Tasks: ${tasks.length}`);

// ════════════════════════════════════════════════════════
//  Messages (5)
// ════════════════════════════════════════════════════════
const messagesList = [
  { id: "msg-1", user_id: "u-admin", type: "notification", title: "系统更新完成", content: "MetaPlatform v0.2 版本已成功部署，新增 AI 智能体模块。", read: 0, link: "/dashboard" },
  { id: "msg-2", user_id: "u-admin", type: "alert", title: "CPU 使用率告警", content: "服务器 node-01 CPU 使用率超过 85%，请及时处理。", read: 0, link: "/monitoring" },
  { id: "msg-3", user_id: "u-business", type: "approval", title: "新的报销审批待处理", content: "员工李开发提交了差旅费报销申请，金额 2,500 元。", read: 0, link: "/process/inst-2" },
  { id: "msg-4", user_id: "u-developer", type: "notification", title: "代码审查通过", content: "您的 PR #142 已通过审查并合并到主分支。", read: 1, link: null },
  { id: "msg-5", user_id: "u-executive", type: "report", title: "月度业务报告已生成", content: "2026年6月业务报告已自动生成，请查阅。", read: 0, link: "/reports" },
];

const insertMsg = db.prepare(
  `INSERT INTO messages (id, user_id, type, title, content, read, link, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);
for (const m of messagesList) {
  insertMsg.run(m.id, m.user_id, m.type, m.title, m.content, m.read, m.link, now);
}
console.log(`  ✅ Messages: ${messagesList.length}`);

// ════════════════════════════════════════════════════════
//  Audit Logs (5)
// ════════════════════════════════════════════════════════
const logs = [
  { id: "log-1", user_id: "u-admin", user_name: "管理员", action: "用户登录", module: "auth", target: "admin@metaplatform.com", detail: "管理员登录系统", ip: "192.168.1.100", result: "success" },
  { id: "log-2", user_id: "u-developer", user_name: "李开发", action: "创建应用", module: "apps", target: "VibeCoding Demo", detail: "创建新应用 VibeCoding Demo", ip: "192.168.1.102", result: "success" },
  { id: "log-3", user_id: "u-business", user_name: "张经理", action: "提交流程", module: "processes", target: "报销审批", detail: "提交报销审批流程，金额 2500 元", ip: "192.168.1.101", result: "success" },
  { id: "log-4", user_id: "u-ops", user_name: "钱运维", action: "更新配置", module: "admin", target: "system.config", detail: "更新系统配置：max_upload_size = 50MB", ip: "192.168.1.103", result: "success" },
  { id: "log-5", user_id: "u-admin", user_name: "管理员", action: "创建数据源", module: "data", target: "生产 MySQL", detail: "配置生产 MySQL 数据源连接", ip: "192.168.1.100", result: "success" },
];

const insertLog = db.prepare(
  `INSERT INTO audit_logs (id, user_id, user_name, action, module, target, detail, ip, result, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
for (const l of logs) {
  insertLog.run(l.id, l.user_id, l.user_name, l.action, l.module, l.target, l.detail, l.ip, l.result, now);
}
console.log(`  ✅ Audit Logs: ${logs.length}`);

// ════════════════════════════════════════════════════════
//  System Config
// ════════════════════════════════════════════════════════
const configs = [
  { key: "app.name", value: "MetaPlatform", description: "平台名称" },
  { key: "app.version", value: "0.2.0", description: "当前版本" },
  { key: "app.logo", value: "/logo.svg", description: "平台 Logo 路径" },
  { key: "auth.jwt_expires", value: "7d", description: "JWT 过期时间" },
  { key: "upload.max_size", value: "52428800", description: "最大上传文件大小 (bytes)" },
  { key: "ai.default_model", value: "gpt-4o", description: "默认 AI 模型" },
];

const insertConfig = db.prepare(
  `INSERT OR REPLACE INTO system_config (key, value, description, updated_at) VALUES (?, ?, ?, ?)`
);
for (const c of configs) {
  insertConfig.run(c.key, c.value, c.description, now);
}
console.log(`  ✅ System Config: ${configs.length}`);

// ════════════════════════════════════════════════════════
//  Summary
// ════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(50));
console.log("  🎉 Seed completed!");
console.log("═".repeat(50));
console.log(`
  Users:            ${users.length}
  Applications:     ${apps.length}
  App Pages:        ${pagesList.length}
  Ontology Objects: ${objects.length} (${objects.reduce((s, o) => s + o.properties.length, 0)} properties)
  Relations:        ${relations.length}
  Process Defs:     ${processes.length}
  Process Instances: ${instances.length}
  Data Sources:     ${dataSources.length}
  Knowledge Docs:   ${docs.length}
  Agents:           ${agentsList.length}
  Agent Tasks:      ${tasks.length}
  Messages:         ${messagesList.length}
  Audit Logs:       ${logs.length}
  System Config:    ${configs.length}
`);
