/**
 * SQLite database initialization
 */
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "metaplatform.db");

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ─── Schema ───────────────────────────────────────────────
db.exec(`
  -- Users
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'business',
    department TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    avatar TEXT,
    last_login TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Applications
  CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'traditional',
    status TEXT NOT NULL DEFAULT 'draft',
    icon TEXT,
    version TEXT NOT NULL DEFAULT 'v0.1',
    owner_id TEXT,
    objects_count INTEGER DEFAULT 0,
    pages_count INTEGER DEFAULT 0,
    flows_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Ontology Objects
  CREATE TABLE IF NOT EXISTS ontology_objects (
    id TEXT PRIMARY KEY,
    app_id TEXT,
    name TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    properties_count INTEGER DEFAULT 0,
    actions_count INTEGER DEFAULT 0,
    rules_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Ontology Properties
  CREATE TABLE IF NOT EXISTS ontology_properties (
    id TEXT PRIMARY KEY,
    object_id TEXT NOT NULL,
    name TEXT NOT NULL,
    label TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text',
    required INTEGER DEFAULT 0,
    unique_field INTEGER DEFAULT 0,
    default_value TEXT,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (object_id) REFERENCES ontology_objects(id)
  );

  -- Ontology Relations
  CREATE TABLE IF NOT EXISTS ontology_relations (
    id TEXT PRIMARY KEY,
    source_object_id TEXT NOT NULL,
    target_object_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT '1:N',
    label TEXT,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (source_object_id) REFERENCES ontology_objects(id),
    FOREIGN KEY (target_object_id) REFERENCES ontology_objects(id)
  );

  -- Process Definitions
  CREATE TABLE IF NOT EXISTS process_definitions (
    id TEXT PRIMARY KEY,
    app_id TEXT,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'business',
    status TEXT NOT NULL DEFAULT 'draft',
    version INTEGER DEFAULT 1,
    bpmn_xml TEXT,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Process Instances
  CREATE TABLE IF NOT EXISTS process_instances (
    id TEXT PRIMARY KEY,
    definition_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    initiator_id TEXT,
    variables TEXT,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT,
    FOREIGN KEY (definition_id) REFERENCES process_definitions(id)
  );

  -- Data Sources
  CREATE TABLE IF NOT EXISTS data_sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    host TEXT,
    port INTEGER,
    database_name TEXT,
    username TEXT,
    password_encrypted TEXT,
    status TEXT NOT NULL DEFAULT 'offline',
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Knowledge Documents
  CREATE TABLE IF NOT EXISTS knowledge_documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text',
    category TEXT,
    content TEXT,
    file_path TEXT,
    file_size INTEGER,
    status TEXT NOT NULL DEFAULT 'active',
    tags TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Digital Employees (Agents)
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'builtin',
    status TEXT NOT NULL DEFAULT 'offline',
    model TEXT,
    skills TEXT,
    config TEXT,
    owner_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Agent Tasks
  CREATE TABLE IF NOT EXISTS agent_tasks (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    input TEXT,
    output TEXT,
    started_at TEXT,
    ended_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (agent_id) REFERENCES agents(id)
  );

  -- Messages / Notifications
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'notification',
    title TEXT NOT NULL,
    content TEXT,
    read INTEGER DEFAULT 0,
    link TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Audit Logs
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    user_name TEXT,
    action TEXT NOT NULL,
    module TEXT,
    target TEXT,
    detail TEXT,
    ip TEXT,
    result TEXT DEFAULT 'success',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- System Config
  CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- App Pages
  CREATE TABLE IF NOT EXISTS app_pages (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'list',
    icon TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    config TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- App Configs
  CREATE TABLE IF NOT EXISTS app_configs (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    description TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- App Publications (publish snapshots)
  CREATE TABLE IF NOT EXISTS app_publications (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    published_url TEXT,
    published_version TEXT,
    config_snapshot TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (app_id) REFERENCES applications(id)
  );

  -- LLM Usage tracking
  CREATE TABLE IF NOT EXISTS llm_usage (
    id TEXT PRIMARY KEY,
    model TEXT NOT NULL,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    user_id TEXT,
    request_type TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Announcements
  CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    priority TEXT DEFAULT 'normal',
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Todos
  CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    priority TEXT DEFAULT 'medium',
    due_date TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Quality Test Cases
  CREATE TABLE IF NOT EXISTS test_cases (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    module TEXT,
    type TEXT DEFAULT 'functional',
    priority TEXT DEFAULT 'medium',
    steps TEXT,
    expected TEXT,
    status TEXT DEFAULT 'pending',
    result TEXT,
    duration INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Quality Bugs
  CREATE TABLE IF NOT EXISTS bugs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'open',
    assignee TEXT,
    module TEXT,
    steps_to_reproduce TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- App Versions
  CREATE TABLE IF NOT EXISTS app_versions (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL,
    version TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft',
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Process Triggers
  CREATE TABLE IF NOT EXISTS process_triggers (
    id TEXT PRIMARY KEY,
    process_id TEXT,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'timer',
    config TEXT,
    status TEXT DEFAULT 'active',
    hits INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Departments
  CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT,
    leader TEXT,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Ontology Actions
  CREATE TABLE IF NOT EXISTS ontology_actions (
    id TEXT PRIMARY KEY,
    object_id TEXT,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'custom',
    trigger_type TEXT DEFAULT 'manual',
    config TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Ontology Functions
  CREATE TABLE IF NOT EXISTS ontology_functions (
    id TEXT PRIMARY KEY,
    object_id TEXT,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'custom',
    expression TEXT,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Ontology Rules
  CREATE TABLE IF NOT EXISTS ontology_rules (
    id TEXT PRIMARY KEY,
    object_id TEXT,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'validation',
    condition_expr TEXT,
    action TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Export History
  CREATE TABLE IF NOT EXISTS export_history (
    id TEXT PRIMARY KEY,
    app_id TEXT,
    type TEXT,
    format TEXT,
    status TEXT DEFAULT 'completed',
    file_path TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Knowledge Q&A
  CREATE TABLE IF NOT EXISTS knowledge_qa (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT,
    source_doc_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Knowledge Graph Nodes
  CREATE TABLE IF NOT EXISTS knowledge_graph_nodes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'concept',
    description TEXT,
    metadata TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Knowledge Graph Edges
  CREATE TABLE IF NOT EXISTS knowledge_graph_edges (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    relation_type TEXT DEFAULT 'related',
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Market Templates
  CREATE TABLE IF NOT EXISTS market_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    author TEXT,
    price REAL DEFAULT 0,
    downloads INTEGER DEFAULT 0,
    rating REAL DEFAULT 4.5,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Orchestrations
  CREATE TABLE IF NOT EXISTS orchestrations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'custom',
    adapters TEXT,
    status TEXT DEFAULT 'draft',
    trigger_type TEXT DEFAULT 'manual',
    config TEXT,
    last_run TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- File System (WebIDE)
  CREATE TABLE IF NOT EXISTS fs_files (
    id TEXT PRIMARY KEY,
    app_id TEXT,
    parent_id TEXT,
    name TEXT NOT NULL,
    is_dir INTEGER DEFAULT 0,
    content TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Data Metrics
  CREATE TABLE IF NOT EXISTS data_metrics (
    id TEXT PRIMARY KEY,
    source_id TEXT,
    metric_name TEXT NOT NULL,
    metric_value REAL,
    period TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Roles (RBAC)
  CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    label TEXT,
    permissions TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// ─── Seed default roles if table is empty ─────────────────
const roleCount = db.prepare("SELECT COUNT(*) AS cnt FROM roles").get().cnt;
if (roleCount === 0) {
  const insertRole = db.prepare(
    "INSERT INTO roles (id, name, label, permissions) VALUES (?, ?, ?, ?)"
  );
  const seedRoles = db.transaction((roles) => {
    for (const r of roles) {
      insertRole.run(r.id, r.name, r.label, JSON.stringify(r.permissions));
    }
  });
  seedRoles([
    { id: "super_admin", name: "超级管理员", label: "Super Admin", permissions: ["*"] },
    { id: "executive", name: "高管", label: "Executive", permissions: ["dashboard.view", "reports.view", "apps.view"] },
    { id: "business", name: "业务人员", label: "Business User", permissions: ["apps.view", "apps.edit", "data.view", "process.start"] },
    { id: "developer", name: "开发者", label: "Developer", permissions: ["apps.*", "ontology.*", "data.*", "process.*", "code.edit"] },
    { id: "architect", name: "架构师", label: "Architect", permissions: ["apps.*", "ontology.*", "data.*", "process.*", "system.design"] },
    { id: "ops", name: "运维", label: "Operations", permissions: ["system.*", "monitoring.*", "logs.view", "config.edit"] },
    { id: "admin", name: "管理员", label: "Administrator", permissions: ["dashboard.view", "reports.view", "apps.view", "apps.edit", "data.view", "ontology.view", "process.view", "quality.view", "knowledge.view", "agents.view", "system.view"] },
  ]);
}

// ─── Migrations (additive) ─────────────────────────────────
// Ensure super_admin role exists in existing databases
try {
  const sa = db.prepare("SELECT id FROM roles WHERE id = ?").get("super_admin");
  if (!sa) {
    db.prepare(
      "INSERT INTO roles (id, name, label, permissions) VALUES (?, ?, ?, ?)"
    ).run("super_admin", "超级管理员", "Super Admin", JSON.stringify(["*"]));
  }
} catch {}
// Downgrade old admin role permissions from wildcard to standard admin
try {
  const adminRole = db.prepare("SELECT id, permissions FROM roles WHERE id = ?").get("admin");
  if (adminRole && adminRole.permissions === '["*"]') {
    db.prepare("UPDATE roles SET permissions = ? WHERE id = ?").run(
      JSON.stringify(["dashboard.view", "reports.view", "apps.view", "apps.edit", "data.view", "ontology.view", "process.view", "quality.view", "knowledge.view", "agents.view", "system.view"]),
      "admin"
    );
  }
} catch {}
try {
  db.exec(`ALTER TABLE applications ADD COLUMN app_slug TEXT`);
} catch {}
try {
  db.exec(`ALTER TABLE applications ADD COLUMN published_url TEXT`);
} catch {}
try {
  db.exec(`ALTER TABLE applications ADD COLUMN published_version TEXT`);
} catch {}
try {
  db.exec(`ALTER TABLE applications ADD COLUMN published_at TEXT`);
} catch {}
try {
  db.exec(`ALTER TABLE applications ADD COLUMN publish_config TEXT`);
} catch {}

// Market templates: icon, config, updated_at
try {
  db.exec(`ALTER TABLE market_templates ADD COLUMN icon TEXT`);
} catch {}
try {
  db.exec(`ALTER TABLE market_templates ADD COLUMN config TEXT`);
} catch {}
try {
  db.exec(`ALTER TABLE market_templates ADD COLUMN updated_at TEXT`);
} catch {}

// Knowledge Q&A: category, tags
try {
  db.exec(`ALTER TABLE knowledge_qa ADD COLUMN category TEXT`);
} catch {}
try {
  db.exec(`ALTER TABLE knowledge_qa ADD COLUMN tags TEXT`);
} catch {}

// Process triggers: event_type, enabled
try {
  db.exec(`ALTER TABLE process_triggers ADD COLUMN event_type TEXT`);
} catch {}
try {
  db.exec(`ALTER TABLE process_triggers ADD COLUMN enabled INTEGER DEFAULT 1`);
} catch {}

// ─── Architecture Center seed data ──────────────────────────────
const archSections = {
  // ─── Business Architecture ────────────────────────────
  ba: {
    ba_layers: [
      { level: 1, name: "战略层", desc: "企业战略目标与愿景", count: 2, color: "#6366f1" },
      { level: 2, name: "业务层", desc: "核心业务流程与价值链", count: 4, color: "#8b5cf6" },
      { level: 3, name: "能力层", desc: "组织核心业务能力", count: 6, color: "#a78bfa" },
      { level: 4, name: "流程层", desc: "端到端业务流程", count: 8, color: "#c4b5fd" },
      { level: 5, name: "角色层", desc: "业务角色与职责", count: 10, color: "#ddd6fe" },
      { level: 6, name: "事件层", desc: "业务事件与触发规则", count: 12, color: "#ede9fe" }
    ],
    value_chain: [
      { name: "市场洞察", apps: ["BI系统", "CRM"] },
      { name: "产品设计", apps: ["PLM", "项目管理"] },
      { name: "供应链管理", apps: ["ERP", "SRM"] },
      { name: "营销销售", apps: ["CRM", "营销平台"] },
      { name: "客户服务", apps: ["CRM", "工单系统"] },
      { name: "财务结算", apps: ["ERP", "财务系统"] }
    ],
    capabilities: [
      { name: "战略管理", subCaps: ["战略规划", "目标分解", "绩效监控"] },
      { name: "客户管理", subCaps: ["客户获取", "客户维护", "客户分析"] },
      { name: "产品管理", subCaps: ["需求管理", "产品规划", "版本管理"] },
      { name: "供应链管理", subCaps: ["采购管理", "库存管理", "物流管理"] },
      { name: "营销管理", subCaps: ["市场活动", "渠道管理", "品牌管理"] },
      { name: "销售管理", subCaps: ["商机管理", "合同管理", "回款管理"] },
      { name: "服务管理", subCaps: ["工单管理", "知识库", "满意度"] },
      { name: "财务管理", subCaps: ["预算管理", "成本核算", "财务报表"] },
      { name: "人力资源", subCaps: ["招聘管理", "培训管理", "绩效考核"] },
      { name: "项目管理", subCaps: ["立项管理", "进度跟踪", "资源调配"] },
      { name: "质量管理", subCaps: ["质量标准", "质量检测", "质量改进"] },
      { name: "IT运维", subCaps: ["系统监控", "故障处理", "变更管理"] }
    ],
    roles: [
      { role: "CEO", dept: "高管层", caps: ["战略规划", "目标分解"], flows: ["战略制定流程", "经营分析流程"], apps: ["BI系统", "OA"] },
      { role: "销售总监", dept: "销售部", caps: ["商机管理", "合同管理"], flows: ["销售管理流程", "合同审批流程"], apps: ["CRM", "合同系统"] },
      { role: "产品经理", dept: "产品部", caps: ["需求管理", "产品规划"], flows: ["需求管理流程", "产品发布流程"], apps: ["JIRA", "产品管理平台"] },
      { role: "采购经理", dept: "采购部", caps: ["采购管理", "供应商管理"], flows: ["采购管理流程", "供应商准入流程"], apps: ["ERP", "SRM"] },
      { role: "财务主管", dept: "财务部", caps: ["预算管理", "成本核算"], flows: ["费用报销流程", "预算审批流程"], apps: ["ERP", "财务系统"] },
      { role: "HR经理", dept: "人力资源部", caps: ["招聘管理", "培训管理"], flows: ["招聘管理流程", "培训管理流程"], apps: ["HR系统", "OA"] },
      { role: "项目经理", dept: "项目管理部", caps: ["立项管理", "进度跟踪"], flows: ["项目立项流程", "项目验收流程"], apps: ["项目管理系统", "JIRA"] },
      { role: "运维工程师", dept: "IT运维部", caps: ["系统监控", "故障处理"], flows: ["故障处理流程", "变更管理流程"], apps: ["监控平台", "CMDB"] }
    ],
    events: [
      { name: "客户下单", trigger: "客户提交订单", type: "外部事件", process: "订单处理流程", freq: "高" },
      { name: "库存预警", trigger: "库存低于阈值", type: "系统事件", process: "采购补货流程", freq: "中" },
      { name: "合同到期", trigger: "合同到期前30天", type: "定时事件", process: "合同续签流程", freq: "低" },
      { name: "工单创建", trigger: "客户提交服务请求", type: "外部事件", process: "工单处理流程", freq: "高" },
      { name: "费用超支", trigger: "费用超出预算", type: "系统事件", process: "预算调整流程", freq: "中" },
      { name: "绩效到期", trigger: "季度末", type: "定时事件", process: "绩效考核流程", freq: "低" },
      { name: "系统故障", trigger: "监控告警", type: "系统事件", process: "故障处理流程", freq: "中" },
      { name: "招聘需求", trigger: "部门提交HC申请", type: "内部事件", process: "招聘管理流程", freq: "中" }
    ],
    objects: [
      { name: "客户", domain: "客户域", fields: ["客户ID", "名称", "类型", "联系方式", "等级"], relations: ["联系人", "商机", "合同"] },
      { name: "商机", domain: "客户域", fields: ["商机ID", "名称", "金额", "阶段", "预计成交日期"], relations: ["客户", "报价", "合同"] },
      { name: "合同", domain: "客户域", fields: ["合同ID", "编号", "金额", "状态", "签署日期"], relations: ["客户", "订单", "回款"] },
      { name: "产品", domain: "产品域", fields: ["产品ID", "名称", "分类", "价格", "状态"], relations: ["订单", "BOM", "库存"] },
      { name: "订单", domain: "订单域", fields: ["订单ID", "编号", "客户", "金额", "状态"], relations: ["客户", "产品", "发货"] },
      { name: "供应商", domain: "供应链域", fields: ["供应商ID", "名称", "类型", "评级", "联系方式"], relations: ["采购单", "合同"] },
      { name: "员工", domain: "人事域", fields: ["工号", "姓名", "部门", "职位", "入职日期"], relations: ["部门", "考勤", "薪资"] },
      { name: "部门", domain: "人事域", fields: ["部门ID", "名称", "上级部门", "负责人", "人数"], relations: ["员工", "预算"] },
      { name: "工单", domain: "服务域", fields: ["工单ID", "标题", "类型", "状态", "处理人"], relations: ["客户", "知识库", "处理记录"] }
    ]
  },

  // ─── Application Architecture ─────────────────────────
  aa: {
    app_dependencies: [
      { from: "CRM", to: "ERP", calls: "客户/合同同步", type: "数据同步" },
      { from: "ERP", to: "财务系统", calls: "应收应付", type: "接口调用" },
      { from: "CRM", to: "BI系统", calls: "销售报表", type: "数据查询" },
      { from: "OA", to: "HR系统", calls: "考勤/审批", type: "流程驱动" },
      { from: "项目管理", to: "JIRA", calls: "任务同步", type: "数据同步" }
    ],
    app_flow_matrix: [
      { app: "CRM", flows: ["销售管理", "客户管理", "合同管理"], data: ["客户数据", "商机数据", "合同数据"], pages: ["客户列表", "商机看板", "合同详情"] },
      { app: "ERP", flows: ["采购管理", "库存管理", "生产管理"], data: ["供应商数据", "库存数据", "BOM数据"], pages: ["采购单列表", "库存看板", "生产计划"] },
      { app: "OA", flows: ["审批流程", "公告管理", "日程管理"], data: ["审批数据", "公告数据", "日程数据"], pages: ["审批中心", "公告列表", "日程视图"] },
      { app: "HR系统", flows: ["招聘管理", "培训管理", "绩效管理"], data: ["员工数据", "培训数据", "绩效数据"], pages: ["员工花名册", "培训课程", "绩效考核"] },
      { app: "BI系统", flows: ["数据采集", "报表分析", "数据可视化"], data: ["经营数据", "业务数据", "财务数据"], pages: ["仪表盘", "报表中心", "数据大屏"] },
      { app: "项目管理", flows: ["项目立项", "进度跟踪", "资源管理"], data: ["项目数据", "任务数据", "资源数据"], pages: ["项目列表", "甘特图", "资源视图"] }
    ],
    biz_app_matrix: [
      { process: "销售管理", crm: true, erp: false, hr: false, bi: true, oa: true, bpm: true },
      { process: "采购管理", crm: false, erp: true, hr: false, bi: true, oa: true, bpm: true },
      { process: "库存管理", crm: false, erp: true, hr: false, bi: true, oa: false, bpm: false },
      { process: "人事管理", crm: false, erp: false, hr: true, bi: true, oa: true, bpm: true },
      { process: "财务管理", crm: false, erp: true, hr: false, bi: true, oa: true, bpm: true },
      { process: "项目管理", crm: false, erp: false, hr: false, bi: true, oa: true, bpm: true },
      { process: "客户服务", crm: true, erp: false, hr: false, bi: true, oa: true, bpm: true },
      { process: "质量管理", crm: false, erp: true, hr: false, bi: true, oa: false, bpm: true }
    ],
    app_data_matrix: [
      { app: "CRM", domains: [true, true, false, false, false, true] },
      { app: "ERP", domains: [false, true, true, true, false, true] },
      { app: "OA", domains: [false, false, false, false, true, true] },
      { app: "HR系统", domains: [false, false, false, false, true, false] },
      { app: "BI系统", domains: [true, true, true, true, true, true] },
      { app: "项目管理", domains: [false, false, false, false, true, true] }
    ]
  },

  // ─── Data Architecture ────────────────────────────────
  da: {
    data_domains: [
      { name: "客户域", objects: 12, apps: 8 },
      { name: "订单域", objects: 15, apps: 6 },
      { name: "产品域", objects: 10, apps: 5 },
      { name: "财务域", objects: 18, apps: 7 },
      { name: "人事域", objects: 14, apps: 4 },
      { name: "运营域", objects: 20, apps: 10 }
    ],
    lake_warehouse: [
      { layer: "ODS", name: "操作数据层", count: 156, desc: "原始数据接入与存储" },
      { layer: "DWD", name: "明细数据层", count: 203, desc: "数据清洗与标准化" },
      { layer: "DWS", name: "汇总数据层", count: 87, desc: "按主题汇总统计" },
      { layer: "ADS", name: "应用数据层", count: 45, desc: "面向应用的数据服务" }
    ],
    data_distribution: {
      lake: [
        { name: "客户数据湖", size: "2.5TB", tables: 45 },
        { name: "交易数据湖", size: "5.8TB", tables: 120 },
        { name: "行为数据湖", size: "1.2TB", tables: 35 }
      ],
      warehouse: [
        { layer: "ODS", size: "800GB", tables: 156 },
        { layer: "DWD", size: "1.2TB", tables: 203 },
        { layer: "DWS", size: "600GB", tables: 87 },
        { layer: "ADS", size: "200GB", tables: 45 }
      ],
      realtime: [
        { name: "实时交易", size: "50GB", count: 12 },
        { name: "实时监控", size: "20GB", count: 8 },
        { name: "实时推送", size: "10GB", count: 6 }
      ]
    }
  },

  // ─── Tech Architecture ────────────────────────────────
  ta: {
    tech_stack: [
      { layer: "前端", items: ["Vue 3", "TypeScript", "Element Plus", "Vite"] },
      { layer: "后端", items: ["Node.js", "Express", "better-sqlite3", "RESTful API"] },
      { layer: "AI/LLM", items: ["GPT-4", "Claude", "LangChain", "向量数据库"] },
      { layer: "数据", items: ["ClickHouse", "Redis", "Elasticsearch", "Kafka"] },
      { layer: "基础设施", items: ["Docker", "Nginx", "GitHub Actions", "PM2"] },
      { layer: "监控", items: ["Prometheus", "Grafana", "Sentry", "ELK Stack"] }
    ],
    deploy_topology: [
      { label: "应用服务器", value: "3节点集群" },
      { label: "数据库", value: "主从复制" },
      { label: "负载均衡", value: "Nginx Upstream" },
      { label: "CDN", value: "静态资源加速" }
    ],
    observability: [
      { label: "日志采集", value: "ELK Stack" },
      { label: "指标监控", value: "Prometheus + Grafana" },
      { label: "链路追踪", value: "OpenTelemetry" },
      { label: "告警通知", value: "飞书 + 邮件" }
    ],
    tech_selection: [
      { layer: "前端框架", a: "Vue 2", b: "Vue 3", chosen: "Vue 3", score: 9 },
      { layer: "UI组件库", a: "Element UI", b: "Element Plus", chosen: "Element Plus", score: 8 },
      { layer: "构建工具", a: "Webpack", b: "Vite", chosen: "Vite", score: 9 },
      { layer: "后端框架", a: "Koa", b: "Express", chosen: "Express", score: 8 },
      { layer: "数据库", a: "MySQL", b: "SQLite", chosen: "SQLite", score: 7 },
      { layer: "缓存", a: "Memcached", b: "Redis", chosen: "Redis", score: 9 },
      { layer: "搜索引擎", a: "Solr", b: "Elasticsearch", chosen: "Elasticsearch", score: 9 },
      { layer: "消息队列", a: "RabbitMQ", b: "Kafka", chosen: "Kafka", score: 8 },
      { layer: "容器化", a: "Podman", b: "Docker", chosen: "Docker", score: 9 }
    ]
  }
};

for (const [section, data] of Object.entries(archSections)) {
  const key = `architecture_${section}`;
  const existing = db.prepare("SELECT key FROM system_config WHERE key = ?").get(key);
  if (!existing) {
    db.prepare(
      "INSERT INTO system_config (key, value, description, updated_at) VALUES (?, ?, ?, datetime('now'))"
    ).run(key, JSON.stringify(data), `Architecture center ${section} data`);
  }
}

export default db;
