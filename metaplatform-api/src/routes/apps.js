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
    const pages_count = app.pages_count || 0;
    const flows_count = db.prepare("SELECT COUNT(*) AS cnt FROM process_definitions WHERE app_id = ?").get(req.params.id).cnt;

    res.json({
      success: true,
      data: { objects_count, pages_count, flows_count },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
