/**
 * Publish-snapshot tool.
 *
 * Builds a self-contained SQLite file under `<data>/published/<slug>.db`
 * containing exactly one application: its own row, plus all referenced
 * ontology_objects (+ their fields), app_pages, and process_definitions.
 *
 * The runtime container starts from this file. Doing the snapshot here
 * means a runtime container never opens the platform's primary sqlite —
 * the platform can run primary ops without affecting the runtime, and
 * the runtime can be stopped without touching the platform.
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_ROOT = process.env.METAPLATFORM_DATA_ROOT || "../data";
const PUB_ROOT = path.resolve(path.resolve(DATA_ROOT), "published");

fs.mkdirSync(PUB_ROOT, { recursive: true });

/**
 * All-or-nothing build. If something goes wrong mid-way, the partial
 * <slug>.db is removed so we never start a runtime on a half-written
 * snapshot.
 *
 * `app` is expected to be the row returned by the platform's
 * `SELECT * FROM applications WHERE id = ?`. The page + object listing
 * is produced internally from the same DB the platform opened, so we
 * don't need to round-trip through HTTP.
 */
export function buildPublishSnapshot(platformDb, app) {
  const slug = app.app_slug;
  if (!slug) throw new Error(`publish-snapshot: app ${app.id} has no slug`);

  const dest = path.join(PUB_ROOT, `${slug}.db`);
  fs.mkdirSync(PUB_ROOT, { recursive: true });

  // Always start with a fresh file, otherwise stale data leaks.
  try { fs.unlinkSync(dest); } catch {}

  const out = new Database(dest);
  out.pragma("journal_mode = NORMAL");
  try {
    // Apply the same minimal schema as the runtime image so a container
    // can boot directly against this file.
    out.exec(SCHEMA_SQL);

    // The application row itself. Status is forced to `published` so
    // runtime routes only see published apps.
    const publishedApp = {
      ...app,
      status: "published",
      updated_at: new Date().toISOString(),
    };
    out.prepare(`
      INSERT INTO applications (
        id, name, description, category, status, icon, version,
        app_slug, published_url, published_version, published_at,
        publish_config, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      publishedApp.id,
      publishedApp.name,
      publishedApp.description || null,
      publishedApp.category || "traditional",
      publishedApp.status,
      publishedApp.icon || null,
      publishedApp.version || "v1.0",
      publishedApp.app_slug,
      publishedApp.published_url || `/app/${slug}`,
      publishedApp.published_version || "v1.0",
      publishedApp.published_at || new Date().toISOString(),
      publishedApp.publish_config || null,
      publishedApp.created_at,
      publishedApp.updated_at,
    );

    // Ontology objects + their fields. We pull by app_id so we don't
    // bleed objects from other apps even if a tenant slips through.
    const objects = platformDb
      .prepare("SELECT * FROM ontology_objects WHERE app_id = ?")
      .all(app.id);
    const insertObject = out.prepare(`
      INSERT INTO ontology_objects (
        id, app_id, name, label, description, icon, status,
        properties_count, actions_count, rules_count,
        created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    const insertProperty = out.prepare(`
      INSERT INTO ontology_properties (
        id, object_id, name, label, type, required, unique_field,
        default_value, description, sort_order, created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `);
    for (const obj of objects) {
      insertObject.run(
        obj.id, obj.app_id, obj.name, obj.label, obj.description || null,
        obj.icon || null, obj.status || "active",
        obj.properties_count || 0, obj.actions_count || 0, obj.rules_count || 0,
        obj.created_at, obj.updated_at,
      );
      const properties = platformDb
        .prepare("SELECT * FROM ontology_properties WHERE object_id = ? ORDER BY sort_order ASC")
        .all(obj.id);
      for (const prop of properties) {
        insertProperty.run(
          prop.id, prop.object_id, prop.name, prop.label, prop.type || "text",
          prop.required ? 1 : 0, prop.unique_field ? 1 : 0,
          prop.default_value ?? null, prop.description || null,
          prop.sort_order || 0, prop.created_at,
        );
      }
    }

    // App pages.
    const pages = platformDb
      .prepare("SELECT * FROM app_pages WHERE app_id = ? ORDER BY sort_order ASC")
      .all(app.id);
    const insertPage = out.prepare(`
      INSERT INTO app_pages (
        id, app_id, name, type, icon, status, config,
        sort_order, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?)
    `);
    for (const page of pages) {
      insertPage.run(
        page.id, page.app_id, page.name, page.type || "list",
        page.icon || null, page.status || "draft", page.config || null,
        page.sort_order || 0, page.created_at, page.updated_at,
      );
    }

    // Process definitions.
    const defs = platformDb
      .prepare("SELECT * FROM process_definitions WHERE app_id = ?")
      .all(app.id);
    const insertFlow = out.prepare(`
      INSERT INTO process_definitions (
        id, app_id, name, type, status, version,
        bpmn_xml, description, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?)
    `);
    for (const def of defs) {
      insertFlow.run(
        def.id, def.app_id, def.name, def.type || "business",
        def.status || "draft", def.version || 1,
        def.bpmn_xml || null, def.description || null,
        def.created_at, def.updated_at,
      );
    }

    out.close();
    return dest;
  } catch (err) {
    try { out.close(); } catch {}
    try { fs.unlinkSync(dest); } catch {}
    throw err;
  }
}

const SCHEMA_SQL = `
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
`;

export function snapshotPath(slug) {
  return path.join(PUB_ROOT, `${slug}.db`);
}
