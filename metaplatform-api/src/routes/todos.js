import { Router } from "express";
import db from "../db.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// GET /api/todos
router.get("/", async (req, res) => {
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
  const rows = await db.prepare(sql).all(...params);
  res.json({ success: true, data: rows });
});

// POST /api/todos
router.post("/", async (req, res) => {
  const { user_id, title, description, priority = "medium", due_date } = req.body;
  const id = uuidv4();
  await db.prepare(
    "INSERT INTO todos (id, user_id, title, description, priority, due_date) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, user_id, title, description, priority, due_date);
  res.json({ success: true, data: { id, title } });
});

// PUT /api/todos/:id
router.put("/:id", async (req, res) => {
  const todo = await db.prepare("SELECT * FROM todos WHERE id = ?").get(req.params.id);
  if (!todo) {
    return res.status(404).json({ success: false, message: "Todo not found" });
  }
  const { title, description, priority, status, due_date } = req.body;
  await db.prepare(
    "UPDATE todos SET title = ?, description = ?, priority = ?, status = ?, due_date = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(
    title ?? todo.title,
    description ?? todo.description,
    priority ?? todo.priority,
    status ?? todo.status,
    due_date ?? todo.due_date,
    req.params.id,
  );
  res.json({ success: true, data: { id: req.params.id, title: title ?? todo.title } });
});

// DELETE /api/todos/:id
router.delete("/:id", async (req, res) => {
  const todo = await db.prepare("SELECT * FROM todos WHERE id = ?").get(req.params.id);
  if (!todo) {
    return res.status(404).json({ success: false, message: "Todo not found" });
  }
  await db.prepare("DELETE FROM todos WHERE id = ?").run(req.params.id);
  res.json({ success: true, data: { id: req.params.id } });
});

export default router;
