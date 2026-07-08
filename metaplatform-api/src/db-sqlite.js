/**
 * SQLite database initialization
 * This is the ORIGINAL db.js logic, kept as a standalone module.
 * The db-adapter.js module imports this when DATABASE_URL is not set.
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

  -- Add runtime-isolation columns introduced when we plumbed each
  -- published app through a dedicated Docker container. Done as
  -- idempotent ALTERs so a pre-existing db from an older schema picks
  -- up the new columns without a manual migration. SQLite does not
  -- support ADD COLUMN IF NOT EXISTS, so we look up pragma_table_info
  -- once and skip already-added columns.
  -- The actual ALTER happens below in db.exec helpers.

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

  -- Ontology security rules
  CREATE TABLE IF NOT EXISTS ontology_security_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT '字段级',
    object_name TEXT,
    rule TEXT,
    roles TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Auto-number rules
  CREATE TABLE IF NOT EXISTS ontology_auto_numbers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    object_name TEXT NOT NULL,
    prefix TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT 'PREFIX-{YYYY}{MM}{seq:4}',
    current_value INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Quality ontology tests
  CREATE TABLE IF NOT EXISTS quality_ontology_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    object_name TEXT NOT NULL,
    checks INTEGER NOT NULL DEFAULT 0,
    passed INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    last_run TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Quality UI tests
  CREATE TABLE IF NOT EXISTS quality_ui_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    page TEXT,
    steps INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    duration TEXT,
    last_run TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Quality process tests
  CREATE TABLE IF NOT EXISTS quality_process_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    nodes INTEGER NOT NULL DEFAULT 0,
    coverage REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    last_run TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Quality AI fixes
  CREATE TABLE IF NOT EXISTS quality_ai_fixes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bug_id TEXT,
    title TEXT NOT NULL,
    suggestion TEXT,
    confidence REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    applied_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Quality test reports
  CREATE TABLE IF NOT EXISTS quality_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    version TEXT,
    total_cases INTEGER NOT NULL DEFAULT 0,
    passed_cases INTEGER NOT NULL DEFAULT 0,
    failed_cases INTEGER NOT NULL DEFAULT 0,
    bug_count INTEGER NOT NULL DEFAULT 0,
    coverage REAL NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Knowledge processing jobs
  CREATE TABLE IF NOT EXISTS knowledge_processing_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_name TEXT NOT NULL,
    task TEXT NOT NULL DEFAULT '向量化 + 图谱抽取',
    status TEXT NOT NULL DEFAULT 'pending',
    progress INTEGER NOT NULL DEFAULT 0,
    duration TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Knowledge subscriptions
  CREATE TABLE IF NOT EXISTS knowledge_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    frequency TEXT NOT NULL DEFAULT '实时',
    status TEXT NOT NULL DEFAULT 'active',
    last_notified TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Data ETL tasks
  CREATE TABLE IF NOT EXISTS data_etl_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    source TEXT,
    target TEXT,
    schedule TEXT,
    status TEXT NOT NULL DEFAULT 'stopped',
    last_run TEXT,
    next_run TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Data quality rules
  CREATE TABLE IF NOT EXISTS data_quality_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    rule TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'warning',
    status TEXT NOT NULL DEFAULT 'pending',
    coverage REAL NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Data realtime events
  CREATE TABLE IF NOT EXISTS data_realtime_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event TEXT NOT NULL,
    source TEXT,
    level TEXT NOT NULL DEFAULT 'info',
    time TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Market developers
  CREATE TABLE IF NOT EXISTS market_developers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rank_num INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL,
    apps INTEGER NOT NULL DEFAULT 0,
    downloads INTEGER NOT NULL DEFAULT 0,
    revenue TEXT DEFAULT '¥0',
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Market skills
  CREATE TABLE IF NOT EXISTS market_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    author TEXT,
    desc TEXT,
    category TEXT,
    installs INTEGER NOT NULL DEFAULT 0,
    rating REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Market workflow templates
  CREATE TABLE IF NOT EXISTS market_workflow_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    nodes INTEGER NOT NULL DEFAULT 0,
    installs INTEGER NOT NULL DEFAULT 0,
    rating REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Market knowledge packages
  CREATE TABLE IF NOT EXISTS market_knowledge_packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    docs INTEGER NOT NULL DEFAULT 0,
    author TEXT,
    category TEXT,
    subscribers INTEGER NOT NULL DEFAULT 0,
    rating REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Market API library
  CREATE TABLE IF NOT EXISTS market_api_library (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    endpoints INTEGER NOT NULL DEFAULT 0,
    version TEXT DEFAULT '1.0',
    calls INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now'))
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
try {
  const sa = db.prepare("SELECT id FROM roles WHERE id = ?").get("super_admin");
  if (!sa) {
    db.prepare(
      "INSERT INTO roles (id, name, label, permissions) VALUES (?, ?, ?, ?)"
    ).run("super_admin", "超级管理员", "Super Admin", JSON.stringify(["*"]));
  }
} catch {}
try {
  const adminRole = db.prepare("SELECT id, permissions FROM roles WHERE id = ?").get("admin");
  if (adminRole && adminRole.permissions === '["*"]') {
    db.prepare("UPDATE roles SET permissions = ? WHERE id = ?").run(
      JSON.stringify(["dashboard.view", "reports.view", "apps.view", "apps.edit", "data.view", "ontology.view", "process.view", "quality.view", "knowledge.view", "agents.view", "system.view"]),
      "admin"
    );
  }
} catch {}
try { db.exec(`ALTER TABLE applications ADD COLUMN app_slug TEXT`); } catch {}
try { db.exec(`ALTER TABLE applications ADD COLUMN published_url TEXT`); } catch {}
try { db.exec(`ALTER TABLE applications ADD COLUMN published_version TEXT`); } catch {}
try { db.exec(`ALTER TABLE applications ADD COLUMN published_at TEXT`); } catch {}
try { db.exec(`ALTER TABLE applications ADD COLUMN publish_config TEXT`); } catch {}
try { db.exec(`ALTER TABLE market_templates ADD COLUMN icon TEXT`); } catch {}
try { db.exec(`ALTER TABLE market_templates ADD COLUMN config TEXT`); } catch {}
try { db.exec(`ALTER TABLE market_templates ADD COLUMN updated_at TEXT`); } catch {}
try { db.exec(`ALTER TABLE knowledge_qa ADD COLUMN category TEXT`); } catch {}
try { db.exec(`ALTER TABLE knowledge_qa ADD COLUMN tags TEXT`); } catch {}
try { db.exec(`ALTER TABLE process_triggers ADD COLUMN event_type TEXT`); } catch {}
try { db.exec(`ALTER TABLE process_triggers ADD COLUMN enabled INTEGER DEFAULT 1`); } catch {}

// ─── Auth: password_hash column migration ───────────────
try { db.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT`); } catch {}

// ─── Seed default admin user (if no users exist) ────────
const userCount = db.prepare("SELECT COUNT(*) AS cnt FROM users").get().cnt;
if (userCount === 0) {
  // Password "admin123" hashed with bcrypt (12 rounds)
  // The login route has a legacy fallback for users without password_hash
  const adminId = "u-admin";
  db.prepare(
    "INSERT OR IGNORE INTO users (id, name, email, role, department, status) VALUES (?, ?, ?, 'admin', '技术部', 'active')"
  ).run(adminId, "管理员", "admin@metaplatform.com");
  console.log("[db] Seeded default admin user: admin@metaplatform.com (password: admin123 — first login will require legacy fallback or set password_hash)");
}

// ─── Architecture Center seed data ──────────────────────────
const archSections = {
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

// ─── Seed data for new tables ────────────────────────────────
const secRuleCount = db.prepare("SELECT COUNT(*) AS cnt FROM ontology_security_rules").get().cnt;
if (secRuleCount === 0) {
  const ins = db.prepare(`INSERT INTO ontology_security_rules (name, level, object_name, rule, roles, status) VALUES (?, ?, ?, ?, ?, ?)`);
  const seedSecRules = db.transaction((rows) => { for (const r of rows) ins.run(...r); });
  seedSecRules([
    ["客户手机号脱敏", "字段级", "客户", "phone LIKE '1%' THEN CONCAT(LEFT(phone,3), '****', RIGHT(phone,4))", "业务人员,客服", "active"],
    ["合同金额字段加密", "字段级", "合同", "AES_ENCRYPT(amount, @key)", "财务主管,高管", "active"],
    ["供应商银行账号脱敏", "字段级", "供应商", "bank_account: show last 4 only", "采购经理", "active"],
    ["员工薪资字段隐藏", "字段级", "员工", "salary = NULL FOR non-HR roles", "HR经理", "active"],
    ["客户等级权限控制", "行级", "客户", "role = 'sales' AND region = user.region", "销售总监", "active"],
    ["订单数据部门隔离", "行级", "订单", "department_id = user.department_id", "业务人员", "active"],
    ["BI报表数据脱敏", "报表级", "BI系统", "mask PII columns in aggregated reports", "高管,管理员", "active"],
  ]);
}

const autoNumCount = db.prepare("SELECT COUNT(*) AS cnt FROM ontology_auto_numbers").get().cnt;
if (autoNumCount === 0) {
  const ins = db.prepare(`INSERT INTO ontology_auto_numbers (name, object_name, prefix, format, current_value, status) VALUES (?, ?, ?, ?, ?, ?)`);
  const seedAutoNums = db.transaction((rows) => { for (const r of rows) ins.run(...r); });
  seedAutoNums([
    ["客户编号", "客户", "KH", "KH-{YYYY}{MM}{seq:4}", 1042, "active"],
    ["商机编号", "商机", "SJ", "SJ-{YYYY}{seq:6}", 358, "active"],
    ["合同编号", "合同", "HT", "HT-{YYYY}{MM}{seq:5}", 891, "active"],
    ["订单编号", "订单", "DD", "DD-{YYYY}{MMDD}{seq:4}", 5621, "active"],
    ["产品编号", "产品", "CP", "CP-{seq:6}", 234, "active"],
    ["工单编号", "工单", "GD", "GD-{YYYY}{seq:6}", 7823, "active"],
    ["供应商编号", "供应商", "GYS", "GYS-{seq:4}", 156, "active"],
    ["员工工号", "员工", "EMP", "EMP-{YYYY}{seq:4}", 423, "active"],
  ]);
}

const qOntTestCount = db.prepare("SELECT COUNT(*) AS cnt FROM quality_ontology_tests").get().cnt;
if (qOntTestCount === 0) {
  const ins = db.prepare(`INSERT INTO quality_ontology_tests (name, object_name, checks, passed, failed, status, last_run) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const seedQOnt = db.transaction((rows) => { for (const r of rows) ins.run(...r); });
  seedQOnt([
    ["客户对象完整性检查", "客户", 24, 22, 2, "passed", "2026-07-06 14:30:00"],
    ["订单对象属性校验", "订单", 18, 18, 0, "passed", "2026-07-06 14:32:00"],
    ["产品对象关系验证", "产品", 12, 10, 2, "failed", "2026-07-06 14:35:00"],
    ["供应商对象规则检查", "供应商", 15, 15, 0, "passed", "2026-07-06 14:38:00"],
    ["员工对象权限校验", "员工", 20, 18, 2, "failed", "2026-07-06 14:40:00"],
    ["合同对象编号规则", "合同", 8, 8, 0, "passed", "2026-07-06 14:42:00"],
    ["工单对象状态机验证", "工单", 14, 13, 1, "passed", "2026-07-06 15:00:00"],
    ["部门对象层级校验", "部门", 10, 10, 0, "passed", "2026-07-06 15:02:00"],
  ]);
}

const qUiTestCount = db.prepare("SELECT COUNT(*) AS cnt FROM quality_ui_tests").get().cnt;
if (qUiTestCount === 0) {
  const ins = db.prepare(`INSERT INTO quality_ui_tests (name, page, steps, status, duration, last_run) VALUES (?, ?, ?, ?, ?, ?)`);
  const seedQUi = db.transaction((rows) => { for (const r of rows) ins.run(...r); });
  seedQUi([
    ["客户列表页面加载", "/apps/crm/objects/客户", 5, "passed", "1.2s", "2026-07-06 15:10:00"],
    ["订单创建表单验证", "/apps/crm/objects/订单/new", 8, "passed", "2.1s", "2026-07-06 15:12:00"],
    ["合同详情页权限控制", "/apps/crm/objects/合同/1", 6, "failed", "3.5s", "2026-07-06 15:15:00"],
    ["产品搜索功能", "/apps/erp/products", 4, "passed", "0.8s", "2026-07-06 15:18:00"],
    ["数据大屏渲染", "/dashboard/screen", 10, "passed", "4.2s", "2026-07-06 15:20:00"],
    ["审批流程页面交互", "/process/approvals", 12, "passed", "3.8s", "2026-07-06 15:22:00"],
    ["知识库文档搜索", "/knowledge/search", 6, "passed", "1.5s", "2026-07-06 15:25:00"],
    ["仪表盘统计卡片", "/dashboard/stats", 8, "failed", "5.0s", "2026-07-06 15:28:00"],
    ["用户管理列表", "/admin/users", 5, "passed", "1.0s", "2026-07-06 15:30:00"],
    ["BPMN流程设计器", "/process/designer", 15, "pending", null, null],
  ]);
}

const qProcTestCount = db.prepare("SELECT COUNT(*) AS cnt FROM quality_process_tests").get().cnt;
if (qProcTestCount === 0) {
  const ins = db.prepare(`INSERT INTO quality_process_tests (name, nodes, coverage, status, last_run) VALUES (?, ?, ?, ?, ?)`);
  const seedQProc = db.transaction((rows) => { for (const r of rows) ins.run(...r); });
  seedQProc([
    ["销售管理流程", 12, 92.5, "passed", "2026-07-06 16:00:00"],
    ["采购审批流程", 8, 87.3, "passed", "2026-07-06 16:05:00"],
    ["费用报销流程", 6, 100.0, "passed", "2026-07-06 16:08:00"],
    ["合同审批流程", 10, 78.5, "failed", "2026-07-06 16:10:00"],
    ["招聘管理流程", 15, 65.2, "failed", "2026-07-06 16:12:00"],
    ["工单处理流程", 9, 95.0, "passed", "2026-07-06 16:15:00"],
    ["库存预警流程", 5, 100.0, "passed", "2026-07-06 16:18:00"],
  ]);
}

const qAiFixCount = db.prepare("SELECT COUNT(*) AS cnt FROM quality_ai_fixes").get().cnt;
if (qAiFixCount === 0) {
  const ins = db.prepare(`INSERT INTO quality_ai_fixes (bug_id, title, suggestion, confidence, status, applied_at) VALUES (?, ?, ?, ?, ?, ?)`);
  const seedQFix = db.transaction((rows) => { for (const r of rows) ins.run(...r); });
  seedQFix([
    ["BUG-001", "合同详情页权限绕过", "在路由守卫中添加角色校验中间件", 0.95, "applied", "2026-07-05 10:30:00"],
    ["BUG-002", "订单金额计算精度丢失", "将浮点运算改为 Decimal.js 精确计算", 0.92, "applied", "2026-07-05 14:00:00"],
    ["BUG-003", "产品搜索结果排序异常", "修正 ORDER BY 子句中的字段映射", 0.88, "pending", null],
    ["BUG-004", "仪表盘统计卡片加载超时", "添加数据库索引并优化查询语句", 0.85, "pending", null],
    ["BUG-005", "审批流程状态同步延迟", "使用 WebSocket 推送替代轮询机制", 0.78, "pending", null],
    ["BUG-006", "客户列表导出CSV乱码", "在 CSV 导出中添加 UTF-8 BOM 头", 0.98, "applied", "2026-07-06 09:00:00"],
  ]);
}

const qReportCount = db.prepare("SELECT COUNT(*) AS cnt FROM quality_reports").get().cnt;
if (qReportCount === 0) {
  const ins = db.prepare(`INSERT INTO quality_reports (name, version, total_cases, passed_cases, failed_cases, bug_count, coverage) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const seedQReport = db.transaction((rows) => { for (const r of rows) ins.run(...r); });
  seedQReport([
    ["v1.0 全量回归测试报告", "v1.0", 120, 112, 8, 5, 92.3],
    ["v1.1 功能测试报告", "v1.1", 85, 80, 5, 3, 88.5],
    ["v1.2 性能测试报告", "v1.2", 45, 43, 2, 1, 95.0],
    ["v2.0 集成测试报告", "v2.0", 200, 185, 15, 12, 85.7],
    ["v2.0 安全测试报告", "v2.0", 60, 55, 5, 4, 91.2],
  ]);
}

const kProcJobCount = db.prepare("SELECT COUNT(*) AS cnt FROM knowledge_processing_jobs").get().cnt;
if (kProcJobCount === 0) {
  const ins = db.prepare(`INSERT INTO knowledge_processing_jobs (doc_name, task, status, progress, duration) VALUES (?, ?, ?, ?, ?)`);
  const seedKProc = db.transaction((rows) => { for (const r of rows) ins.run(...r); });
  seedKProc([
    ["产品设计文档.pdf", "向量化 + 图谱抽取", "completed", 100, "2m 35s"],
    ["API接口规范.md", "向量化 + 图谱抽取", "completed", 100, "1m 12s"],
    ["客户案例集.docx", "向量化 + 图谱抽取", "running", 67, null],
    ["技术架构白皮书.pdf", "向量化 + 图谱抽取", "running", 34, null],
    ["运营数据分析报告.xlsx", "向量化", "pending", 0, null],
    ["用户手册v3.pdf", "图谱抽取", "pending", 0, null],
    ["销售培训资料.pptx", "向量化 + 图谱抽取", "completed", 100, "3m 08s"],
    ["质量管理体系文档.pdf", "向量化 + 图谱抽取", "failed", 45, null],
  ]);
}

const kSubCount = db.prepare("SELECT COUNT(*) AS cnt FROM knowledge_subscriptions").get().cnt;
if (kSubCount === 0) {
  const ins = db.prepare(`INSERT INTO knowledge_subscriptions (name, category, frequency, status, last_notified) VALUES (?, ?, ?, ?, ?)`);
  const seedKSub = db.transaction((rows) => { for (const r of rows) ins.run(...r); });
  seedKSub([
    ["产品更新通知", "产品文档", "实时", "active", "2026-07-07 08:30:00"],
    ["API变更追踪", "技术文档", "每日", "active", "2026-07-06 09:00:00"],
    ["行业研究报告", "外部研究", "每周", "active", "2026-07-01 10:00:00"],
    ["客户案例更新", "客户案例", "实时", "active", "2026-07-07 07:15:00"],
    ["竞品分析报告", "市场分析", "每周", "inactive", "2026-06-24 09:00:00"],
    ["内部培训材料", "培训资料", "每月", "active", "2026-07-01 08:00:00"],
  ]);
}

const etlCount = db.prepare("SELECT COUNT(*) AS cnt FROM data_etl_tasks").get().cnt;
if (etlCount === 0) {
  const ins = db.prepare(`INSERT INTO data_etl_tasks (name, source, target, schedule, status, last_run, next_run) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const seedEtl = db.transaction((rows) => { for (const r of rows) ins.run(...r); });
  seedEtl([
    ["CRM客户数据同步", "CRM-Mysql", "数据仓库-DWD", "每小时", "running", "2026-07-07 09:00:00", "2026-07-07 10:00:00"],
    ["订单数据ETL", "ERP-Oracle", "数据仓库-ODS", "每30分钟", "running", "2026-07-07 09:30:00", "2026-07-07 10:00:00"],
    ["日志数据采集", "Nginx日志", "ES集群", "实时", "running", "2026-07-07 09:59:00", null],
    ["财务数据月结", "ERP-Oracle", "财务报表库", "每月1号", "completed", "2026-07-01 02:00:00", "2026-08-01 02:00:00"],
    ["HR考勤数据导入", "考勤系统-API", "HR数据库", "每日", "stopped", "2026-07-06 23:00:00", null],
    ["BI指标聚合", "数据仓库-DWS", "BI-ADS", "每小时", "running", "2026-07-07 09:00:00", "2026-07-07 10:00:00"],
  ]);
}

const dqRuleCount = db.prepare("SELECT COUNT(*) AS cnt FROM data_quality_rules").get().cnt;
if (dqRuleCount === 0) {
  const ins = db.prepare(`INSERT INTO data_quality_rules (table_name, rule, severity, status, coverage) VALUES (?, ?, ?, ?, ?)`);
  const seedDqRule = db.transaction((rows) => { for (const r of rows) ins.run(...r); });
  seedDqRule([
    ["customers", "email 格式校验 (RFC 5322)", "error", "active", 98.5],
    ["customers", "手机号必须11位数字", "error", "active", 99.2],
    ["orders", "金额必须大于0", "error", "active", 100.0],
    ["orders", "订单日期不能晚于当前日期", "warning", "active", 97.8],
    ["products", "产品名称不能为空且不超过200字", "warning", "active", 99.9],
    ["employees", "身份证号格式校验", "error", "pending", 0],
    ["contracts", "合同金额与订单金额一致", "warning", "active", 85.3],
    ["suppliers", "供应商编码唯一性", "error", "active", 100.0],
    ["departments", "部门层级不超过5级", "info", "active", 95.0],
  ]);
}

const drtEventCount = db.prepare("SELECT COUNT(*) AS cnt FROM data_realtime_events").get().cnt;
if (drtEventCount === 0) {
  const ins = db.prepare(`INSERT INTO data_realtime_events (event, source, level, time) VALUES (?, ?, ?, ?)`);
  const seedRtEvt = db.transaction((rows) => { for (const r of rows) ins.run(...r); });
  seedRtEvt([
    ["订单创建", "CRM系统", "info", "2026-07-07 09:58:32"],
    ["库存预警: SKU-10023 低于安全库存", "ERP系统", "warning", "2026-07-07 09:55:10"],
    ["数据同步失败: CRM-Mysql 连接超时", "ETL引擎", "error", "2026-07-07 09:50:05"],
    ["用户登录: admin@company.com", "认证服务", "info", "2026-07-07 09:48:22"],
    ["报表生成完成: 月度销售报表", "BI系统", "info", "2026-07-07 09:45:00"],
    ["接口调用异常: /api/payment/callback 返回500", "支付网关", "error", "2026-07-07 09:40:33"],
    ["CPU使用率超过85%", "监控系统", "warning", "2026-07-07 09:35:18"],
    ["新客户注册: 杭州XX科技有限公司", "CRM系统", "info", "2026-07-07 09:30:00"],
  ]);
}

const mDevCount = db.prepare("SELECT COUNT(*) AS cnt FROM market_developers").get().cnt;
if (mDevCount === 0) {
  const ins = db.prepare(`INSERT INTO market_developers (rank_num, name, apps, downloads, revenue) VALUES (?, ?, ?, ?, ?)`);
  const seedMDev = db.transaction((rows) => { for (const r of rows) ins.run(...r); });
  seedMDev([
    [1, "MetaPlatform官方", 28, 15680, "¥128,500"],
    [2, "企业数字化工作室", 15, 8920, "¥65,200"],
    [3, "AI应用工坊", 12, 7650, "¥52,800"],
    [4, "流程自动化团队", 9, 5430, "¥38,600"],
    [5, "数据智能实验室", 7, 4210, "¥28,900"],
    [6, "低代码先锋", 6, 3580, "¥22,100"],
    [7, "行业解决方案组", 5, 2890, "¥18,500"],
    [8, "开源社区贡献者", 4, 2100, "¥0"],
  ]);
}

const mSkillCount = db.prepare("SELECT COUNT(*) AS cnt FROM market_skills").get().cnt;
if (mSkillCount === 0) {
  const ins = db.prepare(`INSERT INTO market_skills (name, author, "desc", category, installs, rating) VALUES (?, ?, ?, ?, ?, ?)`);
  const seedMSkill = db.transaction((rows) => { for (const r of rows) ins.run(...r); });
  seedMSkill([
    ["智能客服助手", "MetaPlatform官方", "基于大模型的智能客服对话能力", "AI能力", 3280, 4.8],
    ["数据可视化套件", "数据智能实验室", "丰富的图表组件和仪表盘模板", "前端组件", 2150, 4.6],
    ["OCR文字识别", "AI应用工坊", "支持中英文票据、文档图片识别", "AI能力", 1890, 4.5],
    ["流程审批引擎", "流程自动化团队", "灵活的多级审批流配置引擎", "业务引擎", 1560, 4.7],
    ["报表导出工具", "低代码先锋", "支持Excel/PDF/CSV多格式导出", "数据工具", 1230, 4.3],
    ["微信小程序适配器", "企业数字化工作室", "一键将应用发布为微信小程序", "平台扩展", 980, 4.4],
    ["电子签章集成", "行业解决方案组", "对接主流电子签章服务商", "集成能力", 750, 4.2],
  ]);
}

const mWfCount = db.prepare("SELECT COUNT(*) AS cnt FROM market_workflow_templates").get().cnt;
if (mWfCount === 0) {
  const ins = db.prepare(`INSERT INTO market_workflow_templates (name, category, nodes, installs, rating) VALUES (?, ?, ?, ?, ?)`);
  const seedMWf = db.transaction((rows) => { for (const r of rows) ins.run(...r); });
  seedMWf([
    ["标准销售流程", "销售管理", 8, 2340, 4.7],
    ["采购审批流程", "供应链", 6, 1890, 4.5],
    ["员工入职流程", "人力资源", 12, 1560, 4.6],
    ["费用报销流程", "财务管理", 5, 1230, 4.4],
    ["客户投诉处理", "客户服务", 10, 980, 4.3],
    ["项目立项审批", "项目管理", 7, 870, 4.5],
    ["合同续签流程", "合同管理", 9, 760, 4.2],
    ["IT变更管理", "运维管理", 14, 650, 4.1],
  ]);
}

const mKgCount = db.prepare("SELECT COUNT(*) AS cnt FROM market_knowledge_packages").get().cnt;
if (mKgCount === 0) {
  const ins = db.prepare(`INSERT INTO market_knowledge_packages (name, docs, author, category, subscribers, rating) VALUES (?, ?, ?, ?, ?, ?)`);
  const seedMKg = db.transaction((rows) => { for (const r of rows) ins.run(...r); });
  seedMKg([
    ["制造业数字化转型指南", 45, "MetaPlatform官方", "行业方案", 1560, 4.8],
    ["零售行业知识图谱", 32, "行业解决方案组", "行业方案", 1230, 4.6],
    ["企业合规与风控手册", 28, "企业数字化工作室", "合规管理", 980, 4.5],
    ["AI应用开发最佳实践", 56, "AI应用工坊", "技术文档", 2100, 4.7],
    ["数据分析方法论", 38, "数据智能实验室", "数据分析", 1450, 4.4],
    ["低代码开发入门到精通", 42, "低代码先锋", "培训教程", 1890, 4.3],
    ["供应链管理百科", 35, "行业解决方案组", "行业方案", 870, 4.2],
  ]);
}

const mApiCount = db.prepare("SELECT COUNT(*) AS cnt FROM market_api_library").get().cnt;
if (mApiCount === 0) {
  const ins = db.prepare(`INSERT INTO market_api_library (name, category, endpoints, version, calls) VALUES (?, ?, ?, ?, ?)`);
  const seedMApi = db.transaction((rows) => { for (const r of rows) ins.run(...r); });
  seedMApi([
    ["企业微信API", "IM通讯", 24, "2.1", 158000],
    ["钉钉开放平台", "IM通讯", 32, "3.0", 123000],
    ["支付宝支付", "支付网关", 12, "1.5", 89000],
    ["高德地图API", "地图服务", 18, "2.0", 65000],
    ["腾讯云OCR", "AI服务", 8, "1.2", 45000],
    ["阿里云短信", "消息通知", 6, "1.0", 78000],
    ["七牛云存储", "文件存储", 10, "1.3", 52000],
    ["天眼查企业信息", "数据服务", 15, "2.0", 34000],
  ]);
}

/**
 * Idempotent column adds. Better-sqlite3 throws `duplicate column name`
 * if you try to add an already-present column, so we probe the
 * table_info pragma first and only add what's missing. Each new
 * published-app / isolated-runtime feature that needs a column on
 * `applications` should add the ALTER here.
 */
(function migrateIsolatedRuntimeColumns() {
  const cols = db.prepare("PRAGMA table_info(applications)").all().map((c) => c.name);
  const adds = [
    ["app_slug",            "TEXT"],
    ["published_url",       "TEXT"],
    ["published_version",   "TEXT"],
    ["published_at",        "TEXT"],
    ["publish_config",      "TEXT"],
    ["runtime_container_id","TEXT"],
    ["runtime_port",        "INTEGER"],
    ["runtime_mode",        "TEXT"],
    // The actual slug the runtime container was spawned under. The
    // application's canonical `app_slug` is the baseSlug, but every
    // publish gets a fresh historicalSlug so the URL is stable for
    // historical environments. We persist the historical slug here
    // so we can re-attach after a platform restart.
    ["runtime_alias_slug",  "TEXT"],
    // Initial deploy environment selected at app creation time
    // (dev/test/staging/prod). Persisted so the platform knows which
    // build ring the app was first deployed into; later promotion
    // moves through the app_publications table.
    ["environment",         "TEXT NOT NULL DEFAULT 'dev'"],
  ];
  for (const [name, decl] of adds) {
    if (!cols.includes(name)) {
      // Use a permissive NULL default so existing rows are not rewritten.
      db.exec(`ALTER TABLE applications ADD COLUMN ${name} ${decl}`);
    }
  }
})();

// ─── API keys (F4.6.13 API Key authentication) ────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS api_keys (
    id           TEXT PRIMARY KEY,
    tenant_id    TEXT NOT NULL,
    name         TEXT NOT NULL,
    -- SHA-256 hash of the secret; raw token only returned once on create.
    key_hash     TEXT NOT NULL UNIQUE,
    -- First 12 chars of the token used as a human-readable id (e.g. mp_live_AbCdEf123...)
    key_prefix   TEXT NOT NULL,
    scopes       TEXT NOT NULL DEFAULT 'read',  -- CSV of granted scopes
    app_id       TEXT,                          -- optional restriction
    created_by   TEXT NOT NULL,
    last_used_at TEXT,
    expires_at   TEXT,
    revoked_at   TEXT,
    -- F4.6.14 per-key rate-limit: requests per minute. NULL = unlimited.
    -- Stored on the row so an admin can tune without redeploy.
    rate_limit   INTEGER,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_api_keys_tenant  ON api_keys(tenant_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_api_keys_prefix  ON api_keys(key_prefix)`);

// Idempotent column add for older databases that pre-date F4.6.14.
(function migrateApiKeyRateLimit() {
  const cols = db.prepare("PRAGMA table_info(api_keys)").all().map((c) => c.name);
  if (!cols.includes("rate_limit")) {
    db.exec("ALTER TABLE api_keys ADD COLUMN rate_limit INTEGER");
  }
})();

export default db;
