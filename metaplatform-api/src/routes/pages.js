/**
 * /api/pages — App pages management routes
 */
import { Router } from "express";
import { v4 as uuid } from "uuid";
import db from "../db.js";

const router = Router();

// ─── GET / ── list all pages (optional ?app_id= filter) ───
router.get("/", (req, res, next) => {
  try {
    const { app_id } = req.query;
    let rows;
    if (app_id) {
      rows = db.prepare(
        "SELECT * FROM app_pages WHERE app_id = ? ORDER BY sort_order ASC, created_at ASC"
      ).all(app_id);
    } else {
      rows = db.prepare(
        "SELECT * FROM app_pages ORDER BY sort_order ASC, created_at ASC"
      ).all();
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// ─── GET /:id ── get single page ─────────────────────────
router.get("/:id", (req, res, next) => {
  try {
    const row = db.prepare("SELECT * FROM app_pages WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: "页面不存在" });
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// ─── POST / ── create page ───────────────────────────────
router.post("/", (req, res, next) => {
  try {
    const { app_id, name, type, icon, config, status, sort_order } = req.body;
    if (!app_id || !name) {
      return res.status(400).json({ success: false, error: "app_id 和 name 为必填项" });
    }

    // Verify app exists
    const app = db.prepare("SELECT id FROM applications WHERE id = ?").get(app_id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const id = uuid();
    const now = new Date().toISOString();
    const configStr = typeof config === "object" ? JSON.stringify(config) : config || null;

    // Determine sort_order: if not provided, append to end
    let order = sort_order;
    if (order === undefined || order === null) {
      const maxRow = db.prepare(
        "SELECT MAX(sort_order) AS max_order FROM app_pages WHERE app_id = ?"
      ).get(app_id);
      order = (maxRow?.max_order ?? -1) + 1;
    }

    db.prepare(
      `INSERT INTO app_pages (id, app_id, name, type, icon, status, config, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, app_id, name, type || "list", icon || null, status || "draft", configStr, order, now, now);

    const row = db.prepare("SELECT * FROM app_pages WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /reorder ── reorder pages ───────────────────────
// NOTE: This route must be defined BEFORE /:id to avoid conflict
router.put("/reorder", (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, error: "items 必须为数组" });
    }

    const updateStmt = db.prepare(
      "UPDATE app_pages SET sort_order = ?, updated_at = ? WHERE id = ?"
    );
    const now = new Date().toISOString();

    const reorderTx = db.transaction(() => {
      for (const item of items) {
        if (!item.id || item.sort_order === undefined) continue;
        updateStmt.run(item.sort_order, now, item.id);
      }
    });
    reorderTx();

    res.json({ success: true, data: { updated: items.length } });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /:id ── update page ─────────────────────────────
router.put("/:id", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM app_pages WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "页面不存在" });

    const { name, type, icon, status, config, sort_order } = req.body;
    const now = new Date().toISOString();
    const configStr = typeof config === "object" ? JSON.stringify(config) : config ?? existing.config;

    db.prepare(
      `UPDATE app_pages
       SET name = ?, type = ?, icon = ?, status = ?, config = ?, sort_order = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      name ?? existing.name,
      type ?? existing.type,
      icon ?? existing.icon,
      status ?? existing.status,
      configStr,
      sort_order ?? existing.sort_order,
      now,
      req.params.id
    );

    const row = db.prepare("SELECT * FROM app_pages WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /:id ── delete page ──────────────────────────
router.delete("/:id", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM app_pages WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "页面不存在" });
    db.prepare("DELETE FROM app_pages WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

export default router;
