import { Router } from "express";
import db from "../db.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// GET /api/announcements
router.get("/", (req, res) => {
  const { limit = 10 } = req.query;
  const rows = db
    .prepare("SELECT * FROM announcements WHERE status = ? ORDER BY created_at DESC LIMIT ?")
    .all("active", Number(limit));
  res.json({ success: true, data: rows });
});

// POST /api/announcements
router.post("/", (req, res) => {
  const { title, content, priority = "normal" } = req.body;
  const id = uuidv4();
  db.prepare("INSERT INTO announcements (id, title, content, priority) VALUES (?, ?, ?, ?)").run(
    id,
    title,
    content,
    priority,
  );
  res.json({ success: true, data: { id, title, content, priority } });
});

export default router;
