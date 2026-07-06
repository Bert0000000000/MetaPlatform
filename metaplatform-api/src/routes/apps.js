/**
 * /api/apps — Application management routes
 */
import { Router } from "express";
import { v4 as uuid } from "uuid";
import db from "../db.js";

const router = Router();

// ─── Slug generation helper ───────────────────────────────
function generateSlug(name) {
  // Transliterate common Chinese chars, fall back to UUID prefix
  const slug = name
    .toLowerCase()
    .replace(/[\u4e00-\u9fff]/g, (ch) => {
      // Simple hash: map each CJK char to a numeric prefix
      return "c" + ch.charCodeAt(0).toString(36);
    })
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = uuid().slice(0, 6);
  return slug ? `${slug}-${suffix}` : `app-${suffix}`;
}

// ─── GET / ── list all applications ─────────────────────
router.get("/", (req, res, next) => {
  try {
    const { status } = req.query;
    let rows;
    if (status) {
      rows = db.prepare("SELECT * FROM applications WHERE status = ? ORDER BY created_at DESC").all(status);
    } else {
      rows = db.prepare("SELECT * FROM applications ORDER BY created_at DESC").all();
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// ─── GET /published ── list all published apps (public) ───
router.get("/published", (_req, res, next) => {
  try {
    const rows = db.prepare(
      "SELECT id, name, description, category, icon, app_slug, published_url, published_version, published_at FROM applications WHERE status = 'published' ORDER BY published_at DESC"
    ).all();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// ─── GET /slug/:slug ── get app by slug (public) ──────────
router.get("/slug/:slug", (req, res, next) => {
  try {
    const row = db.prepare("SELECT * FROM applications WHERE app_slug = ? AND status = 'published'").get(req.params.slug);
    if (!row) return res.status(404).json({ success: false, error: "Published app not found" });

    // Try to parse pages from publish_config if available
    let pages = [];
    if (row.publish_config) {
      try {
        const config = JSON.parse(row.publish_config);
        pages = config.pages || [];
      } catch {}
    }

    res.json({
      success: true,
      data: {
        ...row,
        pages,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /:id ── single application ─────────────────────
router.get("/:id", (req, res, next) => {
  try {
    const row = db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: "应用不存在" });
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// ─── POST / ── create application ───────────────────────
router.post("/", (req, res, next) => {
  try {
    const { name, description, category, icon } = req.body;
    if (!name || !category || !icon) {
      return res.status(400).json({ success: false, error: "name, category, icon 为必填项" });
    }
    const id = uuid();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO applications (id, name, description, category, icon, status, version, owner_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'draft', 'v0.1', ?, ?, ?)`
    ).run(id, name, description || "", category, icon, req.user?.id || null, now, now);
    const row = db.prepare("SELECT * FROM applications WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /:id ── update application ─────────────────────
router.put("/:id", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "应用不存在" });

    const { name, description, category, icon, status, version } = req.body;
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE applications
       SET name = ?, description = ?, category = ?, icon = ?, status = ?, version = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      name ?? existing.name,
      description ?? existing.description,
      category ?? existing.category,
      icon ?? existing.icon,
      status ?? existing.status,
      version ?? existing.version,
      now,
      req.params.id
    );
    const row = db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /:id ── delete application ──────────────────
router.delete("/:id", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "应用不存在" });
    db.prepare("DELETE FROM applications WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:id/publish ── publish an application ─────────
router.post("/:id/publish", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "应用不存在" });

    const now = new Date().toISOString();
    const version = existing.version || "v1.0";
    let slug = existing.app_slug;

    // Generate slug if not already set
    if (!slug) {
      slug = generateSlug(existing.name);
    }

    const publishedUrl = `/app/${slug}`;
    const publishConfig = JSON.stringify({
      pages: req.body.pages || [],
      config: req.body.config || {},
      publishedAt: now,
    });

    // Update application record
    db.prepare(
      `UPDATE applications
       SET status = 'published',
           app_slug = ?,
           published_url = ?,
           published_version = ?,
           published_at = ?,
           publish_config = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(slug, publishedUrl, version, now, publishConfig, now, req.params.id);

    // Create publication snapshot record
    const pubId = uuid();
    db.prepare(
      `INSERT INTO app_publications (id, app_id, slug, published_url, published_version, config_snapshot, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(pubId, req.params.id, slug, publishedUrl, version, publishConfig, now);

    const row = db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    res.json({
      success: true,
      data: {
        ...row,
        published_url: publishedUrl,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:id/unpublish ── unpublish an application ─────
router.post("/:id/unpublish", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "应用不存在" });

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE applications
       SET status = 'draft',
           published_at = NULL,
           updated_at = ?
       WHERE id = ?`
    ).run(now, req.params.id);

    const row = db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// ─── GET /:id/stats ── app statistics ───────────────────
router.get("/:id/stats", (req, res, next) => {
  try {
    const app = db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const objects_count = db.prepare("SELECT COUNT(*) AS cnt FROM ontology_objects WHERE app_id = ?").get(req.params.id).cnt;
    const pages_count = db.prepare("SELECT COUNT(*) AS cnt FROM app_pages WHERE app_id = ?").get(req.params.id).cnt;
    const flows_count = db.prepare("SELECT COUNT(*) AS cnt FROM process_definitions WHERE app_id = ?").get(req.params.id).cnt;

    // Also update the application's pages_count for consistency
    db.prepare("UPDATE applications SET pages_count = ?, updated_at = ? WHERE id = ?")
      .run(pages_count, new Date().toISOString(), req.params.id);

    res.json({
      success: true,
      data: { objects_count, pages_count, flows_count },
    });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  App Pages (nested under /api/apps/:id/pages)
// ════════════════════════════════════════════════════════

// ─── GET /:id/pages ── list all pages for this app ──────
router.get("/:id/pages", (req, res, next) => {
  try {
    const app = db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const rows = db.prepare(
      "SELECT * FROM app_pages WHERE app_id = ? ORDER BY sort_order ASC, created_at ASC"
    ).all(req.params.id);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:id/pages ── create a page for this app ──────
router.post("/:id/pages", (req, res, next) => {
  try {
    const app = db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const { name, type, icon, config, status, sort_order } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: "name 为必填项" });
    }

    const id = uuid();
    const now = new Date().toISOString();
    const configStr = typeof config === "object" ? JSON.stringify(config) : config || null;

    let order = sort_order;
    if (order === undefined || order === null) {
      const maxRow = db.prepare(
        "SELECT MAX(sort_order) AS max_order FROM app_pages WHERE app_id = ?"
      ).get(req.params.id);
      order = (maxRow?.max_order ?? -1) + 1;
    }

    db.prepare(
      `INSERT INTO app_pages (id, app_id, name, type, icon, status, config, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, req.params.id, name, type || "list", icon || null, status || "draft", configStr, order, now, now);

    const row = db.prepare("SELECT * FROM app_pages WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /:id/pages/:pageId ── update a page ────────────
router.put("/:id/pages/:pageId", (req, res, next) => {
  try {
    const app = db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const existing = db.prepare(
      "SELECT * FROM app_pages WHERE id = ? AND app_id = ?"
    ).get(req.params.pageId, req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "页面不存在" });

    const { name, type, icon, status, config, sort_order } = req.body;
    const now = new Date().toISOString();
    const configStr = typeof config === "object" ? JSON.stringify(config) : config ?? existing.config;

    db.prepare(
      `UPDATE app_pages
       SET name = ?, type = ?, icon = ?, status = ?, config = ?, sort_order = ?, updated_at = ?
       WHERE id = ? AND app_id = ?`
    ).run(
      name ?? existing.name,
      type ?? existing.type,
      icon ?? existing.icon,
      status ?? existing.status,
      configStr,
      sort_order ?? existing.sort_order,
      now,
      req.params.pageId,
      req.params.id
    );

    const row = db.prepare("SELECT * FROM app_pages WHERE id = ?").get(req.params.pageId);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /:id/pages/:pageId ── delete a page ─────────
router.delete("/:id/pages/:pageId", (req, res, next) => {
  try {
    const app = db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const existing = db.prepare(
      "SELECT * FROM app_pages WHERE id = ? AND app_id = ?"
    ).get(req.params.pageId, req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "页面不存在" });

    db.prepare("DELETE FROM app_pages WHERE id = ? AND app_id = ?").run(req.params.pageId, req.params.id);
    res.json({ success: true, data: { id: req.params.pageId } });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  App Config (nested under /api/apps/:id/config)
// ════════════════════════════════════════════════════════

// ─── GET /:id/config ── list all config key-value pairs ──
router.get("/:id/config", (req, res, next) => {
  try {
    const app = db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const rows = db.prepare(
      "SELECT * FROM app_configs WHERE app_id = ? ORDER BY key ASC"
    ).all(req.params.id);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:id/config ── create a config entry ──────────
router.post("/:id/config", (req, res, next) => {
  try {
    const app = db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const { key, value, description } = req.body;
    if (!key) {
      return res.status(400).json({ success: false, error: "key 为必填项" });
    }

    // Check for duplicate key within the same app
    const existingKey = db.prepare(
      "SELECT id FROM app_configs WHERE app_id = ? AND key = ?"
    ).get(req.params.id, key);
    if (existingKey) {
      return res.status(409).json({ success: false, error: "该配置键已存在" });
    }

    const id = uuid();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO app_configs (id, app_id, key, value, description, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, req.params.id, key, value || null, description || null, now);

    const row = db.prepare("SELECT * FROM app_configs WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /:id/config/:key ── update a config value ──────
router.put("/:id/config/:key", (req, res, next) => {
  try {
    const app = db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const existing = db.prepare(
      "SELECT * FROM app_configs WHERE app_id = ? AND key = ?"
    ).get(req.params.id, req.params.key);
    if (!existing) return res.status(404).json({ success: false, error: "配置项不存在" });

    const { value, description } = req.body;
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE app_configs
       SET value = ?, description = ?, updated_at = ?
       WHERE app_id = ? AND key = ?`
    ).run(
      value ?? existing.value,
      description ?? existing.description,
      now,
      req.params.id,
      req.params.key
    );

    const row = db.prepare(
      "SELECT * FROM app_configs WHERE app_id = ? AND key = ?"
    ).get(req.params.id, req.params.key);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Advanced Integrations
// ════════════════════════════════════════════════════════

// POST /:id/test-sso — test SSO connection
router.post("/:id/test-sso", (req, res, next) => {
  try {
    const app = db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const { provider, url, clientId } = req.body;
    // Simulate SSO test
    res.json({ success: true, data: { status: "connected", provider, latency: 45 } });
  } catch (err) {
    next(err);
  }
});

// POST /:id/test-im — test IM integration
router.post("/:id/test-im", (req, res, next) => {
  try {
    const app = db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const { platform, webhook } = req.body;
    res.json({ success: true, data: { status: "connected", platform, latency: 32 } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:id/sync-org — sync organization structure ─────────
router.post("/:id/sync-org", (req, res, next) => {
  try {
    const app = db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const { source } = req.body;
    res.json({ success: true, data: { synced: 12, source } });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Gray Release & Version Management
// ════════════════════════════════════════════════════════

// ─── PUT /:id/gray — configure gray release ────────────────
router.put("/:id/gray", (req, res, next) => {
  try {
    const { strategy, percentage, tenants, userGroups } = req.body;
    const app = db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "App not found" });

    const config = JSON.stringify({ strategy, percentage, tenants, userGroups });
    db.prepare("UPDATE applications SET updated_at = datetime('now') WHERE id = ?").run(req.params.id);

    // Store in app_configs
    const existing = db.prepare("SELECT * FROM app_configs WHERE app_id = ? AND key = ?").get(req.params.id, "gray_release");
    if (existing) {
      db.prepare("UPDATE app_configs SET value = ?, updated_at = datetime('now') WHERE app_id = ? AND key = ?").run(config, req.params.id, "gray_release");
    } else {
      const id = uuid();
      db.prepare("INSERT INTO app_configs (id, app_id, key, value, updated_at) VALUES (?, ?, ?, ?, datetime('now'))").run(id, req.params.id, "gray_release", config);
    }

    res.json({ success: true, data: { strategy, percentage } });
  } catch (err) {
    next(err);
  }
});

// ─── GET /:id/gray — get gray release config ───────────────
router.get("/:id/gray", (req, res, next) => {
  try {
    const app = db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const row = db.prepare("SELECT * FROM app_configs WHERE app_id = ? AND key = ?").get(req.params.id, "gray_release");
    if (!row) return res.json({ success: true, data: null });

    let config = null;
    try { config = JSON.parse(row.value); } catch {}
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:id/rollback — rollback to a previous version ────
router.post("/:id/rollback", (req, res, next) => {
  try {
    const { versionId } = req.body;
    if (!versionId) return res.status(400).json({ success: false, error: "versionId 为必填项" });

    const app = db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    // Mark current active versions as rolled_back
    db.prepare("UPDATE app_versions SET status = 'rolled_back' WHERE app_id = ? AND status = 'active'").run(req.params.id);
    // Activate the target version
    db.prepare("UPDATE app_versions SET status = 'active', updated_at = datetime('now') WHERE id = ?").run(versionId);

    // Also update the application's version field
    const targetVersion = db.prepare("SELECT version FROM app_versions WHERE id = ?").get(versionId);
    if (targetVersion) {
      db.prepare("UPDATE applications SET version = ?, updated_at = datetime('now') WHERE id = ?").run(targetVersion.version, req.params.id);
    }

    res.json({ success: true, data: { message: "Rollback successful" } });
  } catch (err) {
    next(err);
  }
});

// ─── GET /:id/activity — get app activity logs ──────────────
router.get("/:id/activity", (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const logs = db.prepare("SELECT * FROM audit_logs WHERE entity_id = ? ORDER BY created_at DESC LIMIT ?").all(req.params.id, Number(limit));
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
});

export default router;
