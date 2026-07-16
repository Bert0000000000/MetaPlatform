/**
 * Runtime-only database layer.
 *
 * The container accepts the published snapshot via `RUNTIME_DB_PATH`
 * (default `/data/app.db`), which the orchestrator bind-mounts from the
 * platform's per-app publish directory. The mount is read-only, so the
 * SQLite WAL / SHM siblings cannot be created alongside it; we stage a
 * writable copy onto a tmpfs at `/tmp/runtime/app.db` and operate on
 * that. This is the only isolation layer the runtime database needs —
 * nothing inside the container can read any other app's data, and
 * nothing outside the container touches this file.
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import { pipeline } from "node:stream/promises";

const SOURCE_DB_PATH = process.env.RUNTIME_DB_PATH || "/data/app.db";
const APP_ID  = process.env.APP_ID  || "unknown";
const APP_SLUG = process.env.APP_SLUG || "unknown";

/** Make sure /tmp/runtime exists and is writable. */
fs.mkdirSync("/tmp/runtime", { recursive: true });

/**
 * Copy the source sqlite file to a writable tmpfs location, asserting
 * the sizes match before we hand off to better-sqlite3.
 *
 * Using `stream.pipeline` rather than `fs.copyFileSync` is deliberate.
 * Docker-Desktop-on-Windows bind mounts can silently zero-fill
 * synchronous reads past the first 4KB on some host/guest combinations.
 * The stream pipeline delivers the full file regardless of those quirks.
 */
async function stageDatabase() {
  const dest = "/tmp/runtime/app.db";

  if (!fs.existsSync(SOURCE_DB_PATH)) {
    // Volume not yet populated — start fresh so the orchestrator can
    // copy the snapshot in afterwards. The schema `CREATE`s below
    // provision the empty tables.
    fs.writeFileSync(dest, "");
    return dest;
  }

  // Wipe any stale dest so SQLite never sees a half-written file.
  try { fs.unlinkSync(dest); } catch {}

  await pipeline(
    fs.createReadStream(SOURCE_DB_PATH),
    fs.createWriteStream(dest),
  );

  const srcSize  = fs.statSync(SOURCE_DB_PATH).size;
  const destSize = fs.statSync(dest).size;
  if (srcSize !== destSize) {
    throw new Error(
      `Runtime database staging size mismatch: source=${srcSize}B dest=${destSize}B. ` +
      `This is the Docker-Desktop-on-Windows bind-mount read trap; ` +
      `move the published snapshots to a named volume instead of a host bind.`,
    );
  }
  return dest;
}

/**
 * Create the minimal schema. We deliberately re-use the same DDL the
 * platform uses (`db-pg.js` / `db-sqlite.js`) so a runtime DB produced
 * by the platform's publish-snapshot tool opens cleanly here.
 * `CREATE TABLE IF NOT EXISTS` keeps it idempotent.
 */
function ensureSchema(handle) {
  handle.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'traditional',
      status TEXT NOT NULL DEFAULT 'published',
      icon TEXT,
      version TEXT NOT NULL DEFAULT 'v1.0',
      app_slug TEXT,
      published_url TEXT,
      published_version TEXT,
      published_at TEXT,
      publish_config TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
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
      created_at TEXT NOT NULL,
      FOREIGN KEY (object_id) REFERENCES ontology_objects(id)
    );
    CREATE TABLE IF NOT EXISTS app_pages (
      id TEXT PRIMARY KEY,
      app_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'list',
      icon TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      config TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS process_definitions (
      id TEXT PRIMARY KEY,
      app_id TEXT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'business',
      status TEXT NOT NULL DEFAULT 'draft',
      version INTEGER DEFAULT 1,
      bpmn_xml TEXT,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

/* Bring the database up before we let the express server register. */
const DB_PATH = await stageDatabase();
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");
ensureSchema(db);

export const RUNTIME_META = {
  app_id: APP_ID,
  app_slug: APP_SLUG,
  db_path: DB_PATH,
  started_at: new Date().toISOString(),
};
export default db;
