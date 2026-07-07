/**
 * /api/knowledge/qa — Knowledge Q&A history CRUD
 */
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db.js";

const router = Router();

// GET / — list Q&A history (with optional limit)
router.get("/", async (req, res, next) => {
  try {
    const { limit = 20 } = req.query;
    const rows = await db.prepare("SELECT * FROM knowledge_qa ORDER BY created_at DESC LIMIT ?").all(Number(limit));
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST / — create Q&A record
router.post("/", async (req, res, next) => {
  try {
    const { question, answer, source_doc_id } = req.body;
    if (!question) return res.status(400).json({ success: false, error: "question 为必填项" });
    const id = uuidv4();
    await db.prepare(
      "INSERT INTO knowledge_qa (id, question, answer, source_doc_id) VALUES (?, ?, ?, ?)"
    ).run(id, question, answer || null, source_doc_id || null);
    res.json({ success: true, data: { id, question, answer } });
  } catch (err) {
    next(err);
  }
});

// DELETE /:id — delete Q&A record
router.delete("/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM knowledge_qa WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "记录不存在" });
    await db.prepare("DELETE FROM knowledge_qa WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

// PUT /:id — update Q&A record
router.put("/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM knowledge_qa WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "记录不存在" });
    const { question, answer, category, tags } = req.body;
    await db.prepare(
      `UPDATE knowledge_qa SET question = ?, answer = ?, category = ?, tags = ? WHERE id = ?`
    ).run(
      question ?? existing.question,
      answer !== undefined ? answer : existing.answer,
      category !== undefined ? category : existing.category,
      tags !== undefined ? (Array.isArray(tags) ? JSON.stringify(tags) : tags) : existing.tags,
      req.params.id
    );
    const row = await db.prepare("SELECT * FROM knowledge_qa WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

export default router;
