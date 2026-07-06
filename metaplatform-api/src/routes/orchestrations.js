import { Router } from "express";
import db from "../db.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// GET /api/orchestrations
router.get("/", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM orchestrations ORDER BY created_at DESC")
    .all();
  res.json({ success: true, data: rows });
});

// GET /api/orchestrations/:id
router.get("/:id", (req, res) => {
  const row = db
    .prepare("SELECT * FROM orchestrations WHERE id = ?")
    .get(req.params.id);
  if (!row) {
    return res.status(404).json({ success: false, error: "Not found" });
  }
  res.json({ success: true, data: row });
});

// POST /api/orchestrations
router.post("/", (req, res) => {
  const { name, type, adapters, trigger_type, config } = req.body;
  const id = uuidv4();
  db.prepare(
    "INSERT INTO orchestrations (id, name, type, adapters, trigger_type, config) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(
    id,
    name,
    type || "custom",
    JSON.stringify(adapters || []),
    trigger_type || "manual",
    JSON.stringify(config || {}),
  );
  res.json({ success: true, data: { id, name } });
});

// PUT /api/orchestrations/:id
router.put("/:id", (req, res) => {
  const { name, adapters, status, config, trigger_type } = req.body;
  const updates = [];
  const params = [];
  if (name !== undefined) {
    updates.push("name = ?");
    params.push(name);
  }
  if (adapters !== undefined) {
    updates.push("adapters = ?");
    params.push(JSON.stringify(adapters));
  }
  if (status !== undefined) {
    updates.push("status = ?");
    params.push(status);
  }
  if (config !== undefined) {
    updates.push("config = ?");
    params.push(JSON.stringify(config));
  }
  if (trigger_type !== undefined) {
    updates.push("trigger_type = ?");
    params.push(trigger_type);
  }
  updates.push("updated_at = datetime('now')");
  params.push(req.params.id);
  db.prepare(`UPDATE orchestrations SET ${updates.join(", ")} WHERE id = ?`).run(
    ...params,
  );
  res.json({ success: true });
});

// DELETE /api/orchestrations/:id
router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM orchestrations WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

export default router;
