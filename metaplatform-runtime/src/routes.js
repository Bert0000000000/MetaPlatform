/**
 * Runtime HTTP API.
 *
 * Endpoints deliberately mirror the platform's `/api/apps/slug/:slug`
 * shape so the PublishedApp page (and the platform's reverse proxy)
 * can talk to a runtime container the same way it talks to the platform
 * itself. Anything that requires multi-tenant auth or admin tools is
 * NOT exposed.
 */
import express from "express";
import db, { RUNTIME_META } from "./runtime-db.js";

const router = express.Router();

/* ── Health ─────────────────────────────────────────────── */
router.get("/health", (_req, res) => {
  const counts = {
    objects: db.prepare("SELECT COUNT(*) AS c FROM ontology_objects").get().c,
    pages: db.prepare("SELECT COUNT(*) AS c FROM app_pages").get().c,
    processes: db.prepare("SELECT COUNT(*) AS c FROM process_definitions").get().c,
  };
  res.json({
    success: true,
    data: {
      ...RUNTIME_META,
      runtime: true,
      counts,
    },
  });
});

/* ── Slug-only mirror of /api/apps/slug/:slug ───────────── */
router.get("/app/slug/:slug", (req, res) => {
  const slug = req.params.slug;
  const app = db.prepare(
    "SELECT * FROM applications WHERE app_slug = ? AND status = 'published'"
  ).get(slug);
  if (!app) return res.status(404).json({ success: false, error: "Application not found in this runtime" });

  let pages = [];
  if (app.publish_config) {
    try {
      const cfg = JSON.parse(app.publish_config);
      pages = cfg.pages || [];
    } catch {}
  }
  if (!pages.length) {
    pages = db.prepare(
      "SELECT id, name, type, icon, sort_order FROM app_pages WHERE app_id = ? ORDER BY sort_order ASC"
    ).all(app.id);
  }
  res.json({ success: true, data: { ...app, pages } });
});

/* ── Ontology ───────────────────────────────────────────── */
router.get("/ontology/objects", (req, res) => {
  const { app_id } = req.query;
  const rows = app_id
    ? db.prepare("SELECT * FROM ontology_objects WHERE app_id = ? ORDER BY created_at DESC").all(app_id)
    : db.prepare("SELECT * FROM ontology_objects ORDER BY created_at DESC").all();
  res.json({ success: true, data: rows });
});

router.get("/ontology/objects/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM ontology_objects WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: "Object not found" });
  res.json({ success: true, data: row });
});

router.get("/ontology/objects/:id/properties", (req, res) => {
  const rows = db.prepare(
    "SELECT * FROM ontology_properties WHERE object_id = ? ORDER BY sort_order ASC, created_at ASC"
  ).all(req.params.id);
  res.json({ success: true, data: rows });
});

/* ── Pages ──────────────────────────────────────────────── */
router.get("/apps/:id/pages", (req, res) => {
  const rows = db.prepare(
    "SELECT * FROM app_pages WHERE app_id = ? ORDER BY sort_order ASC, created_at ASC"
  ).all(req.params.id);
  res.json({ success: true, data: rows });
});

/* ── Processes ─────────────────────────────────────────── */
router.get("/processes", (req, res) => {
  const { app_id } = req.query;
  let sql = "SELECT * FROM process_definitions WHERE 1=1";
  const params = [];
  if (app_id) { sql += " AND app_id = ?"; params.push(app_id); }
  sql += " ORDER BY created_at DESC";
  res.json({ success: true, data: db.prepare(sql).all(...params) });
});

router.get("/processes/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM process_definitions WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: "Process not found" });
  res.json({ success: true, data: row });
});

export default router;
