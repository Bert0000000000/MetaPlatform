/**
 * /api/messages — User message / notification routes
 */
import { Router } from "express";
import { v4 as uuid } from "uuid";
import db from "../db.js";

const router = Router();

// GET / — list messages for current user
router.get("/", (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "未登录" });
    const rows = db.prepare("SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC").all(userId);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /unread-count — count unread messages (must be before /:id)
router.get("/unread-count", (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "未登录" });
    const row = db.prepare("SELECT COUNT(*) AS cnt FROM messages WHERE user_id = ? AND read = 0").get(userId);
    res.json({ success: true, data: { count: row.cnt } });
  } catch (err) {
    next(err);
  }
});

// PUT /:id/read — mark message as read
router.put("/:id/read", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM messages WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "消息不存在" });
    db.prepare("UPDATE messages SET read = 1 WHERE id = ?").run(req.params.id);
    const row = db.prepare("SELECT * FROM messages WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// POST / — create message
router.post("/", (req, res, next) => {
  try {
    const { user_id, type, title, content, link } = req.body;
    if (!user_id || !title) return res.status(400).json({ success: false, error: "user_id, title 为必填项" });
    const id = uuid();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO messages (id, user_id, type, title, content, read, link, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
    ).run(id, user_id, type || "notification", title, content || "", link || null, now);
    const row = db.prepare("SELECT * FROM messages WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

export default router;
