import { Router } from "express";
import db from "../db.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// GET /api/announcements
router.get("/", async (req, res) => {
  const { limit = 10 } = req.query;
  const rows = db
    .prepare("SELECT * FROM announcements WHERE status = ? ORDER BY created_at DESC LIMIT ?")
    .all("active", Number(limit));
  res.json({ success: true, data: rows });
});

// POST /api/announcements
router.post("/", async (req, res) => {
  const { title, content, priority = "normal" } = req.body;
  const id = uuidv4();
  await db.prepare("INSERT INTO announcements (id, title, content, priority) VALUES (?, ?, ?, ?)").run(
    id,
    title,
    content,
    priority,
  );
  res.json({ success: true, data: { id, title, content, priority } });
});

// PUT /api/announcements/:id
router.put("/:id", async (req, res) => {
  const announcement = await db.prepare("SELECT * FROM announcements WHERE id = ?").get(req.params.id);
  if (!announcement) {
    return res.status(404).json({ success: false, message: "Announcement not found" });
  }
  const { title, content, category, priority, target_audience, expires_at } = req.body;
  await db.prepare(
    "UPDATE announcements SET title = ?, content = ?, category = ?, priority = ?, target_audience = ?, expires_at = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(
    title ?? announcement.title,
    content ?? announcement.content,
    category ?? announcement.category,
    priority ?? announcement.priority,
    target_audience ?? announcement.target_audience,
    expires_at ?? announcement.expires_at,
    req.params.id,
  );
  res.json({ success: true, data: { id: req.params.id, title: title ?? announcement.title } });
});

// DELETE /api/announcements/:id
router.delete("/:id", async (req, res) => {
  const announcement = await db.prepare("SELECT * FROM announcements WHERE id = ?").get(req.params.id);
  if (!announcement) {
    return res.status(404).json({ success: false, message: "Announcement not found" });
  }
  await db.prepare("DELETE FROM announcements WHERE id = ?").run(req.params.id);
  res.json({ success: true, data: { id: req.params.id } });
});

export default router;
