import { Router } from "express";
import db from "../db.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// GET /api/triggers
router.get("/", (_req, res) => {
  const rows = db.prepare("SELECT * FROM process_triggers ORDER BY created_at DESC").all();
  res.json({ success: true, data: rows });
});

// POST /api/triggers
router.post("/", (req, res) => {
  const { process_id, name, type = "timer", config } = req.body;
  const id = uuidv4();
  db.prepare(
    "INSERT INTO process_triggers (id, process_id, name, type, config) VALUES (?, ?, ?, ?, ?)",
  ).run(id, process_id, name, type, config);
  res.json({ success: true, data: { id, name } });
});

// DELETE /api/triggers/:id
router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM process_triggers WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

export default router;
