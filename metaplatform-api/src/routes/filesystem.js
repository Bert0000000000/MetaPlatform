import { Router } from "express";
import db from "../db.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// GET /api/filesystem/files
router.get("/files", async (req, res) => {
  const { app_id, parent_id } = req.query;
  let sql = "SELECT * FROM fs_files WHERE 1=1";
  const params = [];
  if (app_id) {
    sql += " AND app_id = ?";
    params.push(app_id);
  }
  if (parent_id) {
    sql += " AND parent_id = ?";
    params.push(parent_id);
  } else {
    sql += " AND parent_id IS NULL";
  }
  sql += " ORDER BY is_dir DESC, name ASC";
  const rows = await db.prepare(sql).all(...params);
  res.json({ success: true, data: rows });
});

// POST /api/filesystem/files
router.post("/files", async (req, res) => {
  const { app_id, parent_id, name, is_dir = false, content = "" } = req.body;
  const id = uuidv4();
  await db.prepare(
    "INSERT INTO fs_files (id, app_id, parent_id, name, is_dir, content) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, app_id, parent_id, name, is_dir ? 1 : 0, content);
  res.json({ success: true, data: { id, name } });
});

// PUT /api/filesystem/files/:id
router.put("/files/:id", async (req, res) => {
  const { content, name } = req.body;
  const updates = [];
  const params = [];
  if (content !== undefined) {
    updates.push("content = ?");
    params.push(content);
  }
  if (name !== undefined) {
    updates.push("name = ?");
    params.push(name);
  }
  updates.push("updated_at = datetime('now')");
  params.push(req.params.id);
  await db.prepare(`UPDATE fs_files SET ${updates.join(", ")} WHERE id = ?`).run(
    ...params,
  );
  res.json({ success: true });
});

// DELETE /api/filesystem/files/:id
router.delete("/files/:id", async (req, res) => {
  await db.prepare("DELETE FROM fs_files WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

export default router;
