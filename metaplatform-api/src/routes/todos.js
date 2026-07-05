import { Router } from "express";
import db from "../db.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// GET /api/todos
router.get("/", (req, res) => {
  const { user_id, status, limit = 20 } = req.query;
  let sql = "SELECT * FROM todos WHERE 1=1";
  const params = [];
  if (user_id) {
    sql += " AND user_id = ?";
    params.push(user_id);
  }
  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(Number(limit));
  const rows = db.prepare(sql).all(...params);
  res.json({ success: true, data: rows });
});

// POST /api/todos
router.post("/", (req, res) => {
  const { user_id, title, description, priority = "medium", due_date } = req.body;
  const id = uuidv4();
  db.prepare(
    "INSERT INTO todos (id, user_id, title, description, priority, due_date) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, user_id, title, description, priority, due_date);
  res.json({ success: true, data: { id, title } });
});

export default router;
