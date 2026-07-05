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
  DELETE FROM announcements;
  DELETE FROM todos;
  DELETE FROM test_cases;
  DELETE FROM bugs;
  DELETE FROM app_versions;
  DELETE FROM process_triggers;
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
//  Announcements (4)
// ════════════════════════════════════════════════════════
const announcementsList = [
  { id: "ann-1", title: "v1.3 新版本发布预告", content: "MetaPlatform v1.3 即将发布，新增 AI 自动生成测试用例能力，优化流程引擎性能。", priority: "high" },
  { id: "ann-2", title: "本周六 02:00-04:00 系统升级维护", content: "为提升系统稳定性，本周六凌晨将进行系统维护升级，届时服务将暂停。", priority: "high" },
  { id: "ann-3", title: "AI 助手新增自然语言生成对象能力", content: "AI 助手现已支持通过自然语言描述自动生成业务对象模型，大幅提高建模效率。", priority: "normal" },
  { id: "ann-4", title: "数据安全合规培训通知", content: "请全员于 7 月 10 日前完成数据安全合规培训课程。", priority: "normal" },
];

const insertAnnouncement = db.prepare(
  `INSERT INTO announcements (id, title, content, priority, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?)`
);
for (const a of announcementsList) {
  insertAnnouncement.run(a.id, a.title, a.content, a.priority, now, now);
}
console.log(`  Announcements: ${announcementsList.length}`);

// ════════════════════════════════════════════════════════
//  Todos (5)
// ════════════════════════════════════════════════════════
const todosList = [
  { id: "todo-1", user_id: "u-business", title: "审批：采购单 #2026-07-0231", description: "技术部提交的服务器采购申请", status: "pending", priority: "high" },
  { id: "todo-2", user_id: "u-business", title: "完成 Q3 销售预测报告", description: "基于上半年数据完成第三季度销售预测", status: "pending", priority: "medium" },
  { id: "todo-3", user_id: "u-developer", title: "审批：报销单 #BX-20260703", description: "差旅费用报销 2500 元", status: "pending", priority: "low" },
  { id: "todo-4", user_id: "u-developer", title: "更新客户资料 #CRM-8932", description: "更新 ABC 公司联系人信息", status: "pending", priority: "medium" },
  { id: "todo-5", user_id: "u-business", title: "审批：合同续签 #HT-2026-Q3", description: "与 XYZ 公司的服务合同续签审批", status: "pending", priority: "high" },
];

const insertTodo = db.prepare(
  `INSERT INTO todos (id, user_id, title, description, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);
for (const t of todosList) {
  insertTodo.run(t.id, t.user_id, t.title, t.description, t.status, t.priority, now, now);
}
console.log(`  Todos: ${todosList.length}`);

// ════════════════════════════════════════════════════════
//  Test Cases (5)
// ════════════════════════════════════════════════════════
const testCasesList = [
  { id: "tc-1", name: "客户对象建模 CRUD", module: "本体引擎", type: "functional", priority: "high", steps: "1.创建客户对象 2.添加属性 3.保存 4.查询 5.修改 6.删除", expected: "所有操作成功，数据一致", status: "completed", result: "passed", duration: 2300 },
  { id: "tc-2", name: "请假流程端到端", module: "流程引擎", type: "functional", priority: "high", steps: "1.发起请假 2.主管审批 3.HR 备案 4.完成", expected: "流程正常流转，状态正确", status: "completed", result: "passed", duration: 12400 },
  { id: "tc-3", name: "报销审批页面回归", module: "应用中心", type: "functional", priority: "high", steps: "1.登录 2.打开报销页面 3.填写表单 4.提交 5.验证", expected: "页面正常渲染，提交成功", status: "completed", result: "failed", duration: 45200 },
  { id: "tc-4", name: "知识库 RAG 检索性能", module: "知识库", type: "performance", priority: "medium", steps: "1.准备 1000 文档 2.构建索引 3.执行检索 4.统计响应时间", expected: "P95 < 2s", status: "completed", result: "passed", duration: 8100 },
  { id: "tc-5", name: "数据中心 Doris SQL 集成", module: "数据中心", type: "integration", priority: "high", steps: "1.配置连接 2.执行查询 3.验证结果", expected: "查询返回正确数据", status: "pending", result: null, duration: null },
];

const insertTestCase = db.prepare(
  `INSERT INTO test_cases (id, name, module, type, priority, steps, expected, status, result, duration, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
for (const tc of testCasesList) {
  insertTestCase.run(tc.id, tc.name, tc.module, tc.type, tc.priority, tc.steps, tc.expected, tc.status, tc.result, tc.duration, now, now);
}
console.log(`  Test Cases: ${testCasesList.length}`);

// ════════════════════════════════════════════════════════
//  Bugs (5)
// ════════════════════════════════════════════════════════
const bugsList = [
  { id: "bug-1", title: "客户详情页加载慢（>3s）", description: "客户详情页在大数据量下加载超过 3 秒", severity: "high", status: "open", assignee: "张伟", module: "客户管理", steps_to_reproduce: "1.进入客户管理 2.点击包含 1000+ 订单的客户 3.观察加载时间" },
  { id: "bug-2", title: "审批流加签功能不可用", description: "在审批过程中选择加签时页面报错", severity: "high", status: "fixed", assignee: "李娜", module: "报销审批", steps_to_reproduce: "1.发起报销审批 2.进入审批页面 3.点击加签 4.选择审批人 5.提交" },
  { id: "bug-3", title: "销售看板图表数据缺失 7/1", description: "7 月 1 日的销售数据在看板中未显示", severity: "medium", status: "verifying", assignee: "王强", module: "销售看板", steps_to_reproduce: "1.打开销售看板 2.查看 7 月 1 日数据 3.发现数据为空" },
  { id: "bug-4", title: "智能体回答错乱（中英文混排）", description: "智能体在处理中英文混合输入时回答内容错乱", severity: "medium", status: "open", assignee: "刘敏", module: "智能体助手", steps_to_reproduce: "1.打开智能体 2.输入中英文混合文本 3.观察回答" },
  { id: "bug-5", title: "导出 PDF 中文乱码", description: "导出的 PDF 文件中中文字符显示为乱码", severity: "low", status: "closed", assignee: "陈红", module: "销售看板", steps_to_reproduce: "1.打开销售看板 2.点击导出 PDF 3.打开 PDF 文件 4.查看中文内容" },
];

const insertBug = db.prepare(
  `INSERT INTO bugs (id, title, description, severity, status, assignee, module, steps_to_reproduce, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
for (const b of bugsList) {
  insertBug.run(b.id, b.title, b.description, b.severity, b.status, b.assignee, b.module, b.steps_to_reproduce, now, now);
}
console.log(`  Bugs: ${bugsList.length}`);

// ════════════════════════════════════════════════════════
//  App Versions (4)
// ════════════════════════════════════════════════════════
const versionsList = [
  { id: "ver-1", app_id: "app-crm", version: "1.3.0", description: "新增 AI 智能推荐，优化客户画像", status: "published" },
  { id: "ver-2", app_id: "app-crm", version: "1.2.0", description: "支持批量导入客户数据", status: "published" },
  { id: "ver-3", app_id: "app-crm", version: "1.1.0", description: "增加合同管理模块", status: "archived" },
  { id: "ver-4", app_id: "app-crm", version: "1.0.0", description: "初始版本，基础客户管理", status: "archived" },
];

const insertVersion = db.prepare(
  `INSERT INTO app_versions (id, app_id, version, description, status, created_at) VALUES (?, ?, ?, ?, ?, ?)`
);
for (const v of versionsList) {
  insertVersion.run(v.id, v.app_id, v.version, v.description, v.status, now);
}
console.log(`  App Versions: ${versionsList.length}`);

// ════════════════════════════════════════════════════════
//  Process Triggers (4)
// ════════════════════════════════════════════════════════
const triggersList = [
  { id: "trig-1", process_id: "proc-purchase", name: "订单创建触发", type: "event", config: '{"event": "Order.created", "target": "采购审批流程"}', status: "active", hits: 1248 },
  { id: "trig-2", process_id: "proc-contract", name: "合同到期提醒", type: "timer", config: '{"cron": "0 9 * * *", "condition": "expires_in_7d"}', status: "active", hits: 56 },
  { id: "trig-3", process_id: "proc-purchase", name: "库存预警触发", type: "event", config: '{"event": "Inventory.low_stock", "target": "补货流程"}', status: "active", hits: 320 },
  { id: "trig-4", process_id: "proc-expense", name: "审批超时升级", type: "timer", config: '{"cron": "0 */2 * * *", "timeout_hours": 24}', status: "paused", hits: 12 },
];

const insertTrigger = db.prepare(
  `INSERT INTO process_triggers (id, process_id, name, type, config, status, hits, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);
for (const tr of triggersList) {
  insertTrigger.run(tr.id, tr.process_id, tr.name, tr.type, tr.config, tr.status, tr.hits, now);
}
console.log(`  Process Triggers: ${triggersList.length}`);

// ════════════════════════════════════════════════════════
//  Summary
// ════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(50));
console.log("  🎉 Seed completed!");
console.log("═".repeat(50));
console.log(`
  Users:             ${users.length}
  Applications:      ${apps.length}
  App Pages:         ${pagesList.length}
  Ontology Objects:  ${objects.length} (${objects.reduce((s, o) => s + o.properties.length, 0)} properties)
  Relations:         ${relations.length}
  Process Defs:      ${processes.length}
  Process Instances: ${instances.length}
  Data Sources:      ${dataSources.length}
  Knowledge Docs:    ${docs.length}
  Agents:            ${agentsList.length}
  Agent Tasks:       ${tasks.length}
  Messages:          ${messagesList.length}
  Audit Logs:        ${logs.length}
  System Config:     ${configs.length}
  Announcements:     ${announcementsList.length}
  Todos:             ${todosList.length}
  Test Cases:        ${testCasesList.length}
  Bugs:              ${bugsList.length}
  App Versions:      ${versionsList.length}
  Process Triggers:  ${triggersList.length}
`);
