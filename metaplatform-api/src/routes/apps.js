/**
 * /api/apps — Application management routes
 */
import { Router } from "express";
import { v4 as uuid } from "uuid";
import db from "../db.js";

const router = Router();

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
