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
`);

// ─── Migrations (additive) ─────────────────────────────────
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

export default db;
