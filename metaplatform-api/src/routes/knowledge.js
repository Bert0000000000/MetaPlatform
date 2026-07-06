/**
 * /api/knowledge — Knowledge base document routes
 */
import { Router } from "express";
import { v4 as uuid } from "uuid";
import db from "../db.js";

const router = Router();

// GET /documents — list documents (optional ?category=)
router.get("/documents", (req, res, next) => {
  try {
    const { category } = req.query;
    let rows;
    if (category) {
      rows = db.prepare("SELECT * FROM knowledge_documents WHERE category = ? ORDER BY created_at DESC").all(category);
    } else {
      rows = db.prepare("SELECT * FROM knowledge_documents ORDER BY created_at DESC").all();
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /documents/:id — single document
router.get("/documents/:id", (req, res, next) => {
  try {
    const row = db.prepare("SELECT * FROM knowledge_documents WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: "文档不存在" });
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// POST /documents — create document
router.post("/documents", (req, res, next) => {
  try {
    const { title, type, category, content, file_path, file_size, tags } = req.body;
    if (!title) return res.status(400).json({ success: false, error: "title 为必填项" });
    const id = uuid();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO knowledge_documents (id, title, type, category, content, file_path, file_size, status, tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`
    ).run(
      id,
      title,
      type || "text",
      category || null,
      content || "",
      file_path || null,
      file_size || null,
      tags ? (Array.isArray(tags) ? JSON.stringify(tags) : tags) : null,
      now,
      now
    );
    const row = db.prepare("SELECT * FROM knowledge_documents WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// PUT /documents/:id — update document
router.put("/documents/:id", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM knowledge_documents WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "文档不存在" });

    const { title, type, category, content, file_path, file_size, status, tags } = req.body;
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE knowledge_documents SET title = ?, type = ?, category = ?, content = ?, file_path = ?, file_size = ?, status = ?, tags = ?, updated_at = ? WHERE id = ?`
    ).run(
      title ?? existing.title,
      type ?? existing.type,
      category ?? existing.category,
      content ?? existing.content,
      file_path ?? existing.file_path,
      file_size ?? existing.file_size,
      status ?? existing.status,
      tags !== undefined ? (Array.isArray(tags) ? JSON.stringify(tags) : tags) : existing.tags,
      now,
      req.params.id
    );
    const row = db.prepare("SELECT * FROM knowledge_documents WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// DELETE /documents/:id — delete document
router.delete("/documents/:id", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM knowledge_documents WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "文档不存在" });
    db.prepare("DELETE FROM knowledge_documents WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

// GET /search — full text search on title + content
router.get("/search", (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ success: false, error: "请提供搜索关键词 (q)" });
    const pattern = `%${q}%`;
    const rows = db.prepare(
      `SELECT * FROM knowledge_documents WHERE (title LIKE ? OR content LIKE ?) AND status = 'active' ORDER BY created_at DESC`
    ).all(pattern, pattern);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /categories — list categories with counts
router.get("/categories", (_req, res, next) => {
  try {
    const rows = db.prepare(
      `SELECT category, COUNT(*) AS count FROM knowledge_documents WHERE category IS NOT NULL GROUP BY category ORDER BY count DESC`
    ).all();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET / — knowledge base overview
router.get("/", (req, res) => {
  try {
    const docs = db.prepare("SELECT COUNT(*) AS cnt FROM knowledge_documents").get().cnt;
    const cats = db.prepare("SELECT COUNT(DISTINCT category) AS cnt FROM knowledge_documents WHERE category IS NOT NULL").get().cnt;
    res.json({ success: true, data: { documents: docs, categories: cats } });
  } catch (err) {
    res.json({ success: true, data: { documents: 0, categories: 0 } });
  }
});

export default router;
